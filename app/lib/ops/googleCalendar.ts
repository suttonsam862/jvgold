/**
 * ============================================================================
 * GOOGLE CALENDAR — THE ASYMMETRIC BRIDGE
 * ============================================================================
 *
 * Jesse's words: "Jesse's Google Calendar should integrate with this calendar,
 * and essentially list all JVGold events as a certain categorical event on the
 * calendar, and all other categorical events create blockoffs for customers in
 * the JV Gold calendar."
 *
 * That sentence describes two DIFFERENT flows, and the whole design turns on
 * keeping them apart:
 *
 *   WRITE OUT  JV Gold sessions are pushed to a dedicated secondary Google
 *              calendar called "JV GOLD". It is the only calendar this app
 *              ever writes to. He can toggle it off, share it with a parent,
 *              recolour it or delete the whole thing without a single event on
 *              his primary calendar moving.
 *
 *   READ IN    Every OTHER calendar on his account is read as OPAQUE BUSY
 *              TIME through the freeBusy endpoint and subtracted from customer
 *              availability. Titles are never requested, never received and
 *              never stored.
 *
 * ---------------------------------------------------------------------------
 * WHY freeBusy AND NOT events.list
 * ---------------------------------------------------------------------------
 * `events.list` would hand us summaries, descriptions, attendees and locations
 * for every private thing on his calendar, one careless spread away from a
 * customer-facing loader payload. `freeBusy` structurally returns `{start,
 * end}` and nothing else — a title cannot leak even by accident, because it was
 * never in the response. A customer sees "unavailable"; they never see
 * "dentist". `BusyBlock` in `~/lib/ops/availability` has no title field for the
 * same reason, and these two decisions reinforce each other on purpose.
 *
 * ---------------------------------------------------------------------------
 * SCOPES — WHY NOT calendar.events
 * ---------------------------------------------------------------------------
 * The default pair is:
 *
 *   calendar.readonly     enumerate his calendars + query freeBusy
 *   calendar.app.created  create the JV GOLD calendar and fully own its events
 *
 * `calendar.app.created` grants access ONLY to calendars this app created. It
 * is the tightest scope that can still do `findOrCreate`, which this design
 * needs — `calendar.events` cannot create a calendar at all, and it would hand
 * us write access to every event on every calendar he owns, which is far more
 * than the job requires.
 *
 * `GOOGLE_SCOPES_BYO_CALENDAR` is the fallback for the day Jesse makes the
 * calendar by hand in the Google UI and pastes its id in. A calendar he created
 * is not app-created, so `calendar.app.created` cannot touch it and
 * `calendar.events` is the only way in. Broader, and therefore not the default.
 *
 * ---------------------------------------------------------------------------
 * TIME
 * ---------------------------------------------------------------------------
 * This module is THE Google boundary named in `~/lib/ops/availability`.
 * Everything inside the app is a civil wall-clock string in
 * America/Los_Angeles; everything on the wire is a real instant. The four
 * converters — `toUtcInstant`, `fromUtcInstant`, `wallClockFromRfc3339`,
 * `rfc3339FromWallClock` — live in that file and are used here and nowhere
 * else. No `new Date()` parsing of Google's strings, ever: the worker runs UTC,
 * the browser runs Pacific, and a date parsed in the wrong place slides a
 * session by an hour twice a year.
 *
 * `Date.now()` DOES appear here, in exactly one job: deciding whether an OAuth
 * access token has expired. That is a real instant, not a wall clock, it is
 * only ever read on the server, and every function that needs it takes an
 * injectable `nowMs` so tests stay deterministic. Never call these from a
 * component body.
 *
 * ---------------------------------------------------------------------------
 * HONESTY
 * ---------------------------------------------------------------------------
 * Nothing here pretends. Every network call returns a `GoogleResult`, never a
 * thrown exception and never a silent empty array — "no busy blocks" and "we
 * could not ask" are different answers and callers must be able to tell them
 * apart. `googleConfig()` returns null when the environment is not wired up so
 * screens can render a disabled state naming the missing variable, and
 * `memoryLinkStore()` announces `durable: false` so no screen can claim a sync
 * mapping was saved when it was only held in worker memory.
 */

import type {IsoDate, IsoDateTime, SessionId} from '~/lib/ops/types';
import {dateOf} from '~/lib/ops/types';
import type {BusyBlock} from '~/lib/ops/availability';
import {
  OPERATING_TIME_ZONE,
  addMinutes,
  durationMinutes,
  mergeIntervals,
  rfc3339FromWallClock,
  toUtcInstant,
  wallClockFromRfc3339,
} from '~/lib/ops/availability';

/* ==========================================================================
 * 1. CONFIG — mirrors app/lib/supabase.ts
 * ======================================================================== */

/** The slice of `context.env` this module reads. All three are SERVER-ONLY. */
export interface GoogleServerEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

export interface GoogleConfig {
  clientId: string;
  /** NEVER serialise this. It must not appear in a loader payload. */
  clientSecret: string;
  /** Must match an Authorised redirect URI in the Google Cloud console byte for byte. */
  redirectUri: string;
}

/** The env var names, in the order the connect screen should list them. */
export const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
] as const;

export type GoogleEnvKey = (typeof GOOGLE_ENV_KEYS)[number];

/**
 * Normalised OAuth config, or null when the environment is not wired up.
 *
 * Returning null rather than throwing is the point: every caller can degrade to
 * an explicit "not configured" state instead of taking the page down. Same
 * contract as `supabaseConfig()`.
 */
export function googleConfig(env: GoogleServerEnv): GoogleConfig | null {
  const clientId = (env?.GOOGLE_CLIENT_ID ?? '').trim();
  const clientSecret = (env?.GOOGLE_CLIENT_SECRET ?? '').trim();
  const redirectUri = (env?.GOOGLE_REDIRECT_URI ?? '').trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return {clientId, clientSecret, redirectUri};
}

/** Which of the three variables are absent. For the disabled-state copy. */
export function missingGoogleEnv(env: GoogleServerEnv): GoogleEnvKey[] {
  return GOOGLE_ENV_KEYS.filter((key) => !(env?.[key] ?? '').trim());
}

/* ==========================================================================
 * 2. SCOPES
 * ======================================================================== */

const SCOPE_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';
const SCOPE_APP_CREATED =
  'https://www.googleapis.com/auth/calendar.app.created';
const SCOPE_EVENTS = 'https://www.googleapis.com/auth/calendar.events';

/**
 * THE DEFAULT PAIR. Read every calendar's free/busy, own one calendar we made.
 * Register exactly these two on the OAuth consent screen.
 */
export const GOOGLE_SCOPES: readonly string[] = [
  SCOPE_READONLY,
  SCOPE_APP_CREATED,
];

