/**
 * ============================================================================
 * /private/finance — THE MONEY VIEW
 * ============================================================================
 *
 * Behind the coach gate. Jesse's private cockpit for the business: what came
 * in, where it came from, who paid it, and what is still owed.
 *
 * NOW HIS REAL BOOK. Every figure derives from `~/lib/ops/history` — the import
 * of SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm — not from the de-identified
 * `~/lib/ops/seed` preview this screen used to render.
 *
 * ------------------------------------------------------------------------
 * THE DISCREPANCY IS THE POINT
 * ------------------------------------------------------------------------
 * Three numbers claim to describe May 2026 and no two of them agree:
 *
 *   $4,900      what his session rows actually add up to in May
 *   $11,075     what his Dashboard reports as May income
 *   $15,874.50  what his Dashboard's own income-by-stream rows sum to
 *
 * This screen shows the session log as the PRIMARY figure, because it is the
 * only one with rows behind it that can be audited, and it prints his two
 * Dashboard figures beside it as separately labelled lines. It does not pick a
 * winner, it does not average them, and it does not quietly drop the two that
 * are inconvenient. `HISTORY_RECONCILIATION` drives a table that states every
 * gap in dollars. A finance screen that hides a discrepancy is worse than
 * useless.
 *
 * Some of the gap is expected and says so: club dues, camps, the CBU stipend
 * and merch are never entered as session rows, so the session log CANNOT equal
 * total income. The rest is not expected and is flagged as such.
 *
 * ------------------------------------------------------------------------
 * HOW IT IS PUT TOGETHER
 * ------------------------------------------------------------------------
 * The loader flattens the imported book into a narrow, serialisable payload.
 * Everything on screen is then derived in the browser by
 * `computeFinance(payload, period)` — one pure function — which is why the
 * period switcher can recompute the KPIs, the charts and the ranked lists
 * without a navigation or a second round trip.
 *
 * CHARTS ARE HAND-ROLLED SVG. There is no chart library on this page and there
 * cannot be: the CSP is strict and same-origin. Every plot here is the existing
 * `~/components/finance` SVG.
 *
 * DETERMINISM: no `Date.now()`, no `Math.random()`, no `new Date()`. "Today" is
 * `HISTORY_ANCHOR_DATE` — 2026-07-05, the last dated row in his book, not the
 * wall clock. Server and browser render byte-identical markup.
 *
 * MONEY: integer cents end to end, formatted exactly once at the render edge
 * with `formatMoney`. No float ever touches a dollar. His stream figures carry
 * real half-dollars ($2,174.50), so those are rendered `{cents: true}` — a
 * silent rounding would be one more number that does not tie out.
 *
 * PRIVACY: this route is coach-gated and, in production, behind row-level
 * security, which is what makes real names correct here. `meta()` is a generic
 * title plus `robots: noindex` — no name, no money and no client count reaches
 * the document head, an OG image, a sitemap, a query string or an analytics
 * payload. Several of these athletes are minors.
 */

import {useMemo, useState} from 'react';
import {Form, Link} from 'react-router';
import {requireDemoRole} from '~/lib/demoAuth';
import {Screen} from '~/components/ops/Screen';
import {Panel, Row} from '~/components/ops/Primitives';
import {
  HISTORY_ANCHOR_DATE,
  HISTORY_CLIENTS,
  HISTORY_DATE_RANGE,
  HISTORY_IMPORT_REPORT,
  HISTORY_MAY_DASHBOARD,
  HISTORY_PAYMENTS,
  HISTORY_RECONCILIATION,
  HISTORY_SESSIONS,
} from '~/lib/ops/history';
import {getIncomeStream} from '~/lib/ops/vocabulary';
import {
  formatMoney,
  monthKeyOf,
  percentOf,
  sumCents,
  type IsoDate,
  type SessionKind,
} from '~/lib/ops/types';
import {PrivateMark} from '~/components/private/PrivateMark';
import {
  computeFinance,
  DEFAULT_PERIOD,
  periodById,
  type FinanceMonthRow,
  type FinancePayload,
  type FinanceSessionRow,
  type PeriodId,
  type RankedRow,
} from '~/components/finance/model';
// Panel now comes from ~/components/ops/Primitives — the canonical copy, whose
// prop surface is a superset of the finance one. Only the motion hooks are
// still local to this feature.
import {
  useEntered,
  useIntroWindow,
  useMotion,
} from '~/components/finance/primitives';
import {KpiRow} from '~/components/finance/KpiRow';
import {MonthlyRevenueChart} from '~/components/finance/MonthlyRevenueChart';
import {CumulativeLine} from '~/components/finance/CumulativeLine';
import {RankedBars} from '~/components/finance/RankedBars';
import {PeriodSwitcher} from '~/components/finance/PeriodSwitcher';
import financeStyles from '~/styles/finance.css?url';
import type {Route} from './+types/private.finance';

