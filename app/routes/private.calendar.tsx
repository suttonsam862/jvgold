/**
 * ============================================================================
 * /private/calendar — the coach calendar and the session book
 * ============================================================================
 *
 * Month / Week / Day over Jesse's REAL logged sessions, plus the events still
 * only living in his Google Calendar. The page renders through <Screen>, which
 * owns the register class, the sticky masthead and the measure — 1180px here
 * rather than the hub's 1440px, set by `.cal-screen` in calendar.css, because a
 * seven-column time grid stops being readable long before a table does.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE BLOCKS COME FROM
 * ---------------------------------------------------------------------------
 * JV GOLD BLOCKS are built from `~/lib/ops/history` — the 45 rows imported out
 * of `SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm`, with `HISTORY_SESSION_META`
 * carrying his verbatim Package Type / Training Type / Payment Method cells
 * alongside the canonical ids. That is what makes "tap a session and edit it"
 * mean something: the form opens on HIS values, including the drifted ones.
 *
 * A row whose clock he never wrote down (27 of the 45) becomes an ALL-DAY
 * block, never a midnight one. `HISTORY_SESSION_META.startTimeRecorded` says
 * so explicitly and the sheet prints "Time not recorded".
 *
 * GOOGLE BLOCKS are carried over from the seed untouched. They are the only
 * events on this page that are not his book, they stay `readOnly` until
 * claimed, and none of them names a private person.
 *
 * ---------------------------------------------------------------------------
 * PRIVACY
 * ---------------------------------------------------------------------------
 * This route is coach-only and `noindex`. It is the one place in the project
 * that carries real client names — several of them minors — so nothing here
 * may ever be lifted into a meta tag, an OG image, an analytics payload or any
 * public loader. The names go into the page body and nowhere else.
 */