/**
 * THE FALLBACK PAIR, for a JV GOLD calendar Jesse created by hand and whose id
 * he pasted in. `calendar.app.created` cannot see a calendar it did not create,
 * so writing to his own calendar needs `calendar.events`. Broader than we would
 * like — it grants write access to events on all his calendars — which is why
 * it is the fallback and not the default. Reading stays `calendar.readonly`
 * either way, and reading still goes through freeBusy either way.
 */
export const GOOGLE_SCOPES_BYO_CALENDAR: readonly string[] = [
  SCOPE_READONLY,
  SCOPE_EVENTS,
];

/** Which scope set a stored grant satisfies. */
export type GoogleScopeMode = 'app-created' | 'byo-calendar' | 'insufficient';

export function scopeMode(granted: readonly string[]): GoogleScopeMode {
  const has = (scope: string) => granted.includes(scope);
  if (!has(SCOPE_READONLY)) return 'insufficient';
  if (has(SCOPE_APP_CREATED)) return 'app-created';
  if (has(SCOPE_EVENTS)) return 'byo-calendar';
  return 'insufficient';
}

/** One sentence per mode, for the connect screen. */
export const SCOPE_MODE_NOTE: Record<GoogleScopeMode, string> = {
  'app-created':
    'JV Gold can create and manage its own "JV GOLD" calendar, and can read free/busy times from every other calendar. It cannot read the title of a single event.',
  'byo-calendar':
    'JV Gold was granted broader event access so it can write to a calendar Jesse created by hand. Reading availability still goes through free/busy only.',
  insufficient:
    'The granted scopes are not enough to read availability. Reconnect and approve both requested permissions.',
};

/* ==========================================================================
 * 3. RESULTS — no throwing across this boundary
 * ======================================================================== */

export type GoogleErrorCode =
  | 'not-configured'
  | 'not-connected'
  | 'auth'
  | 'scope'
  | 'http'
  | 'network'
  | 'invalid';

export interface GoogleError {
  code: GoogleErrorCode;
  /** HTTP status when there was one. */
  status: number | null;
  /** Safe to print. Never contains a token, a secret or an event title. */
  message: string;
  /** True when the same call might succeed if repeated. */
  retryable: boolean;
}

export type GoogleResult<T> =
  | {ok: true; value: T}
  | {ok: false; error: GoogleError};

const ok = <T>(value: T): GoogleResult<T> => ({ok: true, value});

const fail = (
  code: GoogleErrorCode,
  message: string,
  status: number | null = null,
  retryable = false,
): GoogleResult<never> => ({
  ok: false,
  error: {code, status, message, retryable},
});

export const NOT_CONFIGURED_NOTE =
  'Google Calendar is not configured on this environment. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI have to be set on the deployment before there is anything to connect to.';

export const NOT_CONNECTED_NOTE =
  'Google Calendar is configured but nobody has connected an account yet. Until Jesse signs in, JV Gold sees none of his other commitments and availability reflects JV Gold bookings only.';

/* ==========================================================================
 * 4. ENDPOINTS
 * ======================================================================== */

export const GOOGLE_AUTH_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** The name of the secondary calendar this app owns. Exact, and it matters. */
export const JV_GOLD_CALENDAR_SUMMARY = 'JV GOLD';

export const JV_GOLD_CALENDAR_DESCRIPTION =
  'Training sessions booked through JV Gold. Created and kept up to date automatically — edits made here are overwritten on the next sync. Safe to hide, recolour or share.';

/* ==========================================================================
 * 5. THE SESSION — where the grant lives
 * ======================================================================== */

/** The slice of the Hydrogen session this module touches. */
export interface GoogleSessionLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  unset(key: string): void;
}

/** The slice of the loader/action context this module touches. */
export interface GoogleContext {
  session: GoogleSessionLike;
  env: GoogleServerEnv;
}

export const GOOGLE_SESSION_KEYS = {
  /** The OAuth grant. Secret — never serialise this to a loader payload. */
  tokens: 'jvGoogleTokens',
  /** One-shot CSRF state for an in-flight authorisation. */
  oauthState: 'jvGoogleOauthState',
  /** The resolved JV GOLD calendar id, cached so we stop re-listing. */
  calendarId: 'jvGoogleCalendarId',
  /** Explicit busy-source selection. Absent means "use the default rule". */
  busyCalendars: 'jvGoogleBusyCalendars',
} as const;

/**
 * A stored OAuth grant.
 *
 * NOTE ON THE COOKIE. The Hydrogen session is a signed, httpOnly cookie, so
 * this rides in the response headers on every request that touches it. Access
 * tokens are ~200 bytes and refresh tokens ~100, which fits comfortably under
 * the 4KB cookie ceiling alongside the rest of the session — but it is the
 * reason nothing bulky (event lists, calendar metadata, the link store) is kept
 * here. When Supabase owns integrations, move this whole object to a row keyed
 * by staff id and keep only the id in the cookie.
 */
export interface GoogleTokens {
  accessToken: string;
  /** Real instant, epoch milliseconds. Compared against `Date.now()`. */
  expiresAtMs: number;
  /**
   * Only returned on the FIRST consent (and only with `access_type=offline`).
   * A refresh that omits it must not erase the one we already hold.
   */
  refreshToken: string | null;
  /** The scopes Google actually granted, which may be fewer than we asked for. */
  scopes: string[];
  tokenType: string;
  /** RFC 3339 instant. Display only. */
  connectedAt: string;
}

export function readGoogleTokens(context: GoogleContext): GoogleTokens | null {
  const raw = context.session.get(GOOGLE_SESSION_KEYS.tokens);
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<GoogleTokens>;
  if (typeof value.accessToken !== 'string' || !value.accessToken) return null;
  return {
    accessToken: value.accessToken,
    expiresAtMs:
      typeof value.expiresAtMs === 'number' ? value.expiresAtMs : 0,
    refreshToken:
      typeof value.refreshToken === 'string' && value.refreshToken
        ? value.refreshToken
        : null,
    scopes: Array.isArray(value.scopes)
      ? value.scopes.filter((s): s is string => typeof s === 'string')
      : [],
    tokenType: typeof value.tokenType === 'string' ? value.tokenType : 'Bearer',
    connectedAt:
      typeof value.connectedAt === 'string' ? value.connectedAt : '',
  };
}

export function writeGoogleTokens(
  context: GoogleContext,
  tokens: GoogleTokens,
): void {
  context.session.set(GOOGLE_SESSION_KEYS.tokens, tokens);
}

/** Drop the local grant. Does NOT revoke it at Google — call `revokeGrant`. */
export function clearGoogleTokens(context: GoogleContext): void {
  context.session.unset(GOOGLE_SESSION_KEYS.tokens);
  context.session.unset(GOOGLE_SESSION_KEYS.calendarId);
  context.session.unset(GOOGLE_SESSION_KEYS.busyCalendars);
}

