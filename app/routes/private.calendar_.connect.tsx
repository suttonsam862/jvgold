/**
 * ============================================================================
 * /private/calendar/connect — the Google Calendar handshake
 * ============================================================================
 *
 * FILENAME. `private.calendar_.connect.tsx`, with the trailing underscore on
 * `calendar_`. Flat routes nest on dots, so `private.calendar.connect.tsx`
 * would make this a CHILD of `private.calendar.tsx` — which renders no
 * <Outlet/>, so the URL would resolve and then quietly render the calendar
 * instead of this page. The underscore opts out of the nesting and keeps the
 * URL exactly the same: /private/calendar/connect.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE IS ALSO THE OAUTH CALLBACK
 * ---------------------------------------------------------------------------
 * GOOGLE_REDIRECT_URI points here. The loader watches for `?code=&state=`,
 * verifies the one-shot state it stashed in the session, exchanges the code
 * server-side, stores the grant and redirects back to the clean URL so a
 * refresh cannot replay a spent authorisation code.
 *
 * Failures come back as a `?status=` CODE, never as a message on the URL —
 * query strings end up in logs, referrers and browser history, and nothing
 * about Jesse's account belongs in any of them.
 *
 * ---------------------------------------------------------------------------
 * THE ASYMMETRY THIS PAGE HAS TO EXPLAIN
 * ---------------------------------------------------------------------------
 * READ  every calendar on his account, through free/busy only — start and end
 *       times, no titles, no attendees, no locations. Google does not return
 *       them, so they cannot leak.
 * WRITE one calendar, "JV GOLD", created by this app. Nothing else on his
 *       account is ever written to.
 *
 * ---------------------------------------------------------------------------
 * HONESTY
 * ---------------------------------------------------------------------------
 * Nothing here fakes a connection. When the three GOOGLE_* variables are
 * absent the button is genuinely disabled and the page names the variables and
 * says who sets them. When the grant exists but the sync-mapping store is not
 * durable, the page says that too. This is a coach-only, noindex screen, so it
 * is allowed to name calendars — but the ids it prints are Jesse's own and must
 * never be lifted onto a public surface.
 */

import {Form, Link, redirect, useActionData, useLoaderData} from 'react-router';
import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import type {DemoAuthContext} from '~/lib/demoAuth';
import {requireDemoRole} from '~/lib/demoAuth';
import {Screen} from '~/components/ops/Screen';
import {Panel, Row} from '~/components/ops/Primitives';
import {
  OPERATING_TIME_ZONE,
  formatLongDateSafe,
  labelFromMinutes,
  minuteOfDay,
  wallClockFromRfc3339,
  fromUtcInstant,
  UNVERIFIED_AVAILABILITY_NOTE,
} from '~/lib/ops/availability';
import {dateOf} from '~/lib/ops/types';
import type {GoogleCalendarRef, GoogleContext} from '~/lib/ops/googleCalendar';
import {
  GOOGLE_SCOPES,
  GOOGLE_SCOPES_BYO_CALENDAR,
  JV_GOLD_CALENDAR_SUMMARY,
  MEMORY_LINK_STORE_NOTE,
  NOT_CONFIGURED_NOTE,
  NOT_CONNECTED_NOTE,
  SCOPE_MODE_NOTE,
  authorizeUrl,
  beginOAuthState,
  busySourcesFrom,
  clearGoogleTokens,
  consumeOAuthState,
  exchangeCode,
  fetchBusy,
  findOrCreateJvGoldCalendar,
  googleConfig,
  googleConnectionStatus,
  listCalendars,
  readBusyCalendarIds,
  readGoogleTokens,
  revokeGrant,
  windowForHorizon,
  writeBusyCalendarIds,
  writeGoogleTokens,
} from '~/lib/ops/googleCalendar';

