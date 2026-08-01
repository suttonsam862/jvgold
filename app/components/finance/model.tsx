/**
 * ============================================================================
 * FINANCE — DERIVATION LAYER
 * ============================================================================
 *
 * Pure, dependency-free aggregation that turns the loader payload into the
 * exact numbers the finance page paints. It runs on the server (for the first
 * paint) and again in the browser every time the period switcher moves, so it
 * must be deterministic: no `Date.now()`, no `Math.random()`, no `new Date()`.
 * Every date comes from `anchorDate` plus the integer civil-date helpers in
 * `~/lib/ops/types`.
 *
 * MONEY IS INTEGER CENTS everywhere below. Sums are integer sums; the only
 * division is an explicit `Math.round`. Nothing here ever produces a string —
 * `formatMoney` is called at the render edge, in the components.
 *
 * SHARES are percentages, not money. They are allowed to be floats.
 */

import {
  addDays,
  daysBetween,
  daysFromIso,
  isoFromDays,
  monthKeyOf,
  percentOf,
  sumCents,
  type IsoDate,
  type KpiDirection,
  type PaymentCategory,
  type PaymentStatus,
  type SessionKind,
  type SessionStatus,
} from '~/lib/ops/types';

/* ==========================================================================
 * PERIODS
 *
 * Trailing windows anchored on the dataset's anchor date rather than calendar
 * months. The seed's history window is 181 days, so a literal "August 2026"
 * would render a single day of data and read as a broken page. Each button
 * therefore carries the real date range underneath it — the label is the
 * shorthand, the caption is the truth.
 * ======================================================================== */

export type PeriodId = 'm1' | 'm3' | 'm6' | 'y1';

export interface PeriodDef {
  id: PeriodId;
  /** Button text. */
  label: string;
  /** Trailing window length in days, inclusive of the anchor day. */
  days: number;
  /** Long form for the live region and the panel meta. */
  caption: string;
  /** Days per bucket in the KPI-row sparkline. */
  bucketDays: number;
  bucketLabel: string;
}

export const PERIODS: readonly PeriodDef[] = [
  {
    id: 'm1',
    label: 'Month',
    days: 30,
    caption: 'Trailing 30 days',
    bucketDays: 7,
    bucketLabel: 'week',
  },
  {
    id: 'm3',
    label: '3 Mos',
    days: 91,
    caption: 'Trailing 3 months',
    bucketDays: 7,
    bucketLabel: 'week',
  },
  {
    id: 'm6',
    label: '6 Mos',
    days: 182,
    caption: 'Trailing 6 months',
    bucketDays: 14,
    bucketLabel: 'fortnight',
  },
  {
    id: 'y1',
    label: 'Year',
    days: 365,
    caption: 'Trailing 12 months',
    bucketDays: 28,
    bucketLabel: 'month',
  },
];

export const DEFAULT_PERIOD: PeriodId = 'm6';

export function periodById(id: PeriodId): PeriodDef {
  return PERIODS.find((p) => p.id === id) ?? PERIODS[2];
}

/* ==========================================================================
 * LOADER PAYLOAD
 *
 * Deliberately narrow: only the columns the finance page reads. Keeping the
 * payload small keeps the SSR document small, and every field here exists on
 * the shared domain types, so the swap to live Shopify/Supabase data is a
 * loader change and nothing else.
 * ======================================================================== */

export interface FinancePaymentRow {
  id: string;
  date: IsoDate;
  clientId: string | null;
  category: PaymentCategory;
  amountCents: number;
  refundedCents: number;
  feeCents: number;
  netCents: number;
  status: PaymentStatus;
}

export interface FinanceSessionRow {
  id: string;
  /** Civil date of the session start. */
  date: IsoDate;
  kind: SessionKind;
  amountCents: number;
  status: SessionStatus;
}

export interface FinanceMonthRow {
  month: string;
  label: string;
  grossCents: number;
  netCents: number;
  sessions: number;
}

export interface FinancePayload {
  anchorDate: IsoDate;
  payments: FinancePaymentRow[];
  sessions: FinanceSessionRow[];
  /** clientId → de-identified ledger label ("Account 07"). Never a name. */
  accounts: Record<string, string>;
  months: FinanceMonthRow[];
  /** Current unpaid total across every household, in cents. */
  outstandingCents: number;
  outstandingAccounts: number;
  /** Athletes holding a package with sessions left on it. */
  activePackages: number;
  /** Total sessions banked across those packages. */
  bankedSessions: number;
}

/* ==========================================================================
 * DERIVED SHAPES
 * ======================================================================== */

export interface RankedRow {
  key: string;
  label: string;
  /** Gross less refunds, in cents. */
  grossCents: number;
  /** Share of the ranked set's total, 0-100. */
  share: number;
  count: number;
}

export interface MonthBar extends FinanceMonthRow {
  /** True when the bucket falls inside the selected period. */
  inPeriod: boolean;
}

export interface CumulativePoint {
  date: IsoDate;
  /** Running net total from the first day with money in the window. */
  cents: number;
}