export function readJvGoldCalendarId(context: GoogleContext): string | null {
  const value = context.session.get(GOOGLE_SESSION_KEYS.calendarId);
  return typeof value === 'string' && value ? value : null;
}

export function writeJvGoldCalendarId(
  context: GoogleContext,
  calendarId: string,
): void {
  context.session.set(GOOGLE_SESSION_KEYS.calendarId, calendarId);
}

/** Explicit busy-source list, or null meaning "every calendar the rule allows". */
export function readBusyCalendarIds(context: GoogleContext): string[] | null {
  const value = context.session.get(GOOGLE_SESSION_KEYS.busyCalendars);
  if (!Array.isArray(value)) return null;
  const ids = value.filter((v): v is string => typeof v === 'string' && !!v);
  return ids.length > 0 ? ids : null;
}

export function writeBusyCalendarIds(
  context: GoogleContext,
  ids: readonly string[] | null,
): void {
  if (!ids || ids.length === 0) {
    context.session.unset(GOOGLE_SESSION_KEYS.busyCalendars);
    return;
  }
  context.session.set(GOOGLE_SESSION_KEYS.busyCalendars, [...ids]);
}

/* ==========================================================================
 * 6. OAUTH
 * ======================================================================== */

/** A one-shot CSRF state, held in the session for the length of the round trip. */
export interface OAuthStateRecord {
  state: string;
  /** Epoch ms. Anything older than `OAUTH_STATE_TTL_MS` is refused. */
  createdAtMs: number;
  /** Where to land after the callback. Same-origin path only. */
  returnTo: string;
}

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** 32 hex characters of real entropy. `crypto` is standard in the worker. */
export function newOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function beginOAuthState(
  context: GoogleContext,
  returnTo: string,
  nowMs: number = Date.now(),
): OAuthStateRecord {
  const record: OAuthStateRecord = {
    state: newOAuthState(),
    createdAtMs: nowMs,
    // Same-origin paths only. An absolute URL here would make this an open
    // redirect the moment somebody passed one in from a query string.
    returnTo: returnTo.startsWith('/') ? returnTo : '/private/calendar/connect',
  };
  context.session.set(GOOGLE_SESSION_KEYS.oauthState, record);
  return record;
}

/**
 * Read the pending state and clear it in the same move, so a callback can only
 * ever be consumed once. Returns null when there is none, when it has expired,
 * or when the value on the URL does not match.
 */
export function consumeOAuthState(
  context: GoogleContext,
  state: string | null,
  nowMs: number = Date.now(),
): OAuthStateRecord | null {
  const raw = context.session.get(GOOGLE_SESSION_KEYS.oauthState);
  context.session.unset(GOOGLE_SESSION_KEYS.oauthState);
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<OAuthStateRecord>;
  if (typeof record.state !== 'string' || !record.state) return null;
  if (!state || state !== record.state) return null;
  const createdAtMs =
    typeof record.createdAtMs === 'number' ? record.createdAtMs : 0;
  if (nowMs - createdAtMs > OAUTH_STATE_TTL_MS) return null;
  return {
    state: record.state,
    createdAtMs,
    returnTo:
      typeof record.returnTo === 'string' && record.returnTo.startsWith('/')
        ? record.returnTo
        : '/private/calendar/connect',
  };
}

export interface AuthorizeUrlOptions {
  state: string;
  /** Defaults to `GOOGLE_SCOPES`. Pass `GOOGLE_SCOPES_BYO_CALENDAR` for the fallback. */
  scopes?: readonly string[];
  /** Pre-fills the account chooser with Jesse's address. */
  loginHint?: string | null;
  /**
   * `consent` (default) forces the consent screen, which is what GUARANTEES a
   * refresh token. Google only mints one on a fresh grant; a silent re-auth
   * returns an access token alone and we would lose the ability to refresh.
   */
  prompt?: 'consent' | 'select_account' | 'none';
}

/** The URL to send Jesse to. Nothing secret is on it — the secret stays server-side. */
export function authorizeUrl(
  config: GoogleConfig,
  options: AuthorizeUrlOptions,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: (options.scopes ?? GOOGLE_SCOPES).join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: options.prompt ?? 'consent',
    state: options.state,
  });
  if (options.loginHint) params.set('login_hint', options.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

async function postToken(
  body: URLSearchParams,
): Promise<GoogleResult<TokenResponse>> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: body.toString(),
    });
  } catch {
    return fail(
      'network',
      'Could not reach Google to exchange the sign-in. Nothing was connected.',
      null,
      true,
    );
  }

  let payload: TokenResponse;
  try {
    payload = (await response.json()) as TokenResponse;
  } catch {
    return fail(
      'invalid',
      'Google returned a response this app could not read. Nothing was connected.',
      response.status,
    );
  }

  if (!response.ok || payload.error || !payload.access_token) {
    // `error_description` is Google's own words and never contains a token.
    const detail = payload.error_description ?? payload.error ?? 'unknown error';
    return fail(
      'auth',
      `Google refused the request: ${detail}`,
      response.status,
      response.status >= 500,
    );
  }

  return ok(payload);
}

function tokensFromResponse(
  payload: TokenResponse,
  previous: GoogleTokens | null,
  nowMs: number,
): GoogleTokens {
  const expiresIn =
    typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  return {
    accessToken: payload.access_token as string,
    expiresAtMs: nowMs + expiresIn * 1000,
    // A refresh response omits refresh_token. Keeping the previous one is the
    // difference between staying connected and silently dropping out in an hour.
    refreshToken: payload.refresh_token ?? previous?.refreshToken ?? null,
    scopes: payload.scope
      ? payload.scope.split(/\s+/).filter(Boolean)
      : previous?.scopes ?? [],
    tokenType: payload.token_type ?? 'Bearer',
    connectedAt: previous?.connectedAt || new Date(nowMs).toISOString(),
  };
}

/** Authorisation code → tokens. Server only; sends the client secret. */
export async function exchangeCode(
  config: GoogleConfig,
  code: string,
  nowMs: number = Date.now(),
): Promise<GoogleResult<GoogleTokens>> {
  const result = await postToken(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  );
  if (!result.ok) return result;
  return ok(tokensFromResponse(result.value, null, nowMs));
}