/**
 * private.css is gone from this list. It was here for exactly one class —
 * `.private-sticky` on the old masthead — and <Screen> owns the sticky header
 * now. Nothing else on this route or in ~/components/finance touches a
 * `.private-*` class, so the stylesheet was a request for nothing.
 */
export function links() {
  return [{rel: 'stylesheet', href: financeStyles}];
}

export function meta() {
  return [
    {title: 'Finance — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/* ==========================================================================
 * HIS BOOK, FLATTENED
 * ======================================================================== */

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Every month key from the first dated row to the last, inclusive. */
function monthKeysBetween(first: IsoDate, last: IsoDate): string[] {
  const out: string[] = [];
  let year = Number(first.slice(0, 4));
  let month = Number(first.slice(5, 7));
  const lastYear = Number(last.slice(0, 4));
  const lastMonth = Number(last.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** `'2026-05'` → `'May 2026'`. String work only — no `Date`, no `Intl`. */
function monthLabelLong(key: string): string {
  return `${MONTH_FULL[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

const BOOK_MONTHS = monthKeysBetween(
  HISTORY_DATE_RANGE.first,
  HISTORY_DATE_RANGE.last,
);

/**
 * One bar per month the book covers, including the months he worked and
 * collected nothing. A month is not dropped for being empty — an empty July is
 * a fact about the book, and hiding it would flatter the trend line.
 */
const BOOK_MONTH_ROWS: FinanceMonthRow[] = BOOK_MONTHS.map((month) => {
  const inMonth = HISTORY_PAYMENTS.filter((p) => monthKeyOf(p.date) === month);
  return {
    month,
    label: MONTH_ABBR[Number(month.slice(5, 7)) - 1],
    grossCents: sumCents(inMonth.map((p) => p.amountCents)),
    netCents: sumCents(inMonth.map((p) => p.netCents)),
    sessions: HISTORY_SESSIONS.filter(
      (s) => monthKeyOf(s.start) === month && s.status === 'completed',
    ).length,
  };
});

/**
 * Only rows whose Training Type cell he actually filled in. `FinanceSessionRow`
 * requires a `SessionKind`, and inventing one for a blank cell would put a made-
 * up format into "Highest-Grossing Session Types". Every row he priced does
 * carry a type, so nothing with money on it is lost by this filter — the count
 * of what was left out is printed on the panel.
 */
const TYPED_SESSIONS: FinanceSessionRow[] = HISTORY_SESSIONS.flatMap((s) => {
  if (s.kind === null) return [];
  const kind: SessionKind = s.kind;
  return [
    {
      id: s.id,
      date: s.start.slice(0, 10),
      kind,
      // `null` = never priced, which is NOT a comp. 0 keeps the row out of the
      // average and out of the ranking rather than dragging either toward zero.
      amountCents: s.amountCents ?? 0,
      status: s.status,
    },
  ];
});

const UNTYPED_SESSIONS = HISTORY_SESSIONS.length - TYPED_SESSIONS.length;

const UNPRICED_SESSIONS = HISTORY_SESSIONS.filter(
  (s) => s.amountCents === null,
).length;

/** Months he worked and recorded no money at all. Drawn, never dropped. */
const EMPTY_MONTHS = BOOK_MONTH_ROWS.filter((m) => m.grossCents === 0).map(
  (m) => ({
    ...m,
    rows: HISTORY_SESSIONS.filter((s) => monthKeyOf(s.start) === m.month).length,
  }),
);

const OWING_CLIENTS = HISTORY_CLIENTS.filter((c) => c.balanceCents > 0);

/* ---------------------------------------------------------- HIS OWN TOTALS */

/** What the session rows say for the month his Dashboard reports on. */
const MAY_FROM_SESSION_LOG =
  HISTORY_IMPORT_REPORT.paymentTotalByMonth[HISTORY_MAY_DASHBOARD.month] ?? 0;

/** His five stream rows, added up. Does NOT equal his own income total. */
const DASHBOARD_STREAM_SUM = sumCents(
  HISTORY_MAY_DASHBOARD.byStream.map((s) => s.cents),
);

/**
 * His Dashboard's income-by-stream table as ranked bars. The MONEY on each bar
 * is his figure. The COUNT beside it is how many rows in the imported session
 * log actually sit behind that stream — which is 8 for Personal Training and
 * zero for everything else, and that contrast is the most useful thing on the
 * panel.
 */
const STREAM_ROWS: RankedRow[] = HISTORY_MAY_DASHBOARD.byStream
  .map((stream) => {
    const def = getIncomeStream(stream.incomeStreamId);
    return {
      key: stream.incomeStreamId,
      label: def?.label ?? stream.incomeStreamId,
      grossCents: stream.cents,
      share:
        Math.round(percentOf(stream.cents, DASHBOARD_STREAM_SUM) * 10) / 10,
      // Only Personal Training is a stream his session log records at all.
      count:
        stream.incomeStreamId === 'personal-training'
          ? HISTORY_PAYMENTS.length
          : 0,
    };
  })
  .sort((a, b) => b.grossCents - a.grossCents || (a.label < b.label ? -1 : 1));

const STREAM_LEADER = STREAM_ROWS[0];

/* ==========================================================================
 * LOADER
 * ======================================================================== */

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only. A /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');

  const payload: FinancePayload = {
    // The LAST dated row in his book, not today. Trailing windows count back
    // from here so the page never claims a quiet month that is really just an
    // un-entered one.
    anchorDate: HISTORY_ANCHOR_DATE,
    payments: HISTORY_PAYMENTS.map((p) => ({
      id: p.id,
      date: p.date,
      clientId: p.clientId,
      category: p.category,
      amountCents: p.amountCents,
      refundedCents: p.refundedCents,
      feeCents: p.feeCents,
      netCents: p.netCents,
      status: p.status,
    })),
    sessions: TYPED_SESSIONS,
    /* Real names. This screen is coach-gated and row-level secured, and the
       de-identified "Account 07" labels belonged to the seed preview that used
       to fill it. Nothing on this page is rendered outside the gate. */
    accounts: Object.fromEntries(HISTORY_CLIENTS.map((c) => [c.id, c.name])),
    months: BOOK_MONTH_ROWS,
    // His Owed column, which his own Dashboard contradicts — see the
    // reconciliation table below.
    outstandingCents: sumCents(OWING_CLIENTS.map((c) => c.balanceCents)),
    outstandingAccounts: OWING_CLIENTS.length,
    activePackages: HISTORY_CLIENTS.filter(
      (c) => (c.packages.remaining ?? 0) > 0,
    ).length,
    bankedSessions: HISTORY_CLIENTS.reduce(
      (total, c) => total + (c.packages.remaining ?? 0),
      0,
    ),
  };

  return {payload};
}

/* ==========================================================================
 * PAGE
 * ======================================================================== */

export default function PrivateFinancePage({loaderData}: Route.ComponentProps) {
  const {payload} = loaderData;

  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);

  // Motion is gated on a measured preference — nothing moves until we know.
  const {ready, animate} = useMotion();
  const entered = useEntered(ready);
  const intro = useIntroWindow(entered);

  const view = useMemo(
    () => computeFinance(payload, period),
    [payload, period],
  );
  const periodDef = periodById(period);

  const sourceLeader = view.bySource[0];
  const clientLeader = view.topClients[0];
  const typeLeader = view.topSessionTypes[0];

  /* The masthead, the 1440px measure, the skip link and the data banner are
     <Screen>'s. `.fin-page` rides along as rootClassName because it is the
     scope the chart tokens are declared on — every --fin-* value in
     finance.css resolves from this element down. */
  return (
    <Screen
      rootClassName="fin-page"
      mark={<PrivateMark className="hidden h-9 w-auto sm:block" />}
      eyebrow="Management View"
      title="Finance"
      actions={
        <>
          <Link to="/private/dashboard" className="tag ops-btn ops-btn-quiet">
            Dashboard
          </Link>
          <Form method="post" action="/private/logout">
            <button type="submit" className="tag ops-btn ops-btn-quiet">
              Log Out
            </button>
          </Form>
        </>
      }
      notice={`Your book, imported from SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm — ${HISTORY_IMPORT_REPORT.paymentCount} logged payments totalling ${formatMoney(
        HISTORY_IMPORT_REPORT.paymentTotalCents,
      )}, ${HISTORY_DATE_RANGE.first} to ${HISTORY_DATE_RANGE.last}. Current to the last row in the book. Your own Dashboard totals disagree with it; both are shown below.`}
      noticeRole="note"
    >
      <>
        {/* ------------------------------------------------ PERIOD CONTROL */}
        <div
          className="fin-rise is-in mb-10 flex flex-col gap-5 border-b rule pb-8 md:mb-14 md:flex-row md:items-end md:justify-between"
          style={{'--fin-delay': '0ms'} as React.CSSProperties}
        >
          <div>
            <p className="tag ops-accent">The Books</p>
            <p className="display mt-4 text-[clamp(1.75rem,6vw,2.75rem)] leading-none">
              {periodDef.caption}
            </p>
          </div>
          <PeriodSwitcher
            value={period}
            onChange={setPeriod}
            rangeLabel={view.rangeLabel}
          />
        </div>

        {/* Announces every recomputation to assistive tech. */}
        <p role="status" aria-live="polite" className="fin-sr">
          Showing {periodDef.caption}, {view.rangeLabel}. Gross revenue{' '}
          {formatMoney(view.grossCents)} across {view.paymentCount} payments
          from {view.payingClients} clients, from the session log.
        </p>

        {/* ------------------------------------------------------ KPI ROW */}
        <KpiRow view={view} animate={animate} entered={entered} />

        <p className="ops-mute mt-6 max-w-[80ch] text-[0.8125rem] leading-relaxed">
          Every figure above is the session log and nothing else — the trailing
          window is counted back from {HISTORY_ANCHOR_DATE}, the last dated row
          in your book. Your Dashboard reports different totals for May; the two
          are compared, not merged, further down.
        </p>

        {/* --------------------------------------------- THE DISAGREEMENT
            Placed before the charts on purpose. Reading a trend line while
            three totals for the same month are still unreconciled is how a
            wrong number gets acted on. */}
        <Panel
          label="Three Answers For May"
          headingId="fin-may"
          meta="None of them agree"
          delay="380ms"
          entered={entered}
          className="mt-16 md:mt-24"
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-12">
            <div className="lg:col-span-5">
              <dl>
                <Row
                  as="div"
                  first
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <dt className="ops-ink text-sm">
                    Your session log, May
                    <span className="ops-mute ml-2 text-xs">
                      rows you can audit
                    </span>
                  </dt>
                  <dd className="tabular ops-accent shrink-0 text-lg">
                    {formatMoney(MAY_FROM_SESSION_LOG)}
                  </dd>
                </Row>
                <Row
                  as="div"
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <dt className="ops-ink text-sm">
                    Your Dashboard, May income
                    <span className="ops-mute ml-2 text-xs">your figure</span>
                  </dt>
                  <dd className="tabular ops-ink shrink-0 text-lg">
                    {formatMoney(HISTORY_MAY_DASHBOARD.incomeCents)}
                  </dd>
                </Row>
                <Row
                  as="div"
                  className="flex items-baseline justify-between gap-6 py-3"
                >
                  <dt className="ops-ink text-sm">
                    Your Dashboard streams, summed
                    <span className="ops-mute ml-2 text-xs">
                      {HISTORY_MAY_DASHBOARD.byStream.length} rows
                    </span>
                  </dt>
                  <dd className="tabular ops-ink shrink-0 text-lg">
                    {formatMoney(DASHBOARD_STREAM_SUM, {cents: true})}
                  </dd>
                </Row>
              </dl>
              <p className="ops-mute mt-5 text-[0.8125rem] leading-relaxed">
                Your Dashboard says May income is{' '}
                {formatMoney(HISTORY_MAY_DASHBOARD.incomeCents)}, and the five
                stream rows on the same sheet add up to{' '}
                {formatMoney(DASHBOARD_STREAM_SUM, {cents: true})} — a gap of{' '}
                {formatMoney(
                  DASHBOARD_STREAM_SUM - HISTORY_MAY_DASHBOARD.incomeCents,
                  {cents: true},
                )}{' '}
                inside one sheet. Nothing here has picked a winner. Reconciling
                it is yours to do; this screen only refuses to hide it.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
                <table className="ops-table min-w-[38rem] text-sm">
                  <caption className="ops-sr">
                    Every point on which the imported session log and your own
                    Dashboard disagree, with the gap in dollars.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="py-2 pr-5">
                        What
                      </th>
                      <th scope="col" className="ops-th-right py-2 pr-5">
                        Session log
                      </th>
                      <th scope="col" className="ops-th-right py-2 pr-5">
                        Your sheet
                      </th>
                      <th scope="col" className="ops-th-right py-2">
                        Gap
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORY_RECONCILIATION.map((line) => (
                      <tr key={line.id}>
                        {/* Deliberately a <td>: `.ops-table th` is uppercase
                            10px with 0.22em tracking and its own hairline,
                            which is right for a column header and unreadable
                            for a sentence. */}
                        <td className="max-w-[22rem] py-3 pr-5 align-top">
                          <span className="ops-ink block text-sm">
                            {line.label}
                          </span>
                          <span className="ops-mute mt-1 block text-xs leading-relaxed">
                            {line.note}
                          </span>
                        </td>
                        <td className="tabular ops-td-right ops-ink whitespace-nowrap py-3 pr-5 align-top">
                          {line.importedCents === null
                            ? '—'
                            : formatMoney(line.importedCents, {cents: true})}
                        </td>
                        <td className="tabular ops-td-right ops-ink whitespace-nowrap py-3 pr-5 align-top">
                          {line.dashboardCents === null
                            ? '—'
                            : formatMoney(line.dashboardCents, {cents: true})}
                        </td>
                        <td
                          className={`tabular ops-td-right whitespace-nowrap py-3 align-top ${
                            line.resolved ? 'ops-mute' : 'ops-warn'
                          }`}
                        >
                          {line.deltaCents === null
                            ? 'see note'
                            : formatMoney(line.deltaCents, {
                                cents: true,
                                signed: true,
                              })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ops-mute mt-4 text-[0.8125rem] leading-relaxed">
                A positive gap means the left-hand figure is the larger of the
                two. None of these lines ties out yet.
              </p>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------ MONTHLY CHART */}
        <Panel
          label="Collected By Month"
          headingId="fin-monthly"
          meta={`${view.months.length} months in the book`}
          delay="460ms"
          entered={entered}
          className="mt-16 md:mt-24"
        >
          <MonthlyRevenueChart
            months={view.months}
            animate={animate}
            entered={entered}
            intro={intro}
            rangeLabel={view.rangeLabel}
          />
          <p className="ops-mute mt-6 max-w-[80ch] text-[0.8125rem] leading-relaxed">
            Straight off the Paid column of your session log:{' '}
            {BOOK_MONTH_ROWS.map(
              (m) => `${monthLabelLong(m.month)} ${formatMoney(m.grossCents)}`,
            ).join(' · ')}
            .{' '}
            {EMPTY_MONTHS.length
              ? `An empty month is drawn rather than dropped — ${EMPTY_MONTHS.map(
                  (m) =>
                    `${monthLabelLong(m.month)} has ${m.rows} dated row${
                      m.rows === 1 ? '' : 's'
                    }`,
                ).join(', ')} and no payment recorded against any of them.`
              : 'Every month in the book carries at least one payment.'}
          </p>
        </Panel>

        {/* ------------------------------------------------ INCOME STREAMS */}
        <Panel
          label="Income By Stream"
          headingId="fin-streams"
          meta="Your Dashboard, May 2026"
          delay="520ms"
          entered={entered}
          className="mt-16 md:mt-24"
        >
          <RankedBars
            rows={STREAM_ROWS}
            animate={animate}
            entered={entered}
            intro={intro}
            unit="rows in the session log"
            baseDelay={620}
            summary={
              STREAM_LEADER
                ? `${STREAM_LEADER.label} leads at ${formatMoney(
                    STREAM_LEADER.grossCents,
                    {cents: true},
                  )}, ${STREAM_LEADER.share.toFixed(
                    1,
                  )}% of the ${formatMoney(DASHBOARD_STREAM_SUM, {
                    cents: true,
                  })} your stream rows add up to. The money on each bar is your Dashboard figure; the count beside it is how many rows in the imported session log sit behind that stream.`
                : 'No income streams recorded.'
            }
          />
          <p className="ops-mute mt-6 max-w-[80ch] text-[0.8125rem] leading-relaxed">
            Only Personal Training has session rows behind it. Club dues, camps,
            the CBU stipend and merch never get entered as sessions, so the
            session log cannot equal your total income and the gap between them
            is expected. Two of these streams —{' '}
            {HISTORY_MAY_DASHBOARD.byStream
              .filter((s) => getIncomeStream(s.incomeStreamId)?.invented)
              .map((s) => getIncomeStream(s.incomeStreamId)?.label)
              .join(' and ')}{' '}
            — are on your Dashboard but were never added to your Lists sheet.
          </p>
        </Panel>

        {/* --------------------------------------- CUMULATIVE + BY SOURCE */}
        <div className="mt-16 grid grid-cols-1 gap-16 md:mt-24 lg:grid-cols-12 lg:gap-x-16">
          <Panel
            label="Cumulative Collected"
            headingId="fin-cumulative"
            meta={formatMoney(view.netCents) + ' net'}
            delay="560ms"
            entered={entered}
            className="lg:col-span-7"
          >
            <CumulativeLine
              points={view.cumulative}
              animate={animate}
              entered={entered}
              rangeLabel={view.rangeLabel}
            />
          </Panel>

          <Panel
            label="By Package Type"
            headingId="fin-source"
            meta={`${view.bySource.length} of your package types`}
            delay="660ms"
            entered={entered}
            className="lg:col-span-5"
          >
            <RankedBars
              rows={view.bySource}
              animate={animate}
              entered={entered}
              intro={intro}
              unit="payments"
              baseDelay={780}
              summary={
                sourceLeader
                  ? `${sourceLeader.label} leads at ${formatMoney(
                      sourceLeader.grossCents,
                    )} — ${sourceLeader.share.toFixed(
                      1,
                    )}% of everything the session log records in ${view.rangeLabel}.`
                  : 'No payment recorded in this window.'
              }
              emptyMessage="No payment recorded in this window."
            />
          </Panel>
        </div>

        {/* ------------------------------------------------- RANKED LISTS */}
        <div className="mt-16 grid grid-cols-1 gap-16 md:mt-24 lg:grid-cols-2 lg:gap-x-16">
          <Panel
            label="Highest-Paying Clients"
            headingId="fin-clients"
            meta={`Top ${view.topClients.length} of ${view.payingClients} who paid`}
            delay="760ms"
            entered={entered}
          >
            <RankedBars
              rows={view.topClients}
              animate={animate}
              entered={entered}
              intro={intro}
              unit="payments"
              baseDelay={880}
              summary={
                clientLeader
                  ? `${clientLeader.label} is the largest account at ${formatMoney(
                      clientLeader.grossCents,
                    )}, ${clientLeader.share.toFixed(
                      1,
                    )}% of everything attributed to a client in this window.`
                  : 'No client paid anything in this window.'
              }
              emptyMessage="No client paid anything in this window."
            />
            {OWING_CLIENTS.length ? (
              <p className="ops-mute mt-6 text-[0.8125rem] leading-relaxed">
                Still owing:{' '}
                {OWING_CLIENTS.map(
                  (c) => `${c.name} ${formatMoney(c.balanceCents)}`,
                ).join(' · ')}
                .{' '}
                <Link to="/private/clients" className="ops-accent underline">
                  Open the roster
                </Link>
                .
              </p>
            ) : null}
          </Panel>

          <Panel
            label="Highest-Grossing Session Types"
            headingId="fin-types"
            meta={`${view.sessionCount} priced sessions`}
            delay="860ms"
            entered={entered}
          >
            <RankedBars
              rows={view.topSessionTypes}
              animate={animate}
              entered={entered}
              intro={intro}
              unit="sessions"
              baseDelay={980}
              summary={
                typeLeader
                  ? `${typeLeader.label} is the strongest format at ${formatMoney(
                      typeLeader.grossCents,
                    )} across ${typeLeader.count} sessions — ${typeLeader.share.toFixed(
                      1,
                    )}% of the mat time you priced.`
                  : 'No priced session in this window.'
              }
              emptyMessage="No priced session in this window."
            />
            <p className="ops-mute mt-6 text-[0.8125rem] leading-relaxed">
              Ranked on the {HISTORY_SESSIONS.length - UNPRICED_SESSIONS} rows
              you priced. {UNPRICED_SESSIONS} rows carry no amount and{' '}
              {UNTYPED_SESSIONS} carry no Training Type; a blank cell is not a
              zero, so neither is counted here rather than being folded in at $0.
            </p>
          </Panel>
        </div>

        {/* ----------------------------------------------------- FOOTNOTE */}
        <p
          className={`fin-rise ${entered ? 'is-in' : ''} ops-mute mt-20 max-w-[70ch] border-t rule pt-8 text-[0.8125rem] leading-relaxed md:mt-28`}
          style={{'--fin-delay': '960ms'} as React.CSSProperties}
        >
          Imported from SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm:{' '}
          {HISTORY_IMPORT_REPORT.importedRowCount} session rows across{' '}
          {HISTORY_IMPORT_REPORT.clientCount} clients,{' '}
          {HISTORY_DATE_RANGE.first} to {HISTORY_DATE_RANGE.last}, carrying{' '}
          {HISTORY_IMPORT_REPORT.paymentCount} payments worth{' '}
          {formatMoney(HISTORY_IMPORT_REPORT.paymentTotalCents)}. Four empty
          template tabs were left out and nothing else was. Figures are anchored
          to {HISTORY_ANCHOR_DATE} — the last row in the book, not today — and
          recomputed in the browser when the period changes. Gross is money in;
          net is gross less refunds and processing fees, both of which are zero
          in your book because it has no column for either. Outstanding, active
          packages and banked sessions are current standing, not period figures.
          This screen is coach-only and carries real client names; nothing on it
          appears in a page title, a link or anything that leaves the gate.
        </p>
      </>
    </Screen>
  );
}