export interface SparkBucket {
  /** Inclusive start of the bucket. */
  start: IsoDate;
  cents: number;
}

export interface FinanceView {
  period: PeriodDef;
  start: IsoDate;
  end: IsoDate;
  /** "Feb 1 — Aug 1". Pre-rendered; no Intl at render time. */
  rangeLabel: string;

  grossCents: number;
  netCents: number;
  refundedCents: number;
  feeCents: number;

  prevGrossCents: number;
  /** Signed percent change vs the immediately preceding window. Null if N/A. */
  deltaPercent: number | null;
  direction: KpiDirection;

  paymentCount: number;
  payingClients: number;

  /** Mean value of a billed, completed session in the window, in cents. */
  avgSessionCents: number;
  sessionCount: number;

  outstandingCents: number;
  outstandingAccounts: number;
  activePackages: number;
  bankedSessions: number;

  spark: SparkBucket[];
  bySource: RankedRow[];
  topClients: RankedRow[];
  topSessionTypes: RankedRow[];
  cumulative: CumulativePoint[];
  months: MonthBar[];
}

/* ==========================================================================
 * LABELS
 * ======================================================================== */

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `'2026-08-01'` → `'Aug 1'`. String work only — no `Date`, no `Intl`. */
export function shortDate(iso: IsoDate): string {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${MONTH_ABBR[m - 1] ?? '—'} ${d}`;
}

/**
 * `'Feb 1 — Aug 1'`, or `'Aug 2 ’25 — Aug 1 ’26'` when the window crosses a
 * year boundary. Without the year suffix a trailing-12-month range reads as
 * "Aug 2 — Aug 1", which looks like a typo rather than a full year.
 */
export function rangeLabelFor(start: IsoDate, end: IsoDate): string {
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${shortDate(start)} — ${shortDate(end)}`;
  }
  return `${shortDate(start)} ’${start.slice(2, 4)} — ${shortDate(end)} ’${end.slice(2, 4)}`;
}

/** The client's own words for the money sources, in his order of interest. */
const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  private: 'Private Lessons',
  package: 'Packages',
  camp: 'Camps',
  clinic: 'Clinics',
  partner: 'Partner Sessions',
  workout: 'Workout Groups',
  merch: 'Merch',
  other: 'Other',
};

const KIND_LABELS: Record<SessionKind, string> = {
  private: 'Private 1-on-1',
  partner: 'Partner Session',
  clinic: 'Clinic',
  workout: 'Workout Group',
  camp: 'Camp',
  group: 'Open Mat',
};

export function categoryLabel(c: PaymentCategory): string {
  return CATEGORY_LABELS[c] ?? 'Other';
}

export function kindLabel(k: SessionKind): string {
  return KIND_LABELS[k] ?? 'Session';
}

/* ==========================================================================
 * AGGREGATION
 * ======================================================================== */

/** Money that actually counts as revenue. A failed charge never landed. */
function counts(p: FinancePaymentRow): boolean {
  return p.status !== 'failed';
}

/** Gross less refunds, in cents. Integer in, integer out. */
function collected(p: FinancePaymentRow): number {
  return p.amountCents - p.refundedCents;
}

/** Rank descending by money, then by label so ties are stable across renders. */
function rank(rows: RankedRow[]): RankedRow[] {
  return rows.sort((a, b) =>
    b.grossCents - a.grossCents || (a.label < b.label ? -1 : 1),
  );
}

/** Attach share-of-total to an already-ranked set. */
function withShares(rows: RankedRow[]): RankedRow[] {
  const total = sumCents(rows.map((r) => r.grossCents));
  for (const r of rows) {
    r.share = Math.round(percentOf(r.grossCents, total) * 10) / 10;
  }
  return rows;
}

/**
 * The one function the page calls. Given the payload and a period, produce
 * every figure on the screen. Pure — same inputs, same output, server or
 * browser.
 */