export function meta() {
  return [
    {title: 'Connect Google Calendar — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

const SELF = '/private/calendar/connect';

/** How many days ahead the page probes free/busy, purely as proof of life. */
const PROBE_DAYS = 14;

/**
 * Callback outcomes, as codes. The URL carries the key; this table carries the
 * sentence. Nothing about the account ever travels in a query string.
 */
const STATUS_NOTES: Record<string, {tone: 'good' | 'bad'; text: string}> = {
  connected: {
    tone: 'good',
    text: 'Google Calendar is connected. Free/busy times are now being read from Jesse’s calendars.',
  },
  denied: {
    tone: 'bad',
    text: 'Google reported that the request was declined at the consent screen. Nothing was connected and nothing was shared.',
  },
  'state-mismatch': {
    tone: 'bad',
    text: 'That sign-in could not be matched to a request started on this device, so it was refused. Start the connection again from this page.',
  },
  'exchange-failed': {
    tone: 'bad',
    text: 'Google would not exchange the sign-in for a token. Nothing was connected. Check that the redirect URI registered in Google Cloud matches GOOGLE_REDIRECT_URI exactly, then try again.',
  },
  'not-configured': {
    tone: 'bad',
    text: NOT_CONFIGURED_NOTE,
  },
  disconnected: {
    tone: 'good',
    text: 'The Google grant was removed. Availability now reflects JV Gold bookings only.',
  },
};

/* ==========================================================================
 * LOADER — also the OAuth callback
 * ======================================================================== */

export async function loader({request, context}: LoaderFunctionArgs) {
  requireDemoRole(context as unknown as DemoAuthContext, 'coach');
  const ctx = context as unknown as GoogleContext;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  /* ---- the callback leg ------------------------------------------------ */
  if (oauthError) {
    // `access_denied` and friends. We do not echo Google's raw string.
    throw redirect(`${SELF}?status=denied`);
  }

  if (code) {
    const config = googleConfig(ctx.env);
    if (!config) throw redirect(`${SELF}?status=not-configured`);

    const state = consumeOAuthState(ctx, url.searchParams.get('state'));
    if (!state) throw redirect(`${SELF}?status=state-mismatch`);

    const exchanged = await exchangeCode(config, code);
    if (!exchanged.ok) throw redirect(`${SELF}?status=exchange-failed`);

    writeGoogleTokens(ctx, exchanged.value);
    // Clean URL: a spent authorisation code must not survive a refresh.
    throw redirect(`${state.returnTo}?status=connected`);
  }

  /* ---- the ordinary page ---------------------------------------------- */
  const status = googleConnectionStatus(ctx);
  const tokens = readGoogleTokens(ctx);

  let calendars: GoogleCalendarRef[] = [];
  let readProblem: string | null = null;
  let busyBlocks: number | null = null;
  let probeWindow: {from: string; to: string} | null = null;

  if (status.connected) {
    const list = await listCalendars(ctx);
    if (list.ok) {
      calendars = list.value;
      const sources = busySourcesFrom(calendars, readBusyCalendarIds(ctx));

      // "Today" is resolved through the Google boundary converter, on the
      // SERVER, and then serialised. Never in a component — the worker runs UTC
      // and the browser runs Pacific, and a component that asked would hydrate
      // to a different day than it rendered.
      const today = dateOf(fromUtcInstant(new Date().toISOString()));
      const window = windowForHorizon(today, PROBE_DAYS);
      probeWindow = {from: today, to: dateOf(window.to)};

      if (sources.length > 0) {
        const probe = await fetchBusy(ctx, {
          from: window.from,
          to: window.to,
          calendarIds: sources.map((calendar) => calendar.id),
        });
        if (probe.ok) {
          busyBlocks = probe.value.blocks.length;
          if (probe.value.errors.length > 0) {
            readProblem = `${probe.value.errors.length} of ${probe.value.calendarsQueried} calendars did not answer, so this view of the week is incomplete.`;
          }
        } else {
          readProblem = probe.error.message;
        }
      } else {
        busyBlocks = 0;
      }
    } else {
      readProblem = list.error.message;
    }
  }

  const selection = readBusyCalendarIds(ctx);
  const busySources = busySourcesFrom(calendars, selection);
  const busyIds = new Set(busySources.map((calendar) => calendar.id));

  return {
    status,
    // Rendered, never re-derived in the component.
    connectedLabel: tokens?.connectedAt ? instantLabel(tokens.connectedAt) : null,
    statusNote: STATUS_NOTES[url.searchParams.get('status') ?? ''] ?? null,
    calendars: calendars.map((calendar) => ({
      ...calendar,
      feedsBusy: busyIds.has(calendar.id),
    })),
    hasExplicitSelection: selection !== null,
    readProblem,
    busyBlocks,
    probeWindow,
    probeDays: PROBE_DAYS,
    scopes: [...GOOGLE_SCOPES],
    fallbackScopes: [...GOOGLE_SCOPES_BYO_CALENDAR],
    redirectUri: (ctx.env.GOOGLE_REDIRECT_URI ?? '').trim() || null,
    // The URI this deployment is actually reachable at, so a mismatch is
    // visible instead of mysterious.
    expectedRedirectUri: `${url.origin}${SELF}`,
    linkStoreNote: MEMORY_LINK_STORE_NOTE,
    timeZone: OPERATING_TIME_ZONE,
  };
}

/** `'2026-08-05T23:12:04.000Z'` → `'Wednesday, August 5, 2026 · 4:12 PM'`. */
function instantLabel(instant: string): string {
  try {
    const wall = wallClockFromRfc3339(instant);
    return `${formatLongDateSafe(dateOf(wall))} · ${labelFromMinutes(
      minuteOfDay(wall),
    )}`;
  } catch {
    return instant;
  }
}

/* ==========================================================================
 * ACTION
 * ======================================================================== */

interface ActionResult {
  tone: 'good' | 'bad';
  message: string;
}

const say = (tone: 'good' | 'bad', message: string): ActionResult => ({
  tone,
  message,
});

export async function action({request, context}: ActionFunctionArgs) {
  requireDemoRole(context as unknown as DemoAuthContext, 'coach');
  const ctx = context as unknown as GoogleContext;

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');

  /* ---- start OAuth ----------------------------------------------------- */
  if (intent === 'connect') {
    const config = googleConfig(ctx.env);
    if (!config) return say('bad', NOT_CONFIGURED_NOTE);

    const byo = String(form.get('mode') ?? '') === 'byo';
    const record = beginOAuthState(ctx, SELF);
    throw redirect(
      authorizeUrl(config, {
        state: record.state,
        scopes: byo ? GOOGLE_SCOPES_BYO_CALENDAR : GOOGLE_SCOPES,
      }),
    );
  }

  /* ---- drop the grant -------------------------------------------------- */
  if (intent === 'disconnect') {
    const tokens = readGoogleTokens(ctx);
    if (!tokens) return say('bad', 'There is no Google grant to remove.');
    const revoked = await revokeGrant(tokens);
    clearGoogleTokens(ctx);
    if (!revoked.ok) return say('bad', revoked.error.message);
    throw redirect(`${SELF}?status=disconnected`);
  }

  /* ---- find or create the JV GOLD calendar ----------------------------- */
  if (intent === 'jv-gold-calendar') {
    const pasted = String(form.get('calendarId') ?? '').trim();
    const status = googleConnectionStatus(ctx);
    if (!status.connected) return say('bad', NOT_CONNECTED_NOTE);

    const result = await findOrCreateJvGoldCalendar(ctx, {
      existingId: pasted || null,
      // Only the app-created scope can make a calendar. With the fallback
      // scopes we look, and say so if it is not there, rather than silently
      // failing at Google.
      allowCreate: status.scopeMode === 'app-created' && !pasted,
    });
    if (!result.ok) return say('bad', result.error.message);
    return say(
      'good',
      result.value.created
        ? `Created the "${JV_GOLD_CALENDAR_SUMMARY}" calendar on Jesse’s account. JV Gold sessions will be written there and nowhere else.`
        : `Using the existing "${JV_GOLD_CALENDAR_SUMMARY}" calendar (${result.value.id}).`,
    );
  }

  /* ---- which calendars feed busy --------------------------------------- */
  if (intent === 'busy-sources') {
    const status = googleConnectionStatus(ctx);
    if (!status.connected) return say('bad', NOT_CONNECTED_NOTE);

    if (String(form.get('reset') ?? '') === 'default') {
      writeBusyCalendarIds(ctx, null);
      return say(
        'good',
        'Reset to the default: every calendar except JV GOLD and the holiday/birthday feeds.',
      );
    }

    const chosen = form
      .getAll('calendarId')
      .map((value) => String(value))
      .filter(Boolean);
    if (chosen.length === 0) {
      return say(
        'bad',
        'At least one calendar has to feed busy time, otherwise availability would claim Jesse is free whenever he is not. Nothing was changed.',
      );
    }
    writeBusyCalendarIds(ctx, chosen);
    return say(
      'good',
      `${chosen.length} calendar${chosen.length === 1 ? '' : 's'} will now remove time from customer availability.`,
    );
  }

  return say('bad', 'Unknown request. Nothing was changed.');
}

/* ==========================================================================
 * VIEW
 * ======================================================================== */

export default function ConnectGoogleCalendarRoute() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const {status} = data;

  /**
   * One notice, one announcement. `<Screen notice>` already renders a
   * role="status" region, so the tone is folded into the sentence rather than
   * duplicated into a second live region a screen reader would read twice.
   */
  const notice = result
    ? {tone: result.tone, text: result.message}
    : data.statusNote ?? null;
  const noticeText = notice
    ? `${notice.tone === 'bad' ? 'Not done — ' : ''}${notice.text}`
    : null;

  const redirectMismatch =
    data.redirectUri !== null && data.redirectUri !== data.expectedRedirectUri;

  return (
    <Screen
      eyebrow="Integrations"
      title="Google Calendar"
      subtitle="Sessions out to one calendar. Everything else in as opaque busy time."
      back={{to: '/private/calendar', label: 'The session book'}}
      notice={noticeText ?? undefined}
      noticeRole="status"
      className="space-y-16"
    >
      {/* ---- STATE ------------------------------------------------------ */}
      <Panel
        label="Connection"
        meta={
          status.connected
            ? `Connected${data.connectedLabel ? ` · ${data.connectedLabel}` : ''}`
            : status.configured
              ? 'Not connected'
              : 'Not configured'
        }
      >
        {!status.configured ? (
          <div className="space-y-5">
            <p className="ops-mute max-w-[62ch]">{NOT_CONFIGURED_NOTE}</p>
            <ul aria-label="Missing environment variables">
              {status.missingEnv.map((key, index) => (
                <Row key={key} first={index === 0} className="py-3">
                  <code className="tabular">{key}</code>
                </Row>
              ))}
            </ul>
            <p className="ops-mute max-w-[62ch]">
              Sam sets these on the Oxygen deployment (and in <code>.env</code>{' '}
              for local work) from a Google Cloud project with the Calendar API
              enabled. Until they exist there is no consent screen to send Jesse
              to, so the button below stays off.
            </p>
            <button className="ops-btn" type="button" disabled>
              Connect Google Calendar
            </button>
          </div>
        ) : !status.connected ? (
          <div className="space-y-5">
            <p className="ops-mute max-w-[62ch]">{NOT_CONNECTED_NOTE}</p>
            <p className="ops-mute max-w-[62ch]">
              {UNVERIFIED_AVAILABILITY_NOTE}
            </p>
            <Form method="post" className="flex flex-wrap items-center gap-4">
              <input type="hidden" name="intent" value="connect" />
              <button className="ops-btn ops-btn-primary" type="submit">
                Connect Google Calendar
              </button>
              <button
                className="ops-btn ops-btn-quiet"
                type="submit"
                name="mode"
                value="byo"
              >
                Connect for a calendar I made myself
              </button>
            </Form>
            <p className="ops-mute max-w-[62ch]">
              The second button asks for broader event permission and is only
              needed if the <strong>{JV_GOLD_CALENDAR_SUMMARY}</strong> calendar
              already exists because Jesse created it by hand.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <dl>
              <Row as="div" first className="py-3 flex justify-between gap-6">
                <dt className="tag ops-panel-label">Permission level</dt>
                <dd className="ops-mute text-right max-w-[52ch]">
                  {SCOPE_MODE_NOTE[status.scopeMode]}
                </dd>
              </Row>
              <Row as="div" className="py-3 flex justify-between gap-6">
                <dt className="tag ops-panel-label">Scopes granted</dt>
                <dd className="text-right">
                  <ul>
                    {status.scopes.map((scope) => (
                      <li key={scope} className="tabular ops-mute">
                        {scope.replace('https://www.googleapis.com/auth/', '')}
                      </li>
                    ))}
                  </ul>
                </dd>
              </Row>
              <Row as="div" className="py-3 flex justify-between gap-6">
                <dt className="tag ops-panel-label">Free/busy check</dt>
                <dd className="ops-mute text-right max-w-[52ch]">
                  {data.readProblem
                    ? data.readProblem
                    : data.busyBlocks === null
                      ? 'Not run.'
                      : `${data.busyBlocks} busy block${
                          data.busyBlocks === 1 ? '' : 's'
                        } in the next ${data.probeDays} days${
                          data.probeWindow
                            ? `, ${data.probeWindow.from} to ${data.probeWindow.to}`
                            : ''
                        }. Times only — no titles were requested or returned.`}
                </dd>
              </Row>
            </dl>

            {status.needsReconnect ? (
              <p className="ops-warn max-w-[62ch]">
                This grant carries no refresh token, so it will stop working
                when the current access token expires. Disconnect and connect
                again to fix it permanently.
              </p>
            ) : null}

            <Form method="post">
              <input type="hidden" name="intent" value="disconnect" />
              <button className="ops-btn" type="submit">
                Disconnect and revoke
              </button>
            </Form>
          </div>
        )}
      </Panel>

      {/* ---- WHAT MOVES, IN WHICH DIRECTION ----------------------------- */}
      <Panel label="What this connection does" meta="Read one way, write the other">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="tag ops-panel-label">Read in — all other calendars</h3>
            <p className="ops-mute max-w-[52ch]">
              Every calendar on Jesse’s account is queried through Google’s
              <strong> free/busy </strong>
              endpoint. That endpoint returns a start and an end and literally
              nothing else — no title, no description, no attendees, no
              location. Those hours are removed from customer availability as
              plain <em>unavailable</em>. A customer can never see “dentist”,
              because this app never receives the word.
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="tag ops-panel-label">
              Write out — the {JV_GOLD_CALENDAR_SUMMARY} calendar
            </h3>
            <p className="ops-mute max-w-[52ch]">
              JV Gold sessions are written to one dedicated secondary calendar
              named <strong>{JV_GOLD_CALENDAR_SUMMARY}</strong>, in{' '}
              {data.timeZone}. Each event carries the athlete and the focus, the
              same as the session book — it is Jesse’s own calendar and his own
              roster. No attendees are added, so no invitation email ever
              reaches a family by accident. Nothing outside this one calendar is
              ever created, changed or deleted.
            </p>
          </div>
        </div>
        <p className="ops-mute mt-8 max-w-[72ch]">{data.linkStoreNote}</p>
      </Panel>

      {/* ---- BUSY SOURCES ----------------------------------------------- */}
      <Panel
        label="Calendars that remove availability"
        meta={
          status.connected
            ? data.hasExplicitSelection
              ? 'Chosen by hand'
              : 'Default selection'
            : 'Needs a connection'
        }
      >
        {!status.connected ? (
          <p className="ops-mute max-w-[62ch]">
            Nothing to list yet. Connect the account above and Jesse’s calendars
            appear here, each one switchable.
          </p>
        ) : data.calendars.length === 0 ? (
          <p className="ops-mute max-w-[62ch]">
            {data.readProblem ??
              'Google returned no calendars for this account, which is unusual. Try disconnecting and reconnecting.'}
          </p>
        ) : (
          <Form method="post" className="space-y-6">
            <input type="hidden" name="intent" value="busy-sources" />
            <fieldset className="border-0 p-0 m-0">
              <legend className="ops-sr">
                Calendars whose events remove time from customer availability
              </legend>
              <ul>
                {data.calendars.map((calendar, index) => (
                  <Row
                    key={calendar.id}
                    first={index === 0}
                    className="py-4 flex items-start gap-4"
                  >
                    <input
                      type="checkbox"
                      id={`cal-${index}`}
                      name="calendarId"
                      value={calendar.id}
                      defaultChecked={calendar.feedsBusy}
                      disabled={calendar.isJvGold}
                      className="mt-1"
                    />
                    <label htmlFor={`cal-${index}`} className="min-w-0">
                      <span className="block">{calendar.label}</span>
                      <span className="block ops-mute tabular break-words">
                        {calendar.id}
                      </span>
                      {calendar.isJvGold ? (
                        <span className="block ops-mute">
                          This is the calendar JV Gold writes to. Reading it back
                          would count every session twice, so it is held off.
                        </span>
                      ) : calendar.noise ? (
                        <span className="block ops-mute">
                          A holiday or birthday feed. Off by default — turning it
                          on would make every public holiday unbookable.
                        </span>
                      ) : null}
                    </label>
                  </Row>
                ))}
              </ul>
            </fieldset>
            <div className="flex flex-wrap gap-4">
              <button className="ops-btn ops-btn-primary" type="submit">
                Save busy sources
              </button>
              <button
                className="ops-btn ops-btn-quiet"
                type="submit"
                name="reset"
                value="default"
              >
                Back to the default
              </button>
            </div>
          </Form>
        )}
      </Panel>

      {/* ---- THE JV GOLD CALENDAR --------------------------------------- */}
      <Panel
        label={`The ${JV_GOLD_CALENDAR_SUMMARY} calendar`}
        meta={status.jvGoldCalendarId ? 'Resolved' : 'Not resolved yet'}
      >
        {!status.connected ? (
          <p className="ops-mute max-w-[62ch]">
            The calendar can only be found or created once an account is
            connected.
          </p>
        ) : (
          <div className="space-y-6">
            <p className="ops-mute max-w-[62ch]">
              {status.jvGoldCalendarId
                ? 'Sessions are written here. Jesse can rename, recolour, hide or share this calendar without affecting anything else — but renaming it away from the exact words above means this app will look for it and make a new one.'
                : `No calendar has been resolved yet. ${
                    status.scopeMode === 'app-created'
                      ? 'The button below looks for one named exactly “' +
                        JV_GOLD_CALENDAR_SUMMARY +
                        '” and creates it only if it is genuinely absent.'
                      : 'The current permission level cannot create a calendar. Create it in Google Calendar and paste its id below.'
                  }`}
            </p>
            {status.jvGoldCalendarId ? (
              <p className="tabular break-words">{status.jvGoldCalendarId}</p>
            ) : null}

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="jv-gold-calendar" />
              <div className="max-w-[42rem] space-y-2">
                <label htmlFor="calendarId" className="tag ops-panel-label">
                  Existing calendar id (optional)
                </label>
                <input
                  type="text"
                  id="calendarId"
                  name="calendarId"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="…@group.calendar.google.com"
                  aria-describedby="calendarId-help"
                  className="w-full border-b bg-transparent py-2 tabular"
                  // The register owns the hairline colour; naming a Tailwind
                  // grey here would break inside .ops-dark.
                  style={{borderColor: 'var(--line)'}}
                />
                <p id="calendarId-help" className="ops-mute">
                  Leave this empty to find or create the calendar automatically.
                  Fill it in only when Jesse made the calendar himself — copy the
                  Calendar ID from its settings page in Google Calendar.
                </p>
              </div>
              <button className="ops-btn ops-btn-primary" type="submit">
                {status.jvGoldCalendarId
                  ? 'Re-check the calendar'
                  : 'Find or create the calendar'}
              </button>
            </Form>
          </div>
        )}
      </Panel>

      {/* ---- WHAT TO REGISTER IN GOOGLE CLOUD --------------------------- */}
      <Panel label="Google Cloud registration" meta="For whoever sets the env vars">
        <dl>
          <Row as="div" first className="py-4">
            <dt className="tag ops-panel-label">Authorised redirect URI</dt>
            <dd className="tabular mt-2 break-words">
              {data.expectedRedirectUri}
            </dd>
            {redirectMismatch ? (
              <dd className="ops-warn mt-2 max-w-[62ch]">
                GOOGLE_REDIRECT_URI is currently set to{' '}
                <span className="tabular">{data.redirectUri}</span>, which is not
                the URI this deployment is reachable at. Google compares these
                byte for byte and will refuse the exchange.
              </dd>
            ) : null}
          </Row>
          <Row as="div" className="py-4">
            <dt className="tag ops-panel-label">Scopes to request</dt>
            <dd className="mt-2">
              <ul>
                {data.scopes.map((scope) => (
                  <li key={scope} className="tabular break-words">
                    {scope}
                  </li>
                ))}
              </ul>
            </dd>
          </Row>
          <Row as="div" className="py-4">
            <dt className="tag ops-panel-label">
              Fallback scopes (hand-made calendar only)
            </dt>
            <dd className="mt-2">
              <ul>
                {data.fallbackScopes.map((scope) => (
                  <li key={scope} className="tabular ops-mute break-words">
                    {scope}
                  </li>
                ))}
              </ul>
            </dd>
          </Row>
        </dl>
        <p className="ops-mute mt-8 max-w-[72ch]">
          These are server-to-server calls made from the Oxygen worker, so no
          Content-Security-Policy change is needed — CSP governs what the browser
          may load, and the browser never talks to Google here.
        </p>
        <p className="ops-mute mt-4 max-w-[72ch]">
          Back to <Link to="/private/calendar">the session book</Link>.
        </p>
      </Panel>
    </Screen>
  );
}