/** Refresh token → a fresh access token, preserving everything not re-sent. */
export async function refreshTokens(
  config: GoogleConfig,
  previous: GoogleTokens,
  nowMs: number = Date.now(),
): Promise<GoogleResult<GoogleTokens>> {
  if (!previous.refreshToken) {
    return fail(
      'auth',
      'The stored Google grant has no refresh token, so it cannot be renewed. Disconnect and connect again.',
    );
  }
  const result = await postToken(
    new URLSearchParams({
      refresh_token: previous.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  );
  if (!result.ok) return result;
  return ok(tokensFromResponse(result.value, previous, nowMs));
}

/** Tell Google to forget the grant. Best effort; the local copy is cleared regardless. */
export async function revokeGrant(
  tokens: GoogleTokens,
): Promise<GoogleResult<true>> {
  const token = tokens.refreshToken ?? tokens.accessToken;
  try {
    const response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({token}).toString(),
    });
    // 200 = revoked. 400 = already invalid, which is the same outcome.
    if (response.ok || response.status === 400) return ok(true);
    return fail(
      'http',
      'Google would not revoke the grant. The local copy was still removed — revoke it by hand at myaccount.google.com/permissions.',
      response.status,
      true,
    );
  } catch {
    return fail(
      'network',
      'Could not reach Google to revoke the grant. The local copy was still removed — revoke it by hand at myaccount.google.com/permissions.',
      null,
      true,
    );
  }
}

/** Refresh a minute early: a token that expires mid-flight is a failed request. */
const REFRESH_SKEW_MS = 60 * 1000;

export function tokensExpired(
  tokens: GoogleTokens,
  nowMs: number = Date.now(),
): boolean {
  return tokens.expiresAtMs - REFRESH_SKEW_MS <= nowMs;
}

/**
 * A usable access token, refreshing and re-persisting when needed.
 *
 * THE ONE ENTRY POINT for every API call below. It writes the refreshed grant
 * straight back into the session, so the Set-Cookie that server.js appends
 * carries the new token and the next request does not refresh again.
 */
export async function getAccessToken(
  context: GoogleContext,
  nowMs: number = Date.now(),
): Promise<GoogleResult<string>> {
  const config = googleConfig(context.env);
  if (!config) return fail('not-configured', NOT_CONFIGURED_NOTE);

  const tokens = readGoogleTokens(context);
  if (!tokens) return fail('not-connected', NOT_CONNECTED_NOTE);

  if (!tokensExpired(tokens, nowMs)) return ok(tokens.accessToken);

  const refreshed = await refreshTokens(config, tokens, nowMs);
  if (!refreshed.ok) return refreshed;
  writeGoogleTokens(context, refreshed.value);
  return ok(refreshed.value.accessToken);
}

/* ==========================================================================
 * 7. THE API CALLER
 * ======================================================================== */

interface GoogleApiErrorBody {
  error?: {code?: number; message?: string; status?: string};
}

/**
 * One fetch wrapper for the whole Calendar API.
 *
 * Returns the parsed body AND the response, because the write path needs the
 * status (409 means "already there, patch it") and the ETag header. `expect`
 * lists statuses the caller will handle itself rather than have turned into an
 * error.
 */
interface GoogleCallInit {
  method: string;
  body?: string;
  headers?: Record<string, string>;
  /** Statuses the caller handles itself instead of receiving a `GoogleError`. */
  expect?: number[];
}

async function callGoogle<T>(
  accessToken: string,
  path: string,
  init: GoogleCallInit,
): Promise<GoogleResult<{status: number; body: T | null; response: Response}>> {
  const {expect = [], headers = {}, ...rest} = init;
  let response: Response;
  try {
    response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  } catch {
    return fail(
      'network',
      'Could not reach Google Calendar. Nothing was read and nothing was written.',
      null,
      true,
    );
  }

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (response.ok || expect.includes(response.status)) {
    return ok({status: response.status, body: body as T | null, response});
  }

  const detail =
    (body as GoogleApiErrorBody | null)?.error?.message ??
    `HTTP ${response.status}`;

  if (response.status === 401) {
    return fail(
      'auth',
      'Google rejected the stored sign-in. Reconnect the calendar.',
      401,
    );
  }
  if (response.status === 403) {
    return fail(
      'scope',
      `Google refused this operation: ${detail}. That usually means the granted scopes do not cover it — reconnect and approve both permissions.`,
      403,
    );
  }
  return fail(
    'http',
    `Google Calendar returned an error: ${detail}`,
    response.status,
    response.status === 429 || response.status >= 500,
  );
}

/* ==========================================================================
 * 8. READ — free/busy, and only free/busy
 * ======================================================================== */

/** One calendar on Jesse's account, as the coach screen needs to see it. */
export interface GoogleCalendarRef {
  /** Google's id. Usually an email address — COACH-ONLY, never public. */
  id: string;
  /** Its name in his Google UI. Also coach-only. */
  label: string;
  primary: boolean;
  /** `owner` | `writer` | `reader` | `freeBusyReader`. */
  accessRole: string;
  /** True for the calendar this app writes JV Gold sessions to. */
  isJvGold: boolean;
  /**
   * True for calendars that would block real hours for no reason — the US
   * holidays feed, the birthdays feed. Excluded from busy by default; he can
   * put them back with an explicit selection.
   */
  noise: boolean;
}

interface CalendarListEntry {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  deleted?: boolean;
  accessRole?: string;
}

/** Feeds that describe the world, not Jesse's day. */
function isNoiseCalendar(id: string): boolean {
  return (
    id.endsWith('#holiday@group.v.calendar.google.com') ||
    id.endsWith('#contacts@group.v.calendar.google.com') ||
    id.endsWith('#weeknum@group.v.calendar.google.com')
  );
}

/**
 * Every calendar on the account. Needs `calendar.readonly`.
 *
 * This is the ONLY place calendar names are read, it is coach-only, and the
 * names never travel further — `BusyBlock` cannot carry one.
 */
export async function listCalendars(
  context: GoogleContext,
  nowMs: number = Date.now(),
): Promise<GoogleResult<GoogleCalendarRef[]>> {
  const token = await getAccessToken(context, nowMs);
  if (!token.ok) return token;

  const jvGoldId = readJvGoldCalendarId(context);
  const result = await callGoogle<{items?: CalendarListEntry[]}>(
    token.value,
    '/users/me/calendarList?maxResults=250&minAccessRole=freeBusyReader&showDeleted=false',
    {method: 'GET'},
  );
  if (!result.ok) return result;

  const items = result.value.body?.items ?? [];
  const refs: GoogleCalendarRef[] = [];
  for (const item of items) {
    if (!item.id || item.deleted) continue;
    const label = item.summaryOverride || item.summary || item.id;
    refs.push({
      id: item.id,
      label,
      primary: item.primary === true,
      accessRole: item.accessRole ?? 'reader',
      isJvGold:
        item.id === jvGoldId ||
        (jvGoldId === null && label.trim() === JV_GOLD_CALENDAR_SUMMARY),
      noise: isNoiseCalendar(item.id),
    });
  }

  refs.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return ok(refs);
}

/**
 * Which calendars actually feed busy time.
 *
 * Default rule: everything EXCEPT the JV GOLD calendar (its events are JV
 * Gold's own bookings, already counted as `session` time — importing them back
 * would double-count and turn "booked" into the vaguer "busy") and except the
 * holiday/birthday noise feeds. An explicit selection stored in the session
 * overrides the rule entirely.
 */
