/**
 * ============================================================================
 * PRIVATE — DASHBOARD  (Jesse's coach hub)
 * ============================================================================
 *
 * NOW READING HIS REAL BOOK. Everything on this screen comes from
 * `~/lib/ops/history` — the import of SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm
 * — rather than from the de-identified `~/lib/ops/seed` preview. The previous
 * version rendered "Athlete 01" behind a sample-data banner; the banner now
 * states what was imported and how current it is.
 *
 * PRIVACY. This route is behind `requireDemoRole(context, 'coach')` and, in
 * production, row-level security. Real names are correct HERE and nowhere else.
 * Several of these athletes are minors, so:
 *   - `meta()` carries a generic title and `robots: noindex`. No name, no
 *     description, no OG image, ever.
 *   - nothing on this screen is passed to an analytics call, a log line or a
 *     query string.
 * If any part of this file is ever copied to a public route, the data import
 * must not come with it.
 *
 * ANCHORED TO THE BOOK, NOT TO TODAY. `HISTORY_ANCHOR_DATE` is 2026-07-05 — the
 * LAST dated row in his spreadsheet. "Today" on this screen means "the last day
 * the book knows about", and the masthead says so. Anchoring to `Date.now()`
 * would render one thing on a UTC server and another in a Pacific browser and
 * hand React a hydration mismatch; anchoring to the book also stops the screen
 * claiming a quiet day when the truth is simply that nothing has been entered.
 *
 * BLANK IS NOT ZERO. His book leaves the Training Type, the time and the amount
 * blank on a lot of rows. Those import as `null` and render as "not recorded" —
 * never as a default, never as "12:00 AM", never as $0.
 *
 * LAYOUT: unchanged. Dense data grid, one session per scannable row, the four
 * things he opens this screen for — the day, the week, the roster, the money —
 * above the fold on a 1440x900 laptop. Colour comes from the `.ops` tokens via
 * the shared primitives; gold is a fill, never type.
 *
 * React 18: no `use()`, no async component, no browser API outside an effect.
 */

import {Form, Link} from 'react-router';
import {Dot, Figure, Meter, Panel, Row} from '~/components/ops/Primitives';
import {Screen} from '~/components/ops/Screen';
import {PrivateMark} from '~/components/private/PrivateMark';
import {requireDemoRole} from '~/lib/demoAuth';
import {
  HISTORY_ANCHOR_DATE,
  HISTORY_CLIENTS,
  HISTORY_DATE_RANGE,
  HISTORY_IMPORT_REPORT,
  HISTORY_MAY_DASHBOARD,
  HISTORY_PAYMENTS,
  HISTORY_SESSIONS,
  historyMetaFor,
  type HistoryClient,
  type HistorySession,
} from '~/lib/ops/history';
import {getIncomeStream} from '~/lib/ops/vocabulary';
import {
  addDays,
  dateOf,
  formatClock,
  formatMoney,
  sumCents,
  weekdayOfIso,
  type ClientId,
  type ClientStatus,
  type IsoDate,
  type SessionStatus,
} from '~/lib/ops/types';
import type {Route} from './+types/private.dashboard';

/**
 * No name, no athlete count, no money in the document head. A <meta> tag is a
 * public surface even on a private route — it lands in browser history, in a
 * shared screenshot and in anything that scrapes the tab title.
 */
export function meta() {
  return [
    {title: 'Management View — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only — a /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');
  return null;
}

/* ==========================================================================
 * PURE DATE HELPERS
 *
 * No `Date`, no `Intl`: a civil string in, a civil string out. A `Date`-derived
 * label renders one way on a UTC server and another in a Pacific browser, which
 * is a hydration mismatch waiting to happen.
 * ======================================================================== */

const WEEKDAYS =
  'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ');

const MONTHS =
  'January February March April May June July August September October November December'.split(
    ' ',
  );

/** `'2026-07-05'` → `'Sun'`. */
function dayAbbr(iso: IsoDate): string {
  return WEEKDAYS[weekdayOfIso(iso)].slice(0, 3);
}

