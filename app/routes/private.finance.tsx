/**
 * ============================================================================
 * /private/finance — THE MONEY VIEW
 * ============================================================================
 *
 * Behind the coach gate. Jesse's private cockpit for the business: what came
 * in, where it came from, who paid it, and what is still owed.
 *
 * HOW IT IS PUT TOGETHER
 * The loader flattens the shared ops dataset into a narrow, serialisable
 * payload. Everything on screen is then derived in the browser by
 * `computeFinance(payload, period)` — one pure function — which is why the
 * period switcher can recompute all five KPIs, three charts and two ranked
 * lists without a navigation or a second round trip.
 *
 * DETERMINISM: no `Date.now()`, no `Math.random()`, no `new Date()` anywhere in
 * this route or its components. "Today" is `ANCHOR_DATE` from the seed. Server
 * and browser render byte-identical markup, so hydration is clean.
 *
 * MONEY: integer cents from `~/lib/ops/types` end to end, formatted exactly
 * once at the render edge with `formatMoney`. No float ever touches a dollar.
 *
 * PRIVACY: clients appear as their de-identified ledger label ("Account 07").
 * Never render a human name on this screen.
 */

import {useMemo, useState} from 'react';
import {Form, Link} from 'react-router';
import {requireDemoRole} from '~/lib/demoAuth';
import {
  ANCHOR_DATE,
  CLIENTS,
  MONTHLY_REVENUE,
  OUTSTANDING_ACCOUNTS,
  PAYMENTS,
  SESSIONS,
} from '~/lib/ops/seed';
import {formatMoney, sumCents} from '~/lib/ops/types';
import {PrivateMark} from '~/components/private/PrivateMark';
import {
  computeFinance,
  DEFAULT_PERIOD,
  periodById,
  type FinancePayload,
  type PeriodId,
} from '~/components/finance/model';
import {
  Panel,
  useEntered,
  useIntroWindow,
  useMotion,
} from '~/components/finance/primitives';
import {KpiRow} from '~/components/finance/KpiRow';
import {MonthlyRevenueChart} from '~/components/finance/MonthlyRevenueChart';
import {CumulativeLine} from '~/components/finance/CumulativeLine';
import {RankedBars} from '~/components/finance/RankedBars';
import {PeriodSwitcher} from '~/components/finance/PeriodSwitcher';
import privateStyles from '~/styles/private.css?url';
import financeStyles from '~/styles/finance.css?url';
import type {Route} from './+types/private.finance';

export function links() {
  return [
    {rel: 'stylesheet', href: privateStyles},
    {rel: 'stylesheet', href: financeStyles},
  ];
}