export function busySourcesFrom(
  calendars: readonly GoogleCalendarRef[],
  selection: readonly string[] | null,
): GoogleCalendarRef[] {
  if (selection && selection.length > 0) {
    const wanted = new Set(selection);
    return calendars.filter((c) => wanted.has(c.id) && !c.isJvGold);
  }
  return calendars.filter((c) => !c.isJvGold && !c.noise);
}

export interface FreeBusyRead {
  blocks: BusyBlock[];
  /** How many calendars answered. 0 with no error means he has nothing else on. */
  calendarsQueried: number;
  /**
   * Calendars Google could not answer for, with its own reason code
   * (`notFound`, `rateLimitExceeded`…). COACH-ONLY — it names calendars.
   */
  errors: Array<{calendarId: string; reason: string}>;
}

interface FreeBusyResponse {
  calendars?: Record<
    string,
    {
      busy?: Array<{start?: string; end?: string}>;
      errors?: Array<{domain?: string; reason?: string}>;
    }
  >;
}

/** Google's own per-request ceiling on the number of calendars in one query. */
const FREEBUSY_MAX_CALENDARS = 50;

/** freeBusy will not answer for an unbounded span. Well past the 60-day horizon. */
const FREEBUSY_MAX_DAYS = 90;

/** FNV-1a, 32-bit, hex. Small, deterministic, and not a security primitive. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * An opaque, stable id for a busy block.
 *
 * DELIBERATELY HASHED. The obvious id — `google:${calendarId}:${start}` —
 * embeds an email address, and `BusyBlock` goes to customer-facing loaders.
 * Hashing keeps the id stable across reads (so React keys are steady) while
 * making it carry nothing about whose calendar it came from.
 */
function busyId(calendarId: string, start: IsoDateTime, end: IsoDateTime): string {
  return `google:${fnv1a(`${calendarId}|${start}|${end}`)}`;
}

/** Midnight to midnight, a whole number of days — Google's shape for all-day. */
function looksAllDay(start: IsoDateTime, end: IsoDateTime): boolean {
  if (start.slice(11) !== '00:00:00' || end.slice(11) !== '00:00:00') {
    return false;
  }
  const span = durationMinutes(start, end);
  return span >= 1440 && span % 1440 === 0;
}

/**
 * Free/busy across a window, as opaque `BusyBlock`s ready for
 * `AvailabilityContext.busy`.
 *
 * `from` and `to` are OPERATING-ZONE WALL CLOCKS. They are converted to real
 * instants exactly once, here, by `toUtcInstant`. Every timestamp coming back
 * is converted the other way by `wallClockFromRfc3339`. Nothing in between
 * touches a `Date`.
 *
 * Overlapping ranges from different calendars are merged, because six
 * overlapping commitments are still one unavailable hour and six identical
 * "unavailable" rows on a customer's screen is noise.
 */
export async function fetchBusy(
  context: GoogleContext,
  options: {
    from: IsoDateTime;
    to: IsoDateTime;
    calendarIds: readonly string[];
  },
  nowMs: number = Date.now(),
): Promise<GoogleResult<FreeBusyRead>> {
  const ids = [...new Set(options.calendarIds)].filter(Boolean);
  if (ids.length === 0) {
    return ok({blocks: [], calendarsQueried: 0, errors: []});
  }
  if (durationMinutes(options.from, options.to) <= 0) {
    return fail('invalid', 'The requested window ends before it starts.');
  }
  if (durationMinutes(options.from, options.to) > FREEBUSY_MAX_DAYS * 1440) {
    return fail(
      'invalid',
      `Free/busy can only be queried ${FREEBUSY_MAX_DAYS} days at a time. Ask for a shorter window.`,
    );
  }

  const token = await getAccessToken(context, nowMs);
  if (!token.ok) return token;

  const timeMin = toUtcInstant(options.from);
  const timeMax = toUtcInstant(options.to);

  const collected: Array<{start: IsoDateTime; end: IsoDateTime; id: string}> = [];
  const errors: Array<{calendarId: string; reason: string}> = [];

  for (let offset = 0; offset < ids.length; offset += FREEBUSY_MAX_CALENDARS) {
    const chunk = ids.slice(offset, offset + FREEBUSY_MAX_CALENDARS);
    const result = await callGoogle<FreeBusyResponse>(
      token.value,
      '/freeBusy',
      {
        method: 'POST',
        body: JSON.stringify({
          timeMin,
          timeMax,
          timeZone: 'UTC',
          items: chunk.map((id) => ({id})),
        }),
      },
    );
    if (!result.ok) return result;

    const calendars = result.value.body?.calendars ?? {};
    for (const [calendarId, entry] of Object.entries(calendars)) {
      for (const problem of entry.errors ?? []) {
        errors.push({calendarId, reason: problem.reason ?? 'unknown'});
      }
      for (const period of entry.busy ?? []) {
        if (!period.start || !period.end) continue;
        const start = wallClockFromRfc3339(period.start);
        const end = wallClockFromRfc3339(period.end);
        if (durationMinutes(start, end) <= 0) continue;
        collected.push({start, end, id: busyId(calendarId, start, end)});
      }
    }
  }

  // Merge first, then re-key: a merged span is a new range and needs its own
  // stable id rather than one of the ids it swallowed.
  const merged = mergeIntervals(
    collected.map(({start, end}) => ({start, end})),
  );

  const blocks: BusyBlock[] = merged.map((interval) => ({
    id: busyId('merged', interval.start, interval.end),
    start: interval.start,
    end: interval.end,
    allDay: looksAllDay(interval.start, interval.end),
    source: 'google' as const,
  }));

  return ok({blocks, calendarsQueried: ids.length, errors});
}

/* ==========================================================================
 * 9. THE JV GOLD CALENDAR — findOrCreate
 * ======================================================================== */

interface CalendarResource {
  id?: string;
  summary?: string;
  timeZone?: string;
}

export interface JvGoldCalendar {
  id: string;
  /** True when this call is what brought it into existence. */
  created: boolean;
}

/**
 * The one calendar this app owns, found or made.
 *
 * Order matters. A cached id is checked first (one cheap GET), then the
 * calendar list is searched by name, and only then is one created. Creating a
 * second "JV GOLD" every time a cache went cold would be exactly the kind of
 * mess this whole module exists to avoid.
 *
 * Needs `calendar.app.created` to create. With the BYO fallback scopes, pass
 * `existingId` — creation is not attempted and a missing calendar is an honest
 * error rather than a surprise second calendar.
 */