import {useMemo} from 'react';
import {useActionData, useLoaderData} from 'react-router';
import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import type {DemoAuthContext} from '~/lib/demoAuth';
import {requireDemoRole} from '~/lib/demoAuth';
import {OFFERINGS, TIME_BANDS} from '~/lib/offerings';
import {OPS_DATASET} from '~/lib/ops/seed';
import {
  HISTORY_ANCHOR_DATE,
  HISTORY_CLIENTS,
  HISTORY_SESSIONS,
  historyMetaFor,
} from '~/lib/ops/history';
import type {HistorySession} from '~/lib/ops/history';
import type {CalendarEvent, IsoDate} from '~/lib/ops/types';
import {addDays} from '~/lib/ops/types';
import {getPaymentMethod, getTrainingType} from '~/lib/ops/vocabulary';
import type {IncomeStreamId, TrainingTypeId} from '~/lib/ops/vocabulary';
import {CalendarShell} from '~/components/calendar/CalendarShell';
import {startOfWeek} from '~/components/calendar/layout';
import type {
  CalendarFormData,
  ClientPrefill,
  RosterClient,
  SessionLog,
  SettlementId,
  SlotOption,
} from '~/components/calendar/sessionModel';
import {
  availabilityFromEvents,
  centsLabel,
} from '~/components/calendar/sessionModel';
import {Screen} from '~/components/ops/Screen';
import {Figure} from '~/components/ops/Primitives';
import styles from '~/styles/calendar.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  // No client name, no figure, no description. Everything on this page is
  // private and the tab title is the only thing that leaves it.
  return [
    {title: 'Calendar — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/* ==========================================================================
 * BUILDING THE FORM'S VOCABULARY OUT OF HIS OWN HISTORY
 * ======================================================================== */

/** `'Kade Kean'` → `'KK'`. Two letters, uppercase, no punctuation. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Which income stream a session belongs to, read off the training type and the
 * club his "Family" column records. Never a guess dressed as a fact: anything
 * that is not clearly club or camp work falls to Personal Training, which is
 * what his Dashboard calls it.
 */
function streamFor(
  trainingTypeId: TrainingTypeId | null,
  clubRaw: string,
): IncomeStreamId {
  if (trainingTypeId === 'camp-clinic') return 'future-champions';
  if (trainingTypeId === 'club-practice' || trainingTypeId === 'drill') {
    return /deep\s*waters/i.test(clubRaw) ? 'deep-waters' : 'personal-training';
  }
  return 'personal-training';
}

/**
 * One client's usual row, taken from their own most recent LOGGED session.
 * This is what makes the fast path fast: choosing the name fills the package,
 * the rate, the method and the training type, and he changes nothing.
 */
function prefillFor(clientId: string): ClientPrefill | null {
  const sessions = HISTORY_SESSIONS.filter((s) =>
    s.athleteIds.includes(clientId),
  );
  // Walk backwards: the most recent row he actually filled in is the best
  // description of what he does with this athlete now.
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    const meta = historyMetaFor(session.id);
    if (!meta || !meta.logged) continue;

    const training = getTrainingType(meta.trainingTypeId);
    const method = getPaymentMethod(meta.paymentMethodId);
    const paidCents = meta.paidCents ?? 0;
    const settlement = settlementFromHistory(
      paidCents,
      meta.owedCents ?? 0,
      session.sessionsUsed,
    );
    // The tile has to read the same way the receipt line does. A prepaid draw
    // is not "unpaid" — the family already bought that hour — and saying so on
    // the picker would put the wrong idea in his head before he taps.
    const summaryParts = [
      training?.label ?? 'Session',
      settlement === 'prepaid'
        ? 'prepaid'
        : paidCents > 0
          ? centsLabel(paidCents)
          : 'unpaid',
    ];
    if (method) summaryParts.push(method.label);

    return {
      trainingTypeId: meta.trainingTypeId,
      packageTypeId: meta.packageTypeId,
      paymentMethodId: meta.paymentMethodId,
      incomeStreamId: streamFor(meta.trainingTypeId, meta.clubAffiliationRaw),
      settlement,
      paidCents,
      durationMinutes: session.minutes || 60,
      startMinutes: meta.startTimeRecorded
        ? Number(session.start.slice(11, 13)) * 60 +
          Number(session.start.slice(14, 16))
        : null,
      sessionsUsed: meta.sessionsUsedRaw ?? 1,
      summary: `Usually ${summaryParts.join(' · ')}`,
    };
  }
  return null;
}

/**
 * The one-tap amounts. His four canonical rates come first; anything else he
 * has actually collected more than once is folded in, so the chips describe
 * his book rather than a price list. Cents throughout.
 */
function amountChips(): number[] {
  const canonical = [0, 10000, 15000, 20000];
  const counts = new Map<number, number>();
  for (const session of HISTORY_SESSIONS) {
    const meta = historyMetaFor(session.id);
    const cents = meta?.paidCents;
    if (cents == null || cents <= 0) continue;
    counts.set(cents, (counts.get(cents) ?? 0) + 1);
  }
  const recurring = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([cents]) => cents);
  return [...new Set([...canonical, ...recurring])].sort((a, b) => a - b);
}

/**
 * The time-slot chips, lifted straight out of the published rate card in
 * `~/lib/offerings` so the calendar and the booking flow agree on what a
 * session time is. Deduplicated by clock, sorted, tagged with their band.
 */
function slotOptions(): SlotOption[] {
  const byMinutes = new Map<number, SlotOption>();
  for (const offering of OFFERINGS) {
    if (offering.mode !== 'single-date') continue;
    for (const slots of Object.values(offering.availability)) {
      for (const slot of slots) {
        const minutes = minutesFromSlotLabel(slot.label);
        if (minutes == null || byMinutes.has(minutes)) continue;
        byMinutes.set(minutes, {
          id: slot.id,
          label: slot.label,
          minutes,
          band: slot.band,
        });
      }
    }
  }
  return [...byMinutes.values()].sort((a, b) => a.minutes - b.minutes);
}