export function computeFinance(
  data: FinancePayload,
  periodId: PeriodId,
): FinanceView {
  const period = periodById(periodId);
  const end = data.anchorDate;
  const start = addDays(end, -(period.days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(period.days - 1));

  const inWindow = data.payments.filter(
    (p) => counts(p) && p.date >= start && p.date <= end,
  );
  const prevWindow = data.payments.filter(
    (p) => counts(p) && p.date >= prevStart && p.date <= prevEnd,
  );

  const grossCents = sumCents(inWindow.map((p) => p.amountCents));
  const refundedCents = sumCents(inWindow.map((p) => p.refundedCents));
  const feeCents = sumCents(inWindow.map((p) => p.feeCents));
  const netCents = sumCents(inWindow.map((p) => p.netCents));
  const prevGrossCents = sumCents(prevWindow.map((p) => p.amountCents));

  const deltaPercent =
    prevGrossCents === 0
      ? null
      : Math.round(percentOf(grossCents - prevGrossCents, prevGrossCents) * 10) /
        10;
  const direction: KpiDirection =
    deltaPercent === null || deltaPercent === 0
      ? 'flat'
      : deltaPercent > 0
        ? 'up'
        : 'down';

  const payingClients = new Set(
    inWindow.map((p) => p.clientId).filter((id): id is string => Boolean(id)),
  ).size;

  /* ---- session economics -------------------------------------------- */
  const billed = data.sessions.filter(
    (s) =>
      s.status === 'completed' &&
      s.amountCents > 0 &&
      s.date >= start &&
      s.date <= end,
  );
  const avgSessionCents = billed.length
    ? Math.round(sumCents(billed.map((s) => s.amountCents)) / billed.length)
    : 0;

  /* ---- sparkline: fixed-width buckets across the window -------------- */
  const spark: SparkBucket[] = [];
  const startDay = daysFromIso(start);
  const totalDays = period.days;
  const bucketCount = Math.max(1, Math.ceil(totalDays / period.bucketDays));
  for (let i = 0; i < bucketCount; i++) {
    spark.push({start: isoFromDays(startDay + i * period.bucketDays), cents: 0});
  }
  for (const p of inWindow) {
    const offset = daysBetween(start, p.date);
    const idx = Math.min(bucketCount - 1, Math.floor(offset / period.bucketDays));
    spark[idx].cents += p.amountCents;
  }

  /* ---- revenue by source (payment category) -------------------------- */
  const sourceMap = new Map<string, RankedRow>();
  for (const p of inWindow) {
    const key = p.category;
    const row = sourceMap.get(key) ?? {
      key,
      label: categoryLabel(p.category),
      grossCents: 0,
      share: 0,
      count: 0,
    };
    row.grossCents += collected(p);
    row.count += 1;
    sourceMap.set(key, row);
  }
  const bySource = withShares(rank([...sourceMap.values()]));

  /* ---- highest-paying clients (de-identified ledger labels) ---------- */
  const clientMap = new Map<string, RankedRow>();
  for (const p of inWindow) {
    if (!p.clientId) continue;
    const row = clientMap.get(p.clientId) ?? {
      key: p.clientId,
      // Never a human name. The ledger label is the identity on this screen.
      label: data.accounts[p.clientId] ?? 'Unassigned',
      grossCents: 0,
      share: 0,
      count: 0,
    };
    row.grossCents += collected(p);
    row.count += 1;
    clientMap.set(p.clientId, row);
  }
  const clientRows = rank([...clientMap.values()]);
  const clientTotal = sumCents(clientRows.map((r) => r.grossCents));
  for (const r of clientRows) {
    r.share = Math.round(percentOf(r.grossCents, clientTotal) * 10) / 10;
  }
  const topClients = clientRows.slice(0, 8);

  /* ---- highest-grossing session types (from the ledger, not payments) */
  const kindMap = new Map<string, RankedRow>();
  for (const s of data.sessions) {
    if (s.date < start || s.date > end) continue;
    if (s.status === 'cancelled' || s.status === 'scheduled') continue;
    if (s.amountCents <= 0) continue;
    const row = kindMap.get(s.kind) ?? {
      key: s.kind,
      label: kindLabel(s.kind),
      grossCents: 0,
      share: 0,
      count: 0,
    };
    row.grossCents += s.amountCents;
    row.count += 1;
    kindMap.set(s.kind, row);
  }
  const topSessionTypes = withShares(rank([...kindMap.values()]));
  // A count, not money — a plain reduce keeps the intent obvious.
  const sessionCount = topSessionTypes.reduce((total, r) => total + r.count, 0);

  /* ---- cumulative net, day by day ------------------------------------
   * Starts at the first day inside the window that carries money, so a long
   * window does not open with a flat month of nothing. */
  const dated = [...inWindow].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cumulative: CumulativePoint[] = [];
  if (dated.length) {
    const firstDay = daysFromIso(dated[0].date);
    const lastDay = daysFromIso(end);
    const byDay = new Map<string, number>();
    for (const p of dated) {
      byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.netCents);
    }
    let running = 0;
    for (let d = firstDay; d <= lastDay; d++) {
      const iso = isoFromDays(d);
      running += byDay.get(iso) ?? 0;
      cumulative.push({date: iso, cents: running});
    }
  }

  /* ---- monthly buckets ------------------------------------------------
   * Every available month is always drawn, so the shape of the business is
   * never lost when a short period is selected; the months outside the
   * window are simply de-emphasised. */
  const startMonth = monthKeyOf(start);
  const endMonth = monthKeyOf(end);
  const months: MonthBar[] = data.months.map((m) => ({
    ...m,
    inPeriod: m.month >= startMonth && m.month <= endMonth,
  }));

  return {
    period,
    start,
    end,
    rangeLabel: rangeLabelFor(start, end),
    grossCents,
    netCents,
    refundedCents,
    feeCents,
    prevGrossCents,
    deltaPercent,
    direction,
    paymentCount: inWindow.length,
    payingClients,
    avgSessionCents,
    sessionCount,
    outstandingCents: data.outstandingCents,
    outstandingAccounts: data.outstandingAccounts,
    activePackages: data.activePackages,
    bankedSessions: data.bankedSessions,
    spark,
    bySource,
    topClients,
    topSessionTypes,
    cumulative,
    months,
  };
}