export async function findOrCreateJvGoldCalendar(
  context: GoogleContext,
  options: {existingId?: string | null; allowCreate?: boolean} = {},
  nowMs: number = Date.now(),
): Promise<GoogleResult<JvGoldCalendar>> {
  const token = await getAccessToken(context, nowMs);
  if (!token.ok) return token;

  const cached = options.existingId ?? readJvGoldCalendarId(context);
  if (cached) {
    const check = await callGoogle<CalendarResource>(
      token.value,
      `/calendars/${encodeURIComponent(cached)}`,
      {method: 'GET', expect: [404, 410]},
    );
    if (check.ok && check.value.status === 200 && check.value.body?.id) {
      writeJvGoldCalendarId(context, check.value.body.id);
      return ok({id: check.value.body.id, created: false});
    }
    // 404/410 — he deleted it, or the id was wrong. Fall through and re-resolve.
  }

  const calendars = await listCalendars(context, nowMs);
  if (calendars.ok) {
    const match = calendars.value.find(
      (calendar) => calendar.label.trim() === JV_GOLD_CALENDAR_SUMMARY,
    );
    if (match) {
      writeJvGoldCalendarId(context, match.id);
      return ok({id: match.id, created: false});
    }
  }

  if (options.allowCreate === false) {
    return fail(
      'invalid',
      `No calendar named "${JV_GOLD_CALENDAR_SUMMARY}" was found on this account, and creating one was not permitted. Create it in Google Calendar and paste its id in.`,
      404,
    );
  }

  const created = await callGoogle<CalendarResource>(token.value, '/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: JV_GOLD_CALENDAR_SUMMARY,
      description: JV_GOLD_CALENDAR_DESCRIPTION,
      timeZone: OPERATING_TIME_ZONE,
    }),
  });
  if (!created.ok) return created;
  const id = created.value.body?.id;
  if (!id) {
    return fail(
      'invalid',
      'Google accepted the new calendar but did not return its id. Reload and try again.',
      created.value.status,
    );
  }
  writeJvGoldCalendarId(context, id);
  return ok({id, created: true});
}

/* ==========================================================================
 * 10. WRITE — idempotent, by construction
 * ======================================================================== */

/**
 * Google event ids are base32hex: digits 0-9 and letters a-v, 5–1024 chars.
 * Encoding the session id into that alphabet gives a DETERMINISTIC id — the
 * same session always maps to the same event — which is what makes the write
 * path idempotent without a database. Two workers racing on the same session
 * both compute the same id, and the loser gets a 409 that means "it exists".
 */
const BASE32HEX = '0123456789abcdefghijklmnopqrstuv';