/** `'4:00 PM'` → `960`. Pure string work; no `Date`, no `Intl`. */
function minutesFromSlotLabel(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!match) return null;
  const hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  const pm = match[3].toUpperCase() === 'PM';
  return (hour + (pm ? 12 : 0)) * 60 + minute;
}

/**
 * The note chips: locations and contexts that ACTUALLY recur in his notes. A
 * pattern with no hits in the book is dropped rather than offered — the row
 * describes his work, it does not prescribe it.
 */
const NOTE_PATTERNS: ReadonlyArray<{label: string; test: RegExp}> = [
  {label: 'Home Garage', test: /garage|@\s*home/i},
  {label: 'Riverside Submission', test: /riv(erside)?\s*sub/i},
  {label: 'Deep Waters practice', test: /deep\s*waters/i},
  {label: 'Pre-workout drill', test: /pre\s*wor?ko?ut|drill/i},
  {label: 'Tournament', test: /tournament|iewa/i},
  {label: 'Lift', test: /lift/i},
  {label: 'Open room', test: /open\s*room/i},
  {label: 'Small group', test: /small\s*group/i},
  {label: 'Beach', test: /beach/i},
  {label: 'JW North HS', test: /jw\s*north/i},
  {label: 'Great Oak HS', test: /great\s*oak/i},
  {label: 'First session', test: /1st\s*session/i},
];