export function meta() {
  return [
    {title: 'Finance — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/* ==========================================================================
 * LOADER
 * ======================================================================== */

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only. A /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');

  // Flatten the shared dataset to just the columns this page reads. When
  // Shopify + Supabase are linked, only this block changes.
  const payload: FinancePayload = {
    anchorDate: ANCHOR_DATE,
    payments: PAYMENTS.map((p) => ({
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
    sessions: SESSIONS.map((s) => ({
      id: s.id,
      date: s.start.slice(0, 10),
      kind: s.kind,
      amountCents: s.amountCents,
      status: s.status,
    })),
    // De-identified ledger labels only — this map never carries a name.
    accounts: Object.fromEntries(CLIENTS.map((c) => [c.id, c.accountLabel])),
    months: MONTHLY_REVENUE.map((m) => ({
      month: m.month,
      label: m.label,
      grossCents: m.grossCents,
      netCents: m.netCents,
      sessions: m.sessions,
    })),
    outstandingCents: sumCents(OUTSTANDING_ACCOUNTS.map((a) => a.balanceCents)),
    outstandingAccounts: OUTSTANDING_ACCOUNTS.length,
    activePackages: CLIENTS.filter((c) => (c.packages.remaining ?? 0) > 0)
      .length,
    bankedSessions: CLIENTS.reduce(
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

  return (
    <div className="min-h-[100svh] bg-onyx-deep text-stone">
      {/* ------------------------------------------------------- MASTHEAD */}
      <header className="private-sticky border-b rule-light">
        {/* Wraps rather than overflows: at 390px the two [ TAG ] actions do
            not fit beside the title, so they drop to their own right-aligned
            row. Nothing on this page may scroll horizontally. */}
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 md:flex-nowrap md:px-10 md:py-5">
          <div className="flex min-w-0 items-center gap-4 md:gap-5">
            <PrivateMark className="hidden h-9 w-auto text-gold sm:block" />
            <div>
              <p className="tag text-gold-deep">Management View</p>
              <h1 className="display mt-1 text-xl leading-none md:text-2xl">
                Finance
              </h1>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              to="/private/dashboard"
              className="tag border border-stone/25 px-4 py-3 text-steel transition-colors duration-500 hover:border-gold hover:text-gold focus-visible:border-gold focus-visible:text-gold"
            >
              Dashboard
            </Link>
            <Form method="post" action="/private/logout">
              <button
                type="submit"
                className="tag border border-stone/25 px-4 py-3 text-steel transition-colors duration-500 hover:border-gold hover:text-gold focus-visible:border-gold focus-visible:text-gold"
              >
                Log Out
              </button>
            </Form>
          </div>
        </div>
      </header>

      <p
        role="note"
        className="border-b border-gold/25 bg-gold/[0.07] px-5 py-3 text-center text-[0.6875rem] uppercase leading-relaxed tracking-[0.18em] text-gold md:px-10"
      >
        Seed data — the Shopify and Supabase connectors are not linked yet.
      </p>

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 md:px-10 md:pb-32 md:pt-14">
        {/* ------------------------------------------------ PERIOD CONTROL */}
        <div
          className="fin-rise is-in mb-10 flex flex-col gap-5 border-b rule-light pb-8 md:mb-14 md:flex-row md:items-end md:justify-between"
          style={{'--fin-delay': '0ms'} as React.CSSProperties}
        >
          <div>
            <p className="tag text-gold">The Books</p>
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
          from {view.payingClients} accounts.
        </p>

        {/* ------------------------------------------------------ KPI ROW */}
        <KpiRow view={view} animate={animate} entered={entered} />

        {/* ------------------------------------------------ MONTHLY CHART */}
        <Panel
          label="Monthly Revenue"
          headingId="fin-monthly"
          meta={`${view.months.length} months on file`}
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
        </Panel>

        {/* --------------------------------------- CUMULATIVE + BY SOURCE */}
        <div className="mt-16 grid grid-cols-1 gap-16 md:mt-24 lg:grid-cols-12 lg:gap-x-16">
          <Panel
            label="Cumulative Revenue"
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
            label="Revenue by Source"
            headingId="fin-source"
            meta={`${view.bySource.length} streams`}
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
                    )}% of everything collected in ${view.rangeLabel}.`
                  : 'Nothing collected in this period.'
              }
            />
          </Panel>
        </div>

        {/* ------------------------------------------------- RANKED LISTS */}
        <div className="mt-16 grid grid-cols-1 gap-16 md:mt-24 lg:grid-cols-2 lg:gap-x-16">
          <Panel
            label="Highest-Paying Accounts"
            headingId="fin-clients"
            meta={`Top ${view.topClients.length} of ${view.payingClients}`}
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
                    )}% of attributed revenue. Accounts are de-identified.`
                  : 'No account activity in this period.'
              }
              emptyMessage="No account activity in this period."
            />
          </Panel>

          <Panel
            label="Highest-Grossing Session Types"
            headingId="fin-types"
            meta={`${view.sessionCount} sessions`}
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
                    )}% of mat-time revenue.`
                  : 'No sessions delivered in this period.'
              }
              emptyMessage="No sessions delivered in this period."
            />
          </Panel>
        </div>

        {/* ----------------------------------------------------- FOOTNOTE */}
        <p
          className={`fin-rise ${entered ? 'is-in' : ''} mt-20 max-w-[62ch] border-t rule-light pt-8 text-[0.8125rem] leading-relaxed text-steel md:mt-28`}
          style={{'--fin-delay': '960ms'} as React.CSSProperties}
        >
          Figures are anchored to {ANCHOR_DATE} and recomputed in the browser
          when the period changes. Gross is money in; net is gross less refunds
          and processing fees. Outstanding balance and active packages are
          current standing, not period figures. Accounts appear as ledger
          labels — no athlete or family names on this screen.
        </p>
      </main>
    </div>
  );
}