function base32hex(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32HEX[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += BASE32HEX[(buffer << (5 - bits)) & 31];
  return out;
}

/** `'sess-014'` → `'jvgold…'`. Stable forever; do not change the recipe. */
export function eventIdForSession(sessionId: SessionId): string {
  const encoded = base32hex(new TextEncoder().encode(sessionId));
  // `jvgold` is itself legal base32hex (j, v, g, o, l, d all fall in a-v), so
  // the prefix keeps the id readable in the Google UI without breaking it.
  const id = `jvgold${encoded}`;
  return id.length >= 5 ? id.slice(0, 1024) : `${id}00000`.slice(0, 1024);
}

/** What a JV Gold session looks like on the JV GOLD calendar. */
export interface SessionEventInput {
  sessionId: SessionId;
  /** Operating-zone wall clock. */
  start: IsoDateTime;
  /** Operating-zone wall clock. */
  end: IsoDateTime;
  /** All-day blocks are written as `date`, not `dateTime`. */
  allDay?: boolean;
  /** The event title on HIS calendar. May name a client — his calendar, his roster. */
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Google `colorId` 1-11, so JV Gold work is one recognisable hue. */
  colorId?: string | null;
}

interface GoogleEventResource {
  id?: string;
  etag?: string;
  status?: string;
  updated?: string;
  extendedProperties?: {private?: Record<string, string>};
}

const SIGNATURE_KEY = 'jvGoldSignature';
const SESSION_KEY = 'jvGoldSessionId';

/**
 * A fingerprint of everything we would send. Two syncs with the same signature
 * are the same event, so the second one skips the network entirely.
 */
export function signatureFor(input: SessionEventInput): string {
  return fnv1a(
    [
      input.sessionId,
      input.start,
      input.end,
      input.allDay ? 'allday' : 'timed',
      input.summary,
      input.description ?? '',
      input.location ?? '',
      input.colorId ?? '',
    ].join(' '),
  );
}

function eventBody(input: SessionEventInput): Record<string, unknown> {
  const timed = !input.allDay;
  const start = timed
    ? {dateTime: rfc3339FromWallClock(input.start), timeZone: OPERATING_TIME_ZONE}
    : {date: dateOf(input.start)};
  const end = timed
    ? {dateTime: rfc3339FromWallClock(input.end), timeZone: OPERATING_TIME_ZONE}
    : {date: dateOf(input.end)};

  return {
    summary: input.summary,
    description: input.description ?? '',
    location: input.location ?? '',
    start,
    end,
    // Revives an event Jesse deleted rather than colliding with its tombstone.
    status: 'confirmed',
    // Jesse is the only person on this calendar. No attendees means no
    // invitation email ever reaches a family by accident.
    attendees: [],
    reminders: {useDefault: true},
    ...(input.colorId ? {colorId: input.colorId} : {}),
    extendedProperties: {
      private: {
        [SESSION_KEY]: input.sessionId,
        [SIGNATURE_KEY]: signatureFor(input),
      },
    },
  };
}

/* --------------------------------------------------------------------------
 * The link store
 * ------------------------------------------------------------------------ */

/** What we remember about a session's copy on the JV GOLD calendar. */
export interface GoogleEventLink {
  sessionId: SessionId;
  calendarId: string;
  eventId: string;
  /** Google's ETag, used for If-Match so a concurrent edit cannot be clobbered. */
  etag: string | null;
  /** `signatureFor()` of the payload last written. Equal means skip. */
  signature: string;
  /** RFC 3339 instant of the last successful write. */
  syncedAt: string;
}

/**
 * Where the mappings live.
 *
 * `durable` is not decoration. A screen that reports "synced" off a store with
 * `durable: false` is lying about a save, so the flag exists to be printed.
 */
export interface GoogleLinkStore {
  durable: boolean;
  /** One sentence naming what this store is and is not. */
  note: string;
  get(sessionId: SessionId): Promise<GoogleEventLink | null>;
  put(link: GoogleEventLink): Promise<void>;
  remove(sessionId: SessionId): Promise<void>;
}

export const MEMORY_LINK_STORE_NOTE =
  'Sync mappings are held in worker memory only. They survive within one worker instance and are lost on redeploy or cold start — which is safe, because every event id is derived from its session id and the signature is also stored on the Google event itself, so a lost mapping costs one extra read, never a duplicate. The durable home for this table is Supabase.';

/**
 * The default store: a Map. Honest about being ephemeral.
 *
 * This is survivable precisely because the write path does not depend on it —
 * `eventIdForSession` is deterministic and the signature is mirrored into the
 * event's `extendedProperties`, so a cold store re-derives everything from
 * Google with one extra GET.
 */
export function memoryLinkStore(
  seed: readonly GoogleEventLink[] = [],
): GoogleLinkStore {
  const map = new Map<SessionId, GoogleEventLink>(
    seed.map((link) => [link.sessionId, link]),
  );
  return {
    durable: false,
    note: MEMORY_LINK_STORE_NOTE,
    async get(sessionId) {
      return map.get(sessionId) ?? null;
    },
    async put(link) {
      map.set(link.sessionId, link);
    },
    async remove(sessionId) {
      map.delete(sessionId);
    },
  };
}

/* --------------------------------------------------------------------------
 * The sync itself
 * ------------------------------------------------------------------------ */

export type SyncOutcome =
  | 'unchanged'
  | 'created'
  | 'updated'
  | 'adopted'
  | 'deleted'
  | 'already-absent';

export interface SyncResult {
  sessionId: SessionId;
  calendarId: string;
  eventId: string;
  outcome: SyncOutcome;
  link: GoogleEventLink | null;
}

function linkFrom(
  input: SessionEventInput,
  calendarId: string,
  eventId: string,
  resource: GoogleEventResource | null,
  nowMs: number,
): GoogleEventLink {
  return {
    sessionId: input.sessionId,
    calendarId,
    eventId,
    etag: resource?.etag ?? null,
    signature: signatureFor(input),
    syncedAt: new Date(nowMs).toISOString(),
  };
}

/**
 * Put one session on the JV GOLD calendar, exactly once, no matter how often
 * this is called.
 *
 * The full ladder, in order:
 *
 *   1. A stored link whose signature and calendar match  → 'unchanged', NO CALL.
 *   2. No stored link → GET the deterministic id first.
 *        200 and the signature on the event matches      → 'adopted', no write.
 *        200 and it differs                              → PATCH.
 *        404                                             → INSERT.
 *   3. INSERT returning 409 ("id already exists", which also covers an id whose
 *      event Jesse deleted) → PATCH instead. That is the whole reason the id is
 *      deterministic: a duplicate insert is never a duplicate event.
 *   4. PATCH sends `If-Match` when an ETag is known. A 412 means he edited the
 *      event since we last looked; we re-read and patch again without the
 *      guard, because the session times in JV Gold are the authority for the
 *      fields we own.
 *
 * The net effect: no no-op PATCHes, no duplicate events, and no way for a retry
 * to make a second copy of somebody's training session.
 */
export async function syncSessionEvent(
  context: GoogleContext,
  calendarId: string,
  input: SessionEventInput,
  store: GoogleLinkStore,
  nowMs: number = Date.now(),
): Promise<GoogleResult<SyncResult>> {
  const token = await getAccessToken(context, nowMs);
  if (!token.ok) return token;

  const eventId = eventIdForSession(input.sessionId);
  const signature = signatureFor(input);
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const path = `${base}/${encodeURIComponent(eventId)}`;

  const stored = await store.get(input.sessionId);
  if (
    stored &&
    stored.calendarId === calendarId &&
    stored.eventId === eventId &&
    stored.signature === signature
  ) {
    return ok({
      sessionId: input.sessionId,
      calendarId,
      eventId,
      outcome: 'unchanged',
      link: stored,
    });
  }

  // An ETag only means anything against the event it was issued for. A stored
  // link pointing at a different calendar or a different id is not usable.
  const usable =
    stored !== null &&
    stored.calendarId === calendarId &&
    stored.eventId === eventId;
  let etag: string | null = usable ? stored.etag : null;

  // ---- 2. no usable link: ask Google what is already there ----------------
  if (!usable) {
    const existing = await callGoogle<GoogleEventResource>(token.value, path, {
      method: 'GET',
      expect: [404, 410],
    });
    if (!existing.ok) return existing;

    if (existing.value.status === 200 && existing.value.body) {
      const resource = existing.value.body;
      const theirs = resource.extendedProperties?.private?.[SIGNATURE_KEY];
      etag = resource.etag ?? null;
      if (theirs === signature && resource.status !== 'cancelled') {
        const link = linkFrom(input, calendarId, eventId, resource, nowMs);
        await store.put(link);
        return ok({
          sessionId: input.sessionId,
          calendarId,
          eventId,
          outcome: 'adopted',
          link,
        });
      }
    } else {
      // 404/410 — nothing there. Insert.
      return insertEvent(
        token.value,
        base,
        eventId,
        calendarId,
        input,
        store,
        nowMs,
      );
    }
  }

  return patchEvent(token.value, path, base, eventId, calendarId, input, store, etag, nowMs);
}

async function insertEvent(
  accessToken: string,
  base: string,
  eventId: string,
  calendarId: string,
  input: SessionEventInput,
  store: GoogleLinkStore,
  nowMs: number,
): Promise<GoogleResult<SyncResult>> {
  const created = await callGoogle<GoogleEventResource>(accessToken, base, {
    method: 'POST',
    body: JSON.stringify({id: eventId, ...eventBody(input)}),
    // 409 is not a failure here. It is Google telling us the deterministic id
    // is taken — by our own earlier write, or by the tombstone of one Jesse
    // deleted. Either way the answer is "patch it", never "insert another".
    expect: [409],
  });
  if (!created.ok) return created;

  if (created.value.status === 409) {
    const path = `${base}/${encodeURIComponent(eventId)}`;
    return patchEvent(
      accessToken,
      path,
      base,
      eventId,
      calendarId,
      input,
      store,
      null,
      nowMs,
      true,
    );
  }

  const link = linkFrom(input, calendarId, eventId, created.value.body, nowMs);
  await store.put(link);
  return ok({
    sessionId: input.sessionId,
    calendarId,
    eventId,
    outcome: 'created',
    link,
  });
}

async function patchEvent(
  accessToken: string,
  path: string,
  base: string,
  eventId: string,
  calendarId: string,
  input: SessionEventInput,
  store: GoogleLinkStore,
  etag: string | null,
  nowMs: number,
  fromConflict = false,
): Promise<GoogleResult<SyncResult>> {
  const patched = await callGoogle<GoogleEventResource>(accessToken, path, {
    method: 'PATCH',
    headers: etag ? {'If-Match': etag} : {},
    body: JSON.stringify(eventBody(input)),
    expect: [404, 410, 412],
  });
  if (!patched.ok) return patched;

  if (patched.value.status === 412) {
    // He edited it since we last read. Our fields win; drop the guard and
    // write once more. Only ever one retry — never a loop.
    return patchEvent(
      accessToken,
      path,
      base,
      eventId,
      calendarId,
      input,
      store,
      null,
      nowMs,
      fromConflict,
    );
  }

  if (patched.value.status === 404 || patched.value.status === 410) {
    if (fromConflict) {
      // Insert said "exists", patch says "gone". Something raced us; say so
      // rather than ping-ponging.
      return fail(
        'http',
        'Google reported the event as both existing and missing. Nothing was written — try again.',
        409,
        true,
      );
    }
    return insertEvent(accessToken, base, eventId, calendarId, input, store, nowMs);
  }

  const link = linkFrom(input, calendarId, eventId, patched.value.body, nowMs);
  await store.put(link);
  return ok({
    sessionId: input.sessionId,
    calendarId,
    eventId,
    outcome: 'updated',
    link,
  });
}

/**
 * Remove a session's event. A 404 or 410 is success, not failure — the desired
 * end state is "not on the calendar", and it already is.
 */
export async function deleteSessionEvent(
  context: GoogleContext,
  calendarId: string,
  sessionId: SessionId,
  store: GoogleLinkStore,
  nowMs: number = Date.now(),
): Promise<GoogleResult<SyncResult>> {
  const token = await getAccessToken(context, nowMs);
  if (!token.ok) return token;

  const eventId = eventIdForSession(sessionId);
  const result = await callGoogle<null>(
    token.value,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {method: 'DELETE', expect: [404, 410]},
  );
  if (!result.ok) return result;

  await store.remove(sessionId);
  return ok({
    sessionId,
    calendarId,
    eventId,
    outcome:
      result.value.status === 404 || result.value.status === 410
        ? 'already-absent'
        : 'deleted',
    link: null,
  });
}

/** Sync a batch, one at a time. Stops at the first hard failure and says where. */
export async function syncSessionEvents(
  context: GoogleContext,
  calendarId: string,
  inputs: readonly SessionEventInput[],
  store: GoogleLinkStore,
  nowMs: number = Date.now(),
): Promise<GoogleResult<{results: SyncResult[]; stoppedAt: SessionId | null}>> {
  const results: SyncResult[] = [];
  for (const input of inputs) {
    const result = await syncSessionEvent(
      context,
      calendarId,
      input,
      store,
      nowMs,
    );
    if (!result.ok) {
      // Partial progress is real progress and must not be thrown away — the
      // caller needs to know which sessions did land.
      return {
        ok: false,
        error: {
          ...result.error,
          message: `${result.error.message} ${results.length} of ${inputs.length} sessions had already been written.`,
        },
      };
    }
    results.push(result.value);
  }
  return ok({results, stoppedAt: null});
}

/* ==========================================================================
 * 11. STATUS — the serialisable summary a screen renders
 * ======================================================================== */

export interface GoogleConnectionStatus {
  /** All three env vars present. */
  configured: boolean;
  /** Which are missing. Empty when configured. */
  missingEnv: GoogleEnvKey[];
  /** A grant is stored. Says nothing about whether it still works. */
  connected: boolean;
  /** RFC 3339 instant of the original grant, or null. */
  connectedAt: string | null;
  /** Scopes Google actually granted. */
  scopes: string[];
  scopeMode: GoogleScopeMode;
  /** The resolved JV GOLD calendar id, if we have one. COACH-ONLY. */
  jvGoldCalendarId: string | null;
  /** True when the stored access token needs a refresh on the next call. */
  needsRefresh: boolean;
  /** True when the grant cannot be renewed and a reconnect is required. */
  needsReconnect: boolean;
}

/**
 * Everything a screen needs, and NOT ONE TOKEN. Safe to return from a
 * coach-only loader. Never widen this to carry `accessToken`, `refreshToken` or
 * the client secret.
 */
export function googleConnectionStatus(
  context: GoogleContext,
  nowMs: number = Date.now(),
): GoogleConnectionStatus {
  const configured = googleConfig(context.env) !== null;
  const tokens = readGoogleTokens(context);
  return {
    configured,
    missingEnv: missingGoogleEnv(context.env),
    connected: tokens !== null,
    connectedAt: tokens?.connectedAt || null,
    scopes: tokens?.scopes ?? [],
    scopeMode: scopeMode(tokens?.scopes ?? []),
    jvGoldCalendarId: readJvGoldCalendarId(context),
    needsRefresh: tokens ? tokensExpired(tokens, nowMs) : false,
    needsReconnect: tokens !== null && tokens.refreshToken === null,
  };
}

/**
 * The convenience the booking loaders actually want: a busy list for a window,
 * plus the honest `googleConnected` flag that
 * `AvailabilityContext.googleConnected` expects.
 *
 * When Google is not configured, not connected, or simply unreachable, this
 * returns `connected: false` with an empty list and the reason — NEVER an empty
 * list dressed up as "he is free". `availabilityConfidence()` reads that flag
 * and the screen prints `UNVERIFIED_AVAILABILITY_NOTE`.
 */
export async function busyForWindow(
  context: GoogleContext,
  window: {from: IsoDateTime; to: IsoDateTime},
  nowMs: number = Date.now(),
): Promise<{
  connected: boolean;
  busy: BusyBlock[];
  /** Null when everything worked. A printable sentence when it did not. */
  problem: string | null;
}> {
  const status = googleConnectionStatus(context, nowMs);
  if (!status.configured) {
    return {connected: false, busy: [], problem: NOT_CONFIGURED_NOTE};
  }
  if (!status.connected) {
    return {connected: false, busy: [], problem: NOT_CONNECTED_NOTE};
  }

  const calendars = await listCalendars(context, nowMs);
  if (!calendars.ok) {
    return {connected: false, busy: [], problem: calendars.error.message};
  }

  const sources = busySourcesFrom(
    calendars.value,
    readBusyCalendarIds(context),
  );
  const read = await fetchBusy(
    context,
    {from: window.from, to: window.to, calendarIds: sources.map((c) => c.id)},
    nowMs,
  );
  if (!read.ok) {
    return {connected: false, busy: [], problem: read.error.message};
  }

  // A calendar Google could not answer for means the window is incomplete, and
  // an incomplete answer must not be presented as a confirmed one.
  if (read.value.errors.length > 0) {
    return {
      connected: false,
      busy: read.value.blocks,
      problem: `${read.value.errors.length} of ${read.value.calendarsQueried} calendars did not answer, so this view of Jesse’s week is incomplete.`,
    };
  }

  return {connected: true, busy: read.value.blocks, problem: null};
}

/** A window one day back to `days` forward — what the booking horizon needs. */
export function windowForHorizon(
  today: IsoDate,
  days: number,
): {from: IsoDateTime; to: IsoDateTime} {
  const from = `${today}T00:00:00`;
  return {from, to: addMinutes(from, Math.max(1, days) * 1440)};
}