function noteChips(): string[] {
  const counts = NOTE_PATTERNS.map((pattern) => ({
    label: pattern.label,
    count: HISTORY_SESSIONS.filter(
      (s) => pattern.test.test(s.notes) || pattern.test.test(s.location),
    ).length,
  }));
  return counts
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

/**
 * The lengths in his book — 60 for a private, 90 for a lift, 120 for a
 * practice, 180 and 240 for tournament days — plus a 30-minute consultation
 * that his rate card publishes but the book has not seen yet.
 */
function durationChips(): number[] {
  const found = new Set<number>([30, 60, 90]);
  for (const session of HISTORY_SESSIONS) {
    if (session.minutes > 0) found.add(session.minutes);
  }
  return [...found].sort((a, b) => a - b);
}

/** One book row → one calendar block. */
function eventFromHistory(session: HistorySession, index: number): CalendarEvent {
  const meta = historyMetaFor(session.id);
  const client = HISTORY_CLIENTS.find((c) =>
    session.athleteIds.includes(c.id),
  );
  const training = getTrainingType(meta?.trainingTypeId ?? null);
  // No recorded clock is an ALL-DAY block, never a midnight one.
  const timed = meta?.startTimeRecorded === true;
  const date = session.start.slice(0, 10);

  return {
    id: `book-${String(index + 1).padStart(3, '0')}`,
    source: 'jvgold',
    title: `${client?.name ?? 'Session'} · ${
      training?.label ?? (meta?.rawTrainingType || 'Session')
    }`,
    start: timed ? session.start : `${date}T00:00:00`,
    end: timed ? session.end : `${addDays(date, 1)}T00:00:00`,
    allDay: !timed,
    location: session.location || null,
    description: session.notes || null,
    sessionId: session.id,
    kind: session.kind,
    offeringId: session.offeringId,
    athleteIds: session.athleteIds,
    amountCents: session.amountCents,
    googleEventId: null,
    calendarId: null,
    colorId: null,
    recurrence: null,
    attendees: [],
    readOnly: false,
    claimed: true,
    syncedAt: null,
  };
}

/**
 * How an imported row was settled.
 *
 * His book has no settlement column, so this reads the two it does have. Money
 * recorded means it was settled outside Shopify — cash and Zelle are most of
 * the book. Money owed with nothing paid is a debt, which is "outside" too and
 * NOT a comp. A row with a session used, nothing paid and nothing owed is a
 * draw against a package that was bought earlier.
 *
 * Nothing imports as COMPED. A comp is a decision he made, and the book has no
 * record of him making one — inventing it here would put a gift in the ledger
 * that he never gave.
 */
function settlementFromHistory(
  paidCents: number,
  owedCents: number,
  sessionsUsed: number,
): SettlementId {
  if (paidCents > 0 || owedCents > 0) return 'outside';
  if (sessionsUsed > 0) return 'prepaid';
  return 'outside';
}

/** One book row → the vocabulary the calendar block cannot carry. */
function logFromHistory(session: HistorySession): SessionLog | null {
  const meta = historyMetaFor(session.id);
  if (!meta) return null;
  return {
    clientId: meta.clientId,
    trainingTypeId: meta.trainingTypeId,
    packageTypeId: meta.packageTypeId,
    paymentMethodId: meta.paymentMethodId,
    incomeStreamId: streamFor(meta.trainingTypeId, meta.clubAffiliationRaw),
    settlement: settlementFromHistory(
      meta.paidCents ?? 0,
      meta.owedCents ?? 0,
      session.sessionsUsed,
    ),
    // The resolved count, not the raw cell: a blank "Sessions Used" is not a
    // zero, and `HistorySession.sessionsUsed` is where the importer already
    // made that call.
    sessionsUsed: session.sessionsUsed,
    paidCents: meta.paidCents ?? 0,
    owedCents: meta.owedCents ?? 0,
    durationMinutes: session.minutes,
    startRecorded: meta.startTimeRecorded,
    // His cells, verbatim, carried through every edit.
    rawTrainingType: meta.rawTrainingType,
    rawPackageType: meta.rawPackageType,
    rawPaymentMethod: meta.rawPaymentMethod,
    storage: 'book',
  };
}

/* ==========================================================================
 * SHOPIFY ADMIN — the invoice seam
 *
 * The ONLY server-side write on this page. Credentials are read off
 * `context.env` and never leave it: no token, no domain and no error body from
 * Shopify is serialised into a loader payload or an action result.
 *
 * `env.d.ts` does not declare the Admin token (this route may not edit it), so
 * the env is read through a narrow index signature rather than `any`. Add the
 * declarations there and this cast can go.
 * ======================================================================== */

/** Env names the Shopify tooling in `scripts/` already accepts, in order. */
const ADMIN_TOKEN_KEYS = [
  'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_TOKEN',
] as const;

const ADMIN_API_VERSION = '2026-04';

interface AdminCredentials {
  domain: string;
  token: string;
}

/** Credentials, or a sentence saying exactly what is missing. Never both. */
function adminCredentials(
  env: Record<string, string | undefined>,
): {ok: true; value: AdminCredentials} | {ok: false; detail: string} {
  const rawDomain = (env.PUBLIC_STORE_DOMAIN ?? '').trim();
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const tokenKey = ADMIN_TOKEN_KEYS.find((key) => (env[key] ?? '').trim());
  const token = tokenKey ? (env[tokenKey] ?? '').trim() : '';

  if (!domain || domain === 'mock.shop') {
    return {
      ok: false,
      detail:
        'The store is not linked — PUBLIC_STORE_DOMAIN still points at mock.shop, which has no Admin API and no customers. Link the JV Gold store before invoicing anyone.',
    };
  }
  if (!token) {
    return {
      ok: false,
      detail:
        'No Shopify Admin API token is set in this environment. Invoicing needs a custom app on the store with write_draft_orders and read_customers, and its token in SHOPIFY_ADMIN_API_ACCESS_TOKEN.',
    };
  }
  return {ok: true, value: {domain, token}};
}

interface AdminResult {
  data: Record<string, unknown> | null;
  /** A message safe to print. Never the raw Shopify body. */
  error: string | null;
}

async function adminGraphql(
  credentials: AdminCredentials,
  query: string,
  variables: Record<string, unknown>,
): Promise<AdminResult> {
  try {
    const response = await fetch(
      `https://${credentials.domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The only place the token is used. Never logged, never returned.
          'X-Shopify-Access-Token': credentials.token,
        },
        body: JSON.stringify({query, variables}),
      },
    );

    if (!response.ok) {
      return {
        data: null,
        error: `Shopify refused the request (HTTP ${response.status}). Nothing was created.`,
      };
    }

    const payload = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: {message?: string}[];
    };

    if (payload.errors?.length) {
      const first = payload.errors[0]?.message ?? 'unknown error';
      return {data: null, error: `Shopify rejected the request: ${first}`};
    }
    return {data: payload.data ?? null, error: null};
  } catch {
    // A network failure is indistinguishable from a wrong domain from here,
    // and neither one created anything.
    return {
      data: null,
      error: 'Could not reach Shopify. Nothing was created.',
    };
  }
}

/** Shape the two mutations return, narrowed at the point of use. */
interface UserError {
  field?: string[] | null;
  message?: string;
}

function firstUserError(errors: UserError[] | undefined): string | null {
  if (!errors || errors.length === 0) return null;
  return errors[0]?.message ?? 'Shopify rejected the request.';
}

const DRAFT_ORDER_CREATE = `#graphql
  mutation JvGoldDraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl }
      userErrors { field message }
    }
  }
`;

const DRAFT_ORDER_INVOICE_SEND = `#graphql
  mutation JvGoldDraftOrderInvoiceSend($id: ID!) {
    draftOrderInvoiceSend(id: $id) {
      draftOrder { id name }
      userErrors { field message }
    }
  }
`;

/* ==========================================================================
 * LOADER
 * ======================================================================== */

export async function loader({context}: LoaderFunctionArgs) {
  // Coach role only. Throws a redirect to /private when signed out.
  const auth = context as unknown as DemoAuthContext;
  requireDemoRole(auth, 'coach');
  const env = auth.env as unknown as Record<string, string | undefined>;

  const bookEvents = HISTORY_SESSIONS.map(eventFromHistory);
  const sessionLogs: Record<string, SessionLog> = {};
  HISTORY_SESSIONS.forEach((session, i) => {
    const log = logFromHistory(session);
    if (log) sessionLogs[bookEvents[i].id] = log;
  });

  // Google stays exactly as the seed holds it: imported, read-only until
  // claimed, and never carrying a private person's name.
  const googleEvents = OPS_DATASET.calendar.filter(
    (event) => event.source === 'google',
  );
  const events = [...bookEvents, ...googleEvents];

  const clients: RosterClient[] = HISTORY_CLIENTS.map((client) => ({
    id: client.id,
    name: client.name,
    initials: initialsOf(client.name),
    status: client.status,
    clubLabel: client.clubAffiliationRaw,
    lastSessionAt: client.lastSessionAt,
    sessionCount: client.loggedSessionCount,
    // A missing count is 0 banked sessions, which correctly disables the
    // prepaid settlement rather than offering a draw against an unknown.
    prepaidRemaining: client.packages.remaining ?? 0,
    shopifyCustomerId: client.shopifyCustomerId,
  }));

  const prefills: Record<string, ClientPrefill> = {};
  for (const client of HISTORY_CLIENTS) {
    const prefill = prefillFor(client.id);
    if (prefill) prefills[client.id] = prefill;
  }

  const google =
    OPS_DATASET.integrations.find((entry) => entry.id === 'google-calendar') ??
    null;

  // Credentials are TESTED here and thrown away. Only the boolean and the
  // sentence cross to the browser — never the domain, never the token.
  const admin = adminCredentials(env);

  const formData: CalendarFormData = {
    clients,
    prefills,
    amountChips: amountChips(),
    slots: slotOptions(),
    bands: TIME_BANDS.map((band) => ({id: band.id, label: band.label})),
    noteChips: noteChips(),
    durationChips: durationChips(),
    // Computed here so the FIRST render is server-side and deterministic. The
    // shell recomputes it from its live event list, so a lesson logged a minute
    // ago in this browser is a conflict for the next one.
    //
    // "now" is fixed to the book's anchor, never `new Date()`: the server runs
    // UTC and the browser runs Pacific, so a derived "now" would make the two
    // renders disagree. Staff logging ignores past/notice/horizon anyway, so
    // this value has to be stable, not current.
    availability: availabilityFromEvents(
      events,
      google?.state === 'connected',
      `${HISTORY_ANCHOR_DATE}T00:00:00`,
    ),
    invoicingConfigured: admin.ok,
    invoicingDetail: admin.ok ? '' : admin.detail,
  };
  const googleCalendarId =
    googleEvents.find((event) => event.calendarId)?.calendarId ?? null;

  // The calendar opens on the last week in his book rather than on the browser's
  // idea of today, so the first thing on screen is work he can recognise. The
  // figure below is computed here, against that fixed anchor, so it renders
  // identically on the server and in the browser.
  const anchorDate: IsoDate = HISTORY_ANCHOR_DATE;
  const weekStart = startOfWeek(anchorDate);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = HISTORY_SESSIONS.filter((session) => {
    const day = session.start.slice(0, 10);
    return day >= weekStart && day <= weekEnd;
  });
  const matMinutes = inWeek.reduce((total, s) => total + s.minutes, 0);
  const collected = inWeek.reduce(
    (total, s) => total + (historyMetaFor(s.id)?.paidCents ?? 0),
    0,
  );

  return {
    events,
    sessionLogs,
    formData,
    anchorDate,
    google,
    googleCalendarId,
    summary: {
      sessions: inWeek.length,
      matHours: Math.round(matMinutes / 6) / 10,
      collected,
      weekStart,
      weekEnd,
    },
  };
}

/**
 * Two intents.
 *
 * `connect-google` is the stub the "Connect Google Calendar" button posts to:
 * it reports what is actually missing rather than starting a fake OAuth flow.
 *
 * `send-invoice` is REAL. It creates a Shopify draft order for the athlete's
 * payer and emails it, through `draftOrderCreate` then
 * `draftOrderInvoiceSend`. Every way it can fail is reported as a sentence the
 * coach can act on, and none of them is silent:
 *
 *   - the store is not linked, or no Admin token is set   → what to set
 *   - the athlete has no Shopify customer id yet          → where to fix it
 *   - Shopify rejects the mutation                        → its own message
 *
 * The last of those is the reason the invoice is sent in two calls rather than
 * one: if `draftOrderInvoiceSend` fails after `draftOrderCreate` succeeded, a
 * draft order EXISTS and is unsent, and the coach is told that exactly rather
 * than being told the whole thing failed and creating a second one.
 */
export async function action({request, context}: ActionFunctionArgs) {
  const auth = context as unknown as DemoAuthContext;
  requireDemoRole(auth, 'coach');

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');

  if (intent === 'connect-google') {
    return {
      ok: false,
      message:
        'OAuth is not configured on this environment. Connecting needs a Google Cloud project with the Calendar API enabled, a client id and secret in the environment, and this site’s callback URL on the authorised redirect list. Until those exist there is nothing to hand off to, so nothing was connected and no data left this page.',
    };
  }

  if (intent !== 'send-invoice') {
    return {ok: false, message: 'Unknown request. Nothing was changed.'};
  }

  /* ---------------------------------------------------------- the client */

  const clientId = String(form.get('clientId') ?? '');
  const client = HISTORY_CLIENTS.find((entry) => entry.id === clientId) ?? null;
  if (!client) {
    return {
      ok: false,
      message:
        'That athlete is not on the roster, so no invoice was created. Invoices can only go to an existing client record.',
    };
  }

  if (!client.shopifyCustomerId) {
    // The honest dead end, with the way out. Failing quietly here would leave
    // the coach believing an invoice is on its way to a parent who never got
    // one and cannot be found in Shopify at all.
    return {
      ok: false,
      message: `${client.name} has no Shopify customer record yet, so there is nobody to invoice. Open their client record at /private/clients?client=${client.id} and connect them to Shopify first. Nothing was created.`,
    };
  }

  const amountCents = Number(form.get('amountCents') ?? 0);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return {
      ok: false,
      message: 'Set an amount above zero before sending an invoice.',
    };
  }

  /* ----------------------------------------------------- the credentials */

  const env = auth.env as unknown as Record<string, string | undefined>;
  const admin = adminCredentials(env);
  if (!admin.ok) return {ok: false, message: `${admin.detail} Nothing was created.`};

  /* ------------------------------------------------------- the two calls */

  const date = String(form.get('date') ?? '');
  const title = String(form.get('title') ?? 'Coaching session');

  const created = await adminGraphql(admin.value, DRAFT_ORDER_CREATE, {
    input: {
      customerId: client.shopifyCustomerId,
      // A custom line item, not a variant: a logged lesson is not a product in
      // the catalogue, and inventing a variant id would fail on a real store.
      lineItems: [
        {
          title: `${title}${date ? ` · ${date}` : ''}`,
          originalUnitPrice: (amountCents / 100).toFixed(2),
          quantity: 1,
        },
      ],
      tags: ['jvgold', 'coaching-session'],
    },
  });

  if (created.error) return {ok: false, message: created.error};

  const createPayload = created.data?.draftOrderCreate as
    | {
        draftOrder?: {id?: string; name?: string; invoiceUrl?: string} | null;
        userErrors?: UserError[];
      }
    | undefined;

  const createError = firstUserError(createPayload?.userErrors);
  if (createError) {
    return {ok: false, message: `${createError} Nothing was created.`};
  }

  const draftId = createPayload?.draftOrder?.id;
  const draftName = createPayload?.draftOrder?.name ?? 'the draft order';
  if (!draftId) {
    return {
      ok: false,
      message: 'Shopify returned no draft order id, so nothing was sent.',
    };
  }

  const sent = await adminGraphql(admin.value, DRAFT_ORDER_INVOICE_SEND, {
    id: draftId,
  });

  if (sent.error) {
    return {
      ok: false,
      message: `${draftName} was created in Shopify but the email did not go out: ${sent.error} Send it from Shopify admin rather than creating a second draft order.`,
    };
  }

  const sendError = firstUserError(
    (sent.data?.draftOrderInvoiceSend as {userErrors?: UserError[]} | undefined)
      ?.userErrors,
  );
  if (sendError) {
    return {
      ok: false,
      message: `${draftName} was created in Shopify but the email did not go out: ${sendError} Send it from Shopify admin rather than creating a second draft order.`,
    };
  }

  return {
    ok: true,
    message: `Invoice ${draftName} created in Shopify and emailed to ${client.name}’s account. It stays in the owed column here until it is paid.`,
  };
}

export default function PrivateCalendarRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  /**
   * The week at a glance, in the masthead. `accent` is bronze on the light
   * ground and gold inside .ops-dark — one call site, legible in either
   * register, which is exactly why these are <Figure>s and not hand-rolled
   * `text-gold` spans.
   */
  const summaryFigures = useMemo(
    () => [
      {label: 'Sessions', value: String(data.summary.sessions), accent: true},
      {
        label: 'Mat hours',
        value: data.summary.matHours.toFixed(1),
        accent: false,
      },
      {
        label: 'Collected',
        value: centsLabel(data.summary.collected),
        accent: false,
      },
    ],
    [data.summary],
  );

  return (
    <Screen
      rootClassName="cal-screen"
      eyebrow="Calendar"
      title="The session book"
      subtitle="Your logged sessions, and everything still only in Google."
      back={{to: '/private/dashboard', label: 'Management view'}}
      actions={
        <dl className="flex gap-7">
          {summaryFigures.map((figure) => (
            <Figure
              key={figure.label}
              variant="definition"
              size="sm"
              label={figure.label}
              value={figure.value}
              accent={figure.accent}
            />
          ))}
        </dl>
      }
    >
      <CalendarShell
        events={data.events}
        sessionLogs={data.sessionLogs}
        formData={data.formData}
        anchorDate={data.anchorDate}
        google={data.google}
        googleCalendarId={data.googleCalendarId}
        connectMessage={actionData?.message ?? null}
      />
    </Screen>
  );
}