/** `'2026-07-05'` → `'Jul 5'`. */
function shortDate(iso: IsoDate): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(
    iso.slice(8, 10),
  )}`;
}

/** `'2026-07-05'` → `'Sunday, July 5'`. */
function longDate(iso: IsoDate): string {
  return `${WEEKDAYS[weekdayOfIso(iso)]}, ${
    MONTHS[Number(iso.slice(5, 7)) - 1]
  } ${Number(iso.slice(8, 10))}`;
}

/** `'2026-05'` → `'May 2026'`. */
function monthLabel(key: string): string {
  return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/* ==========================================================================
 * HIS BOOK, DERIVED
 *
 * Module scope so the server and the first client paint compute identically.
 * Nothing below reads the clock, the network or the DOM.
 * ======================================================================== */

/** The last dated row in the spreadsheet. Not today. */
const ANCHOR_DATE: IsoDate = HISTORY_ANCHOR_DATE;

/** id → the name as it should be shown. Authenticated screens only. */
const NAME_BY_ID: Record<ClientId, string> = Object.fromEntries(
  HISTORY_CLIENTS.map((client) => [client.id, client.name]),
);

function namesFor(ids: readonly ClientId[]): string {
  return ids.map((id) => NAME_BY_ID[id] ?? id).join(', ');
}

/**
 * His verbatim Training Type cell — 'STRENGTH', 'DRILL', 'Small Group',
 * '1-on-1 w Grey Oshiro (partner)'. Shown as he typed it rather than folded to
 * the canonical label, because rewriting his history in the display is exactly
 * what the import was built to avoid. A blank cell says so out loud.
 */
function typeLabel(session: HistorySession): string {
  const raw = historyMetaFor(session.id)?.rawTrainingType.trim() ?? '';
  return raw === '' ? 'Not recorded' : raw;
}

/** `false` when no clock could be read out of his note — render a dash. */
function hasClock(session: HistorySession): boolean {
  return historyMetaFor(session.id)?.startTimeRecorded ?? false;
}

/** A row he pre-filled with a date and nothing else. */
function isLogged(session: HistorySession): boolean {
  return historyMetaFor(session.id)?.logged ?? false;
}

const anchorSessions = HISTORY_SESSIONS.filter(
  (session) => dateOf(session.start) === ANCHOR_DATE,
);

const anchorAthletes = new Set(
  anchorSessions.flatMap((session) => session.athleteIds),
).size;

/** One day of the strip: the seven days ending on the anchor. */
interface WeekDay {
  date: IsoDate;
  sessions: HistorySession[];
  /** Rows carrying real evidence, as opposed to a bare pre-filled date. */
  logged: number;
  names: string;
}

const weekSchedule: WeekDay[] = Array.from({length: 7}, (_, index) => {
  const date = addDays(ANCHOR_DATE, index - 6);
  const sessions = HISTORY_SESSIONS.filter(
    (session) => dateOf(session.start) === date,
  );
  return {
    date,
    sessions,
    logged: sessions.filter(isLogged).length,
    names: namesFor([
      ...new Set(sessions.flatMap((session) => session.athleteIds)),
    ]),
  };
});

const sessionsThisWeek = weekSchedule.reduce(
  (total, day) => total + day.sessions.length,
  0,
);

const loggedThisWeek = weekSchedule.reduce(
  (total, day) => total + day.logged,
  0,
);

/** Sorted so whoever owes money is at the top of the roster panel. */
const roster: readonly HistoryClient[] = [...HISTORY_CLIENTS].sort((a, b) =>
  b.balanceCents - a.balanceCents ||
  (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
);

const owingClients = HISTORY_CLIENTS.filter(
  (client) => client.balanceCents > 0,
);

/** The tabs that actually record a purchased package to burn down. */
const packageClients = roster.filter(
  (client) => (client.packages.purchased ?? 0) > 0,
);

const outstandingTotalCents = sumCents(
  owingClients.map((client) => client.balanceCents),
);

/** Every dollar his session log actually records as collected. */
const collectedCents = sumCents(
  HISTORY_PAYMENTS.map((payment) => payment.amountCents),
);

/**
 * Every month the book spans, including the ones he collected nothing in. A
 * month is not dropped for being empty — an empty July is a fact about the
 * book, and hiding it would flatter the run of months either side of it.
 */
const collectedByMonth: {month: string; cents: number; rows: number}[] = (() => {
  const out: {month: string; cents: number; rows: number}[] = [];
  let year = Number(HISTORY_DATE_RANGE.first.slice(0, 4));
  let month = Number(HISTORY_DATE_RANGE.first.slice(5, 7));
  const lastYear = Number(HISTORY_DATE_RANGE.last.slice(0, 4));
  const lastMonth = Number(HISTORY_DATE_RANGE.last.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    out.push({
      month: key,
      cents: HISTORY_IMPORT_REPORT.paymentTotalByMonth[key] ?? 0,
      rows: HISTORY_SESSIONS.filter(
        (session) => dateOf(session.start).slice(0, 7) === key,
      ).length,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
})();

/** Months in the book where he logged rows but recorded no money at all. */
const unpaidMonths = collectedByMonth.filter(
  (entry) => entry.cents === 0 && entry.rows > 0,
);

/** His own May Dashboard, transcribed. NOT derived from the session rows. */
const dashboardStreamSumCents = sumCents(
  HISTORY_MAY_DASHBOARD.byStream.map((stream) => stream.cents),
);

const mayFromSessionLog =
  HISTORY_IMPORT_REPORT.paymentTotalByMonth[HISTORY_MAY_DASHBOARD.month] ?? 0;

const sessionsWithoutClock = HISTORY_SESSIONS.filter(
  (session) => !hasClock(session),
).length;

const bankedSessions = HISTORY_CLIENTS.reduce(
  (total, client) => total + (client.packages.remaining ?? 0),
  0,
);

/* ==========================================================================
 * DISPLAY MAPS
 * ======================================================================== */

type DotTone = 'accent' | 'mute' | 'ink' | 'warn';

/**
 * `status` on an imported row is not a booking state — it is whether the row
 * carries any evidence at all. 'completed' means he wrote something on it;
 * 'scheduled' means he pre-filled the date and stopped. The labels say that
 * rather than pretending the book holds a schedule it does not hold.
 */
const SESSION_STATUS: Record<SessionStatus, {label: string; tone: DotTone}> = {
  scheduled: {label: 'Date only', tone: 'mute'},
  completed: {label: 'Logged', tone: 'ink'},
  cancelled: {label: 'Cancelled', tone: 'mute'},
  'no-show': {label: 'No-show', tone: 'warn'},
};

/**
 * His five statuses, exactly as the Lists sheet spells them. Nothing here
 * invents a sixth — the tone map is keyed off the domain union so the compiler
 * catches it if anyone tries.
 */
const CLIENT_STATUS_TONE: Record<ClientStatus, DotTone> = {
  Active: 'accent',
  Trial: 'ink',
  'Paid In Full': 'accent',
  'Owes Balance': 'warn',
  Inactive: 'mute',
};

const HUB_SECTIONS = [
  {to: '/private/calendar', label: 'Calendar'},
  {to: '/private/clients', label: 'Clients'},
  {to: '/private/finance', label: 'Finance'},
  {to: '/private/products', label: 'Products'},
];

/* ==========================================================================
 * PAGE
 * ======================================================================== */

export default function PrivateDashboardPage() {
  return (
    <Screen
      mark={<PrivateMark className="hidden h-9 w-auto sm:block" />}
      eyebrow="Management View"
      title="Welcome back, Jesse"
      subtitle={`Last row in the book — ${longDate(ANCHOR_DATE)}. ${
        anchorSessions.length === 1 ? '1 session' : `${anchorSessions.length} sessions`
      }, ${anchorAthletes === 1 ? '1 athlete' : `${anchorAthletes} athletes`}.`}
      nav={HUB_SECTIONS}
      navLabel="Management sections"
      notice={`Your book, imported from SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm — ${HISTORY_IMPORT_REPORT.importedRowCount} session rows across ${HISTORY_IMPORT_REPORT.clientCount} clients, ${shortDate(
        HISTORY_DATE_RANGE.first,
      )} to ${shortDate(
        HISTORY_DATE_RANGE.last,
      )} 2026. Figures are anchored to the last row in the book, not to today.`}
      actions={
        <Form method="post" action="/private/logout">
          <button type="submit" className="ops-btn ops-btn-quiet">
            Log Out
          </button>
        </Form>
      }
    >
      {/* ------------------------------------------------------- STAT RAIL
          Four figures on two hairlines. Exactly one is accented — that
          restraint is the whole system. */}
      <section aria-label="Book snapshot" data-reveal>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y ops-rule py-4 sm:grid-cols-4">
          <Figure
            variant="definition"
            size="sm"
            accent
            value={formatMoney(collectedCents)}
            label="Collected"
            sub={`${HISTORY_PAYMENTS.length} payments in the log`}
          />
          <Figure
            variant="definition"
            size="sm"
            value={HISTORY_SESSIONS.length}
            label="Session rows"
            sub={`${HISTORY_IMPORT_REPORT.perClient.reduce(
              (total, client) => total + client.logged,
              0,
            )} carry detail`}
          />
          <Figure
            variant="definition"
            size="sm"
            value={HISTORY_CLIENTS.length}
            label="Clients"
            sub={`${bankedSessions} sessions banked`}
          />
          <Figure
            variant="definition"
            size="sm"
            tone="warn"
            value={formatMoney(outstandingTotalCents)}
            label="Outstanding"
            sub={
              owingClients.length === 1
                ? '1 account owes'
                : `${owingClients.length} accounts owe`
            }
          />
        </dl>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-10 xl:gap-x-14">
        {/* =============================================== LAST DAY + WEEK */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Panel
            label={`Book — ${shortDate(ANCHOR_DATE)}`}
            meta={`${anchorSessions.length} row${
              anchorSessions.length === 1 ? '' : 's'
            } · ${anchorAthletes} athlete${anchorAthletes === 1 ? '' : 's'}`}
            delay="60ms"
          >
            {/* The grid scrolls sideways rather than dropping a column: on a
                390px phone every field is still reachable. */}
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
              <table className="ops-table min-w-[44rem] text-sm">
                <caption className="ops-sr">
                  Every row dated {longDate(ANCHOR_DATE)} in the imported
                  session log.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-5">
                      Time
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Type
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Athlete
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Note
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Location
                    </th>
                    <th scope="col" className="py-2">
                      Row
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {anchorSessions.map((session) => {
                    const status = SESSION_STATUS[session.status];
                    const clocked = hasClock(session);
                    return (
                      <tr key={session.id}>
                        {/* Deliberately a <td>: `.ops-table th` is uppercase
                            10px with its own hairline, which is right for a
                            column header and wrong for a time. */}
                        <td className="tabular ops-ink whitespace-nowrap py-3 pr-5">
                          {clocked ? (
                            formatClock(session.start)
                          ) : (
                            <>
                              <span aria-hidden="true" className="ops-mute">
                                &mdash;
                              </span>
                              <span className="ops-sr">Time not recorded</span>
                            </>
                          )}
                        </td>
                        <td className="ops-mute whitespace-nowrap py-3 pr-5">
                          {typeLabel(session)}
                        </td>
                        <td className="ops-ink py-3 pr-5">
                          {namesFor(session.athleteIds)}
                        </td>
                        <td className="ops-ink py-3 pr-5">
                          {session.notes || (
                            <span className="ops-mute">Nothing written</span>
                          )}
                        </td>
                        <td className="ops-mute py-3 pr-5">
                          {session.location || '—'}
                        </td>
                        <td className="ops-mute whitespace-nowrap py-3">
                          <Dot tone={status.tone} className="mr-2" />
                          {status.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {anchorSessions.length === 0 ? (
              <p className="ops-mute mt-3 text-xs">
                No row in the book carries this date.
              </p>
            ) : null}
          </Panel>

          <Panel
            label="The Week Before It"
            meta={`${sessionsThisWeek} rows · ${loggedThisWeek} with detail`}
            className="mt-8"
            delay="100ms"
          >
            {/* Seven cells across on a laptop, seven rows on a phone. Either
                way the week is one glance, not a scroll. */}
            <ol className="ops-grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7">
              {weekSchedule.map((day) => {
                const isAnchor = day.date === ANCHOR_DATE;
                return (
                  <li
                    key={day.date}
                    aria-current={isAnchor ? 'date' : undefined}
                    className="p-3"
                  >
                    <p className="flex items-baseline justify-between gap-3">
                      <span
                        className={`tabular text-xs uppercase tracking-[0.16em] ${
                          isAnchor ? 'ops-accent' : 'ops-mute'
                        }`}
                      >
                        {isAnchor ? (
                          <Dot tone="accent" className="mr-2" />
                        ) : null}
                        {dayAbbr(day.date)} {Number(day.date.slice(8, 10))}
                      </span>
                      <span className="tabular ops-ink text-sm">
                        {day.sessions.length === 0 ? '—' : day.sessions.length}
                      </span>
                    </p>
                    <p className="ops-mute mt-1 text-xs leading-relaxed">
                      {day.sessions.length === 0
                        ? 'Nothing entered'
                        : day.logged === 0
                          ? `${day.names} — date only`
                          : day.names}
                    </p>
                  </li>
                );
              })}
            </ol>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              A row counted here exists in the book. {loggedThisWeek} of{' '}
              {sessionsThisWeek} carry anything beyond the date — the rest are
              pre-filled and still waiting on you.
            </p>
          </Panel>
        </div>

        {/* ================================================ ROSTER + MONEY */}
        <div className="lg:col-span-5 xl:col-span-4">
          <Panel
            label="Roster"
            meta={`${roster.length} clients · ${
              HISTORY_CLIENTS.filter((client) => client.status === 'Active')
                .length
            } active`}
            delay="140ms"
          >
            <ul>
              {roster.map((client, index) => (
                <Row
                  key={client.id}
                  first={index === 0}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="min-w-0 truncate">
                    <span className="ops-ink text-sm">{client.name}</span>
                    <span className="ops-mute ml-2 text-xs">
                      {client.packages.name ?? 'No package'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-4">
                    <span className="tabular ops-mute text-xs">
                      {client.packages.remaining === null
                        ? `${client.packages.used ?? 0} used`
                        : `${client.packages.remaining} left`}
                    </span>
                    <span className="ops-mute w-[7.5rem] text-right text-xs">
                      <Dot
                        tone={CLIENT_STATUS_TONE[client.status]}
                        className="mr-2"
                      />
                      {client.status}
                    </span>
                  </span>
                </Row>
              ))}
            </ul>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              Status is derived from the Owed column, not recorded in the book.
              Your Dashboard says {HISTORY_MAY_DASHBOARD.activeClients} active
              clients; there are {HISTORY_CLIENTS.length} real client tabs.{' '}
              <Link to="/private/clients" className="ops-accent underline">
                Open the roster
              </Link>
              .
            </p>
          </Panel>

          {/* Package burn-down, straight off his Sessions Used / Remaining
              columns. A meter is a fill, which is the only place gold is
              allowed to be gold on this ground. */}
          <Panel
            label="Packages"
            meta={`${bankedSessions} sessions banked`}
            className="mt-8"
            delay="160ms"
          >
            <ul>
              {packageClients.map((client, index) => {
                const purchased = client.packages.purchased ?? 0;
                const used = client.packages.used ?? 0;
                return (
                  <Row
                    key={client.id}
                    first={index === 0}
                    className="flex items-center gap-4 py-2.5"
                  >
                    <span className="ops-ink min-w-0 flex-1 truncate text-sm">
                      {client.name}
                    </span>
                    <Meter
                      used={used}
                      total={purchased}
                      label={`${client.name} package`}
                      valueText={`${used} of ${purchased} sessions used`}
                      className="w-24 shrink-0"
                    />
                    <span className="tabular ops-mute w-20 shrink-0 text-right text-xs">
                      {used}/{purchased}
                    </span>
                  </Row>
                );
              })}
            </ul>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              {packageClients.length} of {HISTORY_CLIENTS.length} client tabs
              carry a purchased count. The rest are billed per session, so there
              is no bank to burn down.
            </p>
          </Panel>

          <Panel
            label="Outstanding"
            meta={`${owingClients.length} account${
              owingClients.length === 1 ? '' : 's'
            } · ${formatMoney(outstandingTotalCents)}`}
            className="mt-8"
            delay="180ms"
          >
            {owingClients.length === 0 ? (
              <p className="ops-mute text-sm">
                Nothing in the Owed column across the whole book.
              </p>
            ) : (
              <ul>
                {owingClients.map((client, index) => (
                  <Row
                    key={client.id}
                    first={index === 0}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="ops-ink text-sm">{client.name}</span>
                      <span className="tabular ops-mute ml-2 text-xs">
                        {client.paymentCount} payment
                        {client.paymentCount === 1 ? '' : 's'} logged
                      </span>
                    </span>
                    <span className="tabular ops-warn w-20 shrink-0 text-right text-sm">
                      {formatMoney(client.balanceCents)}
                    </span>
                  </Row>
                ))}
              </ul>
            )}
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              Your May Dashboard reports outstanding at{' '}
              {formatMoney(HISTORY_MAY_DASHBOARD.outstandingCents)}. The Owed
              column says {formatMoney(outstandingTotalCents)}. Both are shown
              because the book does not settle it.
            </p>
          </Panel>
        </div>
      </div>

      {/* --------------------------------------------------- MONEY POSITION
          Three figures for the same month that do not agree. The session log
          leads because it is the only one with rows behind it; his own
          Dashboard totals sit beside it, labelled, rather than being averaged
          away or quietly dropped. */}
      <Panel
        label="Money Position"
        meta={`${shortDate(HISTORY_DATE_RANGE.first)} — ${shortDate(
          HISTORY_DATE_RANGE.last,
        )} 2026`}
        className="mt-8"
        delay="60ms"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Figure
                variant="definition"
                size="sm"
                accent
                value={formatMoney(collectedCents)}
                label="Session log, all months"
                sub="What the rows actually add up to"
              />
              <Figure
                variant="definition"
                size="sm"
                value={formatMoney(mayFromSessionLog)}
                label="Session log, May"
                sub="Same rows, May only"
              />
              <Figure
                variant="definition"
                size="sm"
                tone="mute"
                value={formatMoney(HISTORY_MAY_DASHBOARD.incomeCents)}
                label="Your Dashboard, May income"
                sub="Your figure, not derived"
              />
              <Figure
                variant="definition"
                size="sm"
                tone="mute"
                value={formatMoney(dashboardStreamSumCents, {cents: true})}
                label="Your May streams, summed"
                sub={`${HISTORY_MAY_DASHBOARD.byStream.length} income streams`}
              />
            </dl>
            <p className="ops-mute mt-5 text-xs leading-relaxed">
              Those three May figures disagree by{' '}
              {formatMoney(
                HISTORY_MAY_DASHBOARD.incomeCents - mayFromSessionLog,
              )}{' '}
              and{' '}
              {formatMoney(
                dashboardStreamSumCents - HISTORY_MAY_DASHBOARD.incomeCents,
                {cents: true},
              )}
              . Nothing here picks a winner.{' '}
              <Link to="/private/finance" className="ops-accent underline">
                The full reconciliation is on Finance
              </Link>
              .
            </p>
          </div>

          <div className="lg:col-span-3">
            <p className="tag ops-mute">Collected by month</p>
            <ul className="mt-3">
              {collectedByMonth.map((entry, index) => {
                const empty = entry.cents === 0;
                return (
                  <Row
                    key={entry.month}
                    first={index === 0}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className={`text-sm ${empty ? 'ops-mute' : 'ops-ink'}`}>
                      {monthLabel(entry.month)}
                      <span className="tabular ops-mute ml-2 text-xs">
                        {entry.rows} row{entry.rows === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span
                      className={`tabular text-sm ${
                        empty ? 'ops-mute' : 'ops-ink'
                      }`}
                    >
                      {formatMoney(entry.cents)}
                    </span>
                  </Row>
                );
              })}
            </ul>
            {unpaidMonths.length ? (
              <p className="ops-mute mt-3 text-xs leading-relaxed">
                {unpaidMonths
                  .map(
                    (entry) =>
                      `${monthLabel(entry.month)} has ${entry.rows} dated row${
                        entry.rows === 1 ? '' : 's'
                      }`,
                  )
                  .join(', ')}{' '}
                and no payment recorded against any of them.
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-4">
            <p className="tag ops-mute">Your May income streams</p>
            <ul className="mt-3">
              {HISTORY_MAY_DASHBOARD.byStream.map((stream, index) => {
                const def = getIncomeStream(stream.incomeStreamId);
                return (
                  <Row
                    key={stream.incomeStreamId}
                    first={index === 0}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="ops-ink text-sm">
                        {def?.label ?? stream.incomeStreamId}
                      </span>
                      {def?.invented ? (
                        <span className="ops-mute ml-2 text-xs">
                          not on your Lists sheet
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular ops-ink shrink-0 text-sm">
                      {formatMoney(stream.cents, {cents: true})}
                    </span>
                  </Row>
                );
              })}
            </ul>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              Transcribed from your Dashboard. Only the Personal Training line
              has session rows behind it; club dues, camps, the CBU stipend and
              merch are never entered as sessions.
            </p>
          </div>
        </div>
      </Panel>

      {/* ------------------------------------------------------ PROVENANCE
          What the importer did, in full. This replaces the invented "Upcoming
          Camps" block — his book has no camp registrations in it, and a screen
          that shows fabricated camps beside real clients is worse than a screen
          with one fewer panel. */}
      <Panel
        label="What Was Imported"
        meta={`${HISTORY_IMPORT_REPORT.sourceRowCount} source rows · ${HISTORY_IMPORT_REPORT.importedRowCount} imported`}
        className="mt-8"
        delay="100ms"
      >
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-x-10">
          <div>
            <p className="tag ops-mute">Per client</p>
            <ul className="mt-3">
              {HISTORY_IMPORT_REPORT.perClient.map((entry, index) => (
                <Row
                  key={entry.clientId}
                  first={index === 0}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <span className="ops-ink min-w-0 truncate text-sm">
                    {entry.name}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-4">
                    <span className="tabular ops-mute text-xs">
                      {entry.logged}/{entry.sessions} rows
                    </span>
                    <span className="tabular ops-ink w-20 text-right text-sm">
                      {formatMoney(entry.paidCents)}
                    </span>
                  </span>
                </Row>
              ))}
            </ul>
          </div>

          <div>
            <p className="tag ops-mute">Wording folded together</p>
            <ul className="mt-3">
              {HISTORY_IMPORT_REPORT.aliased.map((alias, index) => (
                <Row
                  key={`${alias.vocabulary}-${alias.raw}`}
                  first={index === 0}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <span className="ops-ink min-w-0 truncate text-sm">
                    {alias.raw}
                  </span>
                  <span className="ops-mute shrink-0 text-xs">
                    {alias.canonicalLabel}
                  </span>
                </Row>
              ))}
            </ul>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              Your wording is kept on every row; these are only grouped together
              for counting.{' '}
              {HISTORY_IMPORT_REPORT.unmapped.length === 0
                ? 'Nothing was dropped for want of a match.'
                : `${HISTORY_IMPORT_REPORT.unmapped.length} values still need a home.`}
            </p>
          </div>

          <div>
            <p className="tag ops-mute">Held back</p>
            <ul className="mt-3">
              {HISTORY_IMPORT_REPORT.skipped.map((row, index) => (
                <Row
                  key={`${row.sheet}-${row.sourceRow}`}
                  first={index === 0}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <span className="ops-ink text-sm">{row.sheet}</span>
                  <span className="ops-mute shrink-0 text-xs">
                    Empty template tab
                  </span>
                </Row>
              ))}
            </ul>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              {sessionsWithoutClock} of {HISTORY_SESSIONS.length} rows have no
              readable start time in the note, so those sessions show a dash
              rather than a made-up clock.
            </p>
          </div>
        </div>
      </Panel>
    </Screen>
  );
}
