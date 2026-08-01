/**
 * ============================================================================
 * JV GOLD — OPERATIONS DOMAIN MODEL
 * ============================================================================
 *
 * The single shared vocabulary for Jesse's private management hub: clients,
 * sessions, calendar, money, finance and products.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Shopify connector is currently DISCONNECTED and the store is not linked,
 * so nothing in the hub can query live data yet. Every page is therefore built
 * against these types and against `~/lib/ops/seed`. When the store is linked,
 * the change is contained: the loaders stop importing the seed arrays and start
 * returning the same shapes from Shopify Admin/Storefront + Supabase. No page
 * component changes.
 *
 * WHERE THE VOCABULARY COMES FROM
 * -------------------------------
 * The field names deliberately mirror the Deep Waters production Supabase
 * schema (`athletes`, `sessions`, `session_athletes`, `registrations`) so the
 * two systems can be reconciled row for row. Where Supabase uses snake_case
 * (`usaw_card_number`, `sessions_remaining`, `paid_date`) this file uses the
 * camelCase equivalent and nothing else changes. See docs/DATA-MODEL.md for the
 * column-by-column mapping and for the Shopify seams.
 *
 * HARD RULES
 * ----------
 * 1. MONEY IS INTEGER CENTS. Never a float, never a formatted string in the
 *    data layer. Format at the edge with `formatMoney`.
 * 2. DATES ARE CIVIL STRINGS, never `Date` objects, and never a UTC timestamp
 *    that has to be shifted back into Pacific time to read correctly. A
 *    `Date`-based seed renders differently on a UTC server and a Pacific
 *    browser, which breaks SSR hydration. See the `IsoDate` / `IsoDateTime`
 *    notes below.
 * 3. NO REAL PEOPLE. Everything that ships in the seed is de-identified
 *    ("Athlete 01", "Family 03", "Account 07"). Never invent human names, and
 *    never attach invented medical or injury status to a name. A previous draft
 *    of this project shipped fabricated named minors with weights and injury
 *    status and it had to be torn out.
 */

import type {OfferingId} from '~/lib/offerings';

/* ==========================================================================
 * 1. SCALARS — dates, ids, money
 * ======================================================================== */

/**
 * A civil calendar date, `YYYY-MM-DD`. No time, no zone. Compare with `<`/`>`
 * directly — ISO dates sort lexicographically.
 */
export type IsoDate = string;

/**
 * A local wall-clock timestamp, `YYYY-MM-DDTHH:MM:SS`, with NO timezone suffix.
 *
 * Read it as "the time on the clock in the Riverside mat room"
 * (America/Los_Angeles). We deliberately do not store a `Z` or an offset:
 * Pacific time changes offset twice a year, and any value that has to be
 * re-derived through `new Date()` renders one way on the server and another in
 * the browser. Slice the string instead — `at.slice(0, 10)` is the date,
 * `at.slice(11, 16)` is `HH:MM`.
 */
export type IsoDateTime = string;

/** `YYYY-MM` — the key used to bucket anything monthly. */
export type MonthKey = string;

/** Opaque-ish id aliases. They are plain strings; the alias documents intent. */
export type ClientId = string;
export type SessionId = string;
export type PaymentId = string;
export type CalendarEventId = string;
export type ProductId = string;
export type VariantId = string;

/** ISO 4217. Only USD today, but the field is never assumed. */
export type CurrencyCode = 'USD';

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * Money — ALWAYS integer minor units (cents) plus a currency code.
 *
 * $1,400.00 is `{cents: 140000, currency: 'USD'}`. Floats are banned: 0.1 + 0.2
 * is not 0.3, and a package split three ways silently loses a cent per render.
 * Sum in cents, divide in cents (with an explicit rounding decision), format
 * once at the very end.
 *
 * Many record fields carry a bare `…Cents: number` rather than a `Money`, to
 * keep rows small and sortable. Those are cents in `DEFAULT_CURRENCY` and can
 * be lifted with `money()`.
 */
export interface Money {
  /** Integer minor units. 140000 === $1,400.00. */
  cents: number;
  currency: CurrencyCode;
}

/** Lift bare cents into a `Money`. */
export function money(
  cents: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Money {
  return {cents: Math.round(cents), currency};
}

/** Dollars → cents. Use only at an input boundary, never for stored data. */
export function centsFromDollars(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Sum a list of cent amounts. Present so nobody reaches for a float reduce. */
export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export interface FormatMoneyOptions {
  /** Show `.00`. Default false — the hub reads as a ledger, not a receipt. */
  cents?: boolean;
  /** `$12.4K` / `$1.2M` instead of `$12,400`. Default false. */
  compact?: boolean;
  /** Force a leading `+` on positive values (deltas). Default false. */
  signed?: boolean;
}

/**
 * The ONLY place cents become a string. Accepts bare cents or a `Money`.
 *
 * `formatMoney(140000)`                    → "$1,400"
 * `formatMoney(140000, {cents: true})`     → "$1,400.00"
 * `formatMoney(1240000, {compact: true})`  → "$12.4K"
 * `formatMoney(-5000, {signed: true})`     → "-$50"
 *
 * Always render the result inside a `.tabular` element so the figures align.
 */
export function formatMoney(
  input: number | Money,
  options: FormatMoneyOptions = {},
): string {
  const cents = typeof input === 'number' ? input : input.cents;
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const sign = negative ? '-' : options.signed ? '+' : '';

  if (options.compact) {
    const dollars = abs / 100;
    if (dollars >= 1_000_000) {
      return `${sign}$${trimZero(dollars / 1_000_000)}M`;
    }
    if (dollars >= 1_000) {
      return `${sign}$${trimZero(dollars / 1_000)}K`;
    }
    return `${sign}$${Math.round(dollars)}`;
  }

  const whole = Math.floor(abs / 100);
  const grouped = groupThousands(whole);
  if (options.cents) {
    const rest = String(abs % 100).padStart(2, '0');
    return `${sign}$${grouped}.${rest}`;
  }
  return `${sign}$${grouped}`;
}

/** One decimal, `.0` trimmed. `12.4` → "12.4", `12.0` → "12". */
function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Manual grouping — `toLocaleString` is locale-dependent and can drift SSR. */
function groupThousands(n: number): string {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

/** `4200` (cents) of `10000` → `42.0`. Guards divide-by-zero. */
export function percentOf(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

/* --------------------------------------------------------------------------
 * Civil-date arithmetic — pure integers, no `Date`, no timezone.
 *
 * Howard Hinnant's days-from-civil / civil-from-days. Two pure functions mean
 * every derived date in the seed is byte-identical on the server and in the
 * browser regardless of the machine's timezone.
 * ------------------------------------------------------------------------ */

/** Days since 1970-01-01 for a civil y/m/d (m is 1-12). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yAdj = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yAdj / 400);
  const yoe = yAdj - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `daysFromCivil`. */
export function civilFromDays(z: number): {y: number; m: number; d: number} {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return {y: y + (m <= 2 ? 1 : 0), m, d};
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Day number → `YYYY-MM-DD`. */
export function isoFromDays(days: number): IsoDate {
  const {y, m, d} = civilFromDays(days);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** `YYYY-MM-DD` → day number. Ignores anything after the 10th character. */
export function daysFromIso(iso: IsoDate | IsoDateTime): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return daysFromCivil(y, m, d);
}

/** Calendar-safe date shift. `addDays('2026-08-01', -1)` → `'2026-07-31'`. */
export function addDays(iso: IsoDate, delta: number): IsoDate {
  return isoFromDays(daysFromIso(iso) + delta);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOfIso(iso: IsoDate | IsoDateTime): number {
  const z = daysFromIso(iso);
  return ((z % 7) + 11) % 7;
}

/** Whole days between two dates, `b - a`. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return daysFromIso(b) - daysFromIso(a);
}

/** `'2026-08-01T16:30:00'` → `'2026-08-01'`. Also safe on a bare IsoDate. */
export function dateOf(at: IsoDateTime | IsoDate): IsoDate {
  return at.slice(0, 10);
}

/** `'2026-08-01T16:30:00'` → `'16:30'`. */
export function timeOf(at: IsoDateTime): string {
  return at.slice(11, 16);
}

/** `'2026-08-01…'` → `'2026-08'`. */
export function monthKeyOf(at: IsoDate | IsoDateTime): MonthKey {
  return at.slice(0, 7);
}

/** `'16:30'` → `'4:30 PM'`. Pure string work, no Intl, no `Date`. */
export function formatClock(at: IsoDateTime): string {
  const h = Number(at.slice(11, 13));
  const min = at.slice(14, 16);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

/** Age in whole years on `on` (defaults to the caller's reference date). */
export function ageOn(dateOfBirth: IsoDate, on: IsoDate): number {
  const birth = civilFromDays(daysFromIso(dateOfBirth));
  const ref = civilFromDays(daysFromIso(on));
  let age = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) age -= 1;
  return age;
}

/* ==========================================================================
 * 2. CLIENT / ATHLETE
 *
 * Mirrors Supabase `public.athletes`. One row per athlete. A family with three
 * wrestlers is three rows sharing one `familyGroup` — that is how the club data
 * already works, and finance rolls up by `familyGroup`, not by client.
 * ======================================================================== */

/** Competitive tier. Matches `athletes.level` ('Youth' | 'HS' | 'College' | 'Adult'). */
export type ClientLevel = 'Youth' | 'HS' | 'College' | 'Adult';

/**
 * Account standing. Matches `athletes.status` exactly — these five strings are
 * already in production, do not add a sixth without changing Supabase too.
 *
 * - `Active`        — training and current on money.
 * - `Trial`         — first sessions, not yet committed to a package.
 * - `Paid In Full`  — package bought outright, sessions banked.
 * - `Owes Balance`  — training against an unpaid balance. Drives the AR list.
 * - `Inactive`      — off the mat; kept for history and win-back.
 */
export type ClientStatus =
  | 'Active'
  | 'Trial'
  | 'Paid In Full'
  | 'Owes Balance'
  | 'Inactive';

/**
 * Where the record came from. Matches `athletes.source`, plus `'site'` for
 * bookings taken through /train on this Hydrogen site.
 */
export type ClientSource = 'site' | 'shopify' | 'manual' | 'import';

/**
 * The legally-required registration metadata. Collected at checkout when
 * possible, completed by a coach when an import left it blank — which is why
 * every field is optional/nullable. The compliance page exists precisely to
 * surface the holes.
 *
 * Shopify has no native home for any of this; it lives in customer metafields
 * (namespace `jvgold`) and/or Supabase. See docs/DATA-MODEL.md.
 */
export interface Compliance {
  /** USA Wrestling membership card. Required to compete, often missing. */
  usawCardNumber: string | null;
  /** `athletes.has_health_insurance`. `null` = never asked. */
  hasHealthInsurance: boolean | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  /** Liability waiver on file. `false` is a hard blocker for mat time. */
  waiverSigned: boolean;
}

/**
 * Package / session-bank state. `remaining` is stored rather than derived
 * because the production table stores it (`sessions_remaining`) and coaches
 * adjust it by hand after comps and make-ups. Treat `purchased - used` as a
 * sanity check, not as the source of truth.
 */
export interface PackageState {
  /** Human label, e.g. "Monthly Membership", "10-Session Block", "Other". */
  name: string | null;
  /** What the family paid for this package, in cents. */
  priceCents: number | null;
  purchased: number | null;
  used: number | null;
  remaining: number | null;
  /** The offering this package corresponds to, when it maps cleanly. */
  offeringId: OfferingId | null;
}

/** A person on the roster. De-identified in every shipped seed. */
export interface Client {
  id: ClientId;
  /** Display name. In seed data always "Athlete NN" — never a human name. */
  name: string;
  /**
   * Short ledger label used on finance screens where the athlete's identity is
   * beside the point, e.g. "Account 07". Keeps AR tables readable without
   * repeating roster names.
   */
  accountLabel: string;
  /** Parent / primary contact. `athletes.guardian`. */
  guardian: string | null;
  email: string | null;
  phone: string | null;
  level: ClientLevel;
  school: string | null;
  /** `YYYY-MM-DD`. Derive age with `ageOn(dob, ANCHOR_DATE)` — never store it. */
  dateOfBirth: IsoDate | null;
  status: ClientStatus;
  /**
   * Billing household. Siblings share the string. `null` = billed alone.
   * `athletes.family_group`.
   */
  familyGroup: string | null;
  packages: PackageState;
  compliance: Compliance;
  /** Free-form operational labels: 'state-qualifier', 'camp-2026', 'referral'. */
  tags: string[];
  joinedAt: IsoDate;
  lastSessionAt: IsoDate | null;
  /** Total ever collected from this athlete, in cents. Derived from payments. */
  lifetimeValueCents: number;
  /** Currently unpaid, in cents. 0 unless `status === 'Owes Balance'`. */
  balanceCents: number;
  source: ClientSource;
  /** Hourly private rate when this athlete is on a legacy custom rate. */
  rateCents: number | null;
  /** Palette index 0-7 for the roster avatar. Deterministic, never random. */
  colorIndex: number;
  /** Coach's operational note. Never medical, never injury status. */
  notes: string | null;
  /** `athletes.shopify_customer_id`. Null until the store is linked. */
  shopifyCustomerId: string | null;
}

/* ==========================================================================
 * 3. SESSION / BOOKING
 *
 * Mirrors Supabase `public.sessions` + the `session_athletes` join, flattened
 * into `athleteIds` because the hub always reads them together.
 * ======================================================================== */

/**
 * What kind of mat time this was.
 *
 * `private | partner | clinic | workout | camp | group`. The first five map
 * 1:1 onto an `OfferingId`; `group` is the catch-all for open-mat and team
 * practices that were never sold as a product.
 */
export type SessionKind =
  | 'private'
  | 'partner'
  | 'clinic'
  | 'workout'
  | 'camp'
  | 'group';

/** Lifecycle. `no-show` is billed; `cancelled` is not. */
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

/** `sessions.method`. Cash and Zelle still dominate — do not drop them. */
export type PaymentMethod =
  | 'Cash'
  | 'Zelle'
  | 'Venmo'
  | 'Card'
  | 'Check'
  | 'Shopify'
  | 'Other';

/** One entry in the coaching ledger. */
export interface TrainingSession {
  id: SessionId;
  /** Local wall clock, e.g. `'2026-08-01T16:00:00'`. */
  start: IsoDateTime;
  /** Local wall clock. `end - start` is the billable duration. */
  end: IsoDateTime;
  /** Convenience mirror of `end - start`; keep the two in sync. */
  minutes: number;
  kind: SessionKind;
  /** Links the session to the product it was sold as. `null` for open mat. */
  offeringId: OfferingId | null;
  /** Attendance. One id for a private, many for a clinic. */
  athleteIds: ClientId[];
  location: string;
  /** What was worked, e.g. "Leg attacks — re-attack off the whistle". */
  focus: string;
  /** What the session is worth, in cents. 0 for an included/comped session. */
  amountCents: number;
  paid: boolean;
  /** `sessions.paid_date`. Null while unpaid. */
  paidDate: IsoDate | null;
  method: PaymentMethod | null;
  notes: string;
  status: SessionStatus;
  /** How many package sessions this consumed. Usually 1, sometimes 0. */
  sessionsUsed: number;
}

/* ==========================================================================
 * 4. CALENDAR
 *
 * A superset able to represent BOTH a JV Gold session and an event imported
 * from Jesse's Google Calendar. He runs the business from his phone, and half
 * his real week (school duals, travel, family) only exists in Google. The hub
 * has to show the whole week or it shows nothing useful.
 * ======================================================================== */

/**
 * Provenance.
 * - `jvgold` — created here, backed by a `TrainingSession`, fully editable.
 * - `google` — pulled from Google Calendar. Editable ONLY after Jesse claims
 *   it (see `readOnly`), because writing back before two-way sync exists would
 *   silently diverge from the copy on his phone.
 */
export type CalendarSource = 'jvgold' | 'google';

/** Google's `attendee.responseStatus` vocabulary, kept verbatim. */
export type AttendeeResponse =
  | 'needsAction'
  | 'declined'
  | 'tentative'
  | 'accepted';

export interface CalendarAttendee {
  /** Display label. De-identified in seed data. */
  displayName: string;
  email: string | null;
  responseStatus: AttendeeResponse;
  /** True for Jesse's own entry on the attendee list. */
  self: boolean;
  /** Set when the attendee has been matched to a roster client. */
  clientId: ClientId | null;
}

/**
 * Recurrence, stored as the RFC 5545 RRULE strings Google returns
 * (e.g. `'RRULE:FREQ=WEEKLY;BYDAY=TU,TH'`) plus a pre-rendered human label so
 * the UI never has to parse an RRULE at render time.
 */
export interface Recurrence {
  rules: string[];
  /** "Every Tuesday and Thursday" — computed once, at import. */
  label: string;
  /** Set on a single instance that was moved or edited out of a series. */
  isException: boolean;
}

/** Google `colorId`s 1-11, kept so an imported event keeps its familiar hue. */
export type GoogleColorId =
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

/** One block on the calendar, from either system. */
export interface CalendarEvent {
  id: CalendarEventId;
  source: CalendarSource;
  title: string;
  /** Local wall clock. For an all-day event this is `…T00:00:00`. */
  start: IsoDateTime;
  end: IsoDateTime;
  allDay: boolean;
  location: string | null;
  description: string | null;

  /* --- JV Gold side ---------------------------------------------------- */
  /** Set when `source === 'jvgold'` (or a claimed Google event was matched). */
  sessionId: SessionId | null;
  kind: SessionKind | null;
  offeringId: OfferingId | null;
  athleteIds: ClientId[];
  /** Money on the block, in cents. Null when the event is not billable. */
  amountCents: number | null;

  /* --- Google side ----------------------------------------------------- */
  /** `null` for a native event. Google's opaque event id when imported. */
  googleEventId: string | null;
  /** Which Google calendar it came from (an email-shaped id). */
  calendarId: string | null;
  colorId: GoogleColorId | null;
  recurrence: Recurrence | null;
  attendees: CalendarAttendee[];

  /**
   * THE IMPORTANT FLAG. `true` means the hub renders it but will not let it be
   * edited, moved, or deleted — an imported Google event Jesse has not claimed.
   * Claiming it (attaching a `sessionId`, `kind` and `amountCents`) is what
   * flips this to `false` and makes it a real JV Gold session. Until two-way
   * sync ships, treat `readOnly === true` as "display only, no writes".
   */
  readOnly: boolean;
  /** True once the event has a JV Gold session behind it. */
  claimed: boolean;
  /** Last successful pull from Google. Null for native events. */
  syncedAt: IsoDateTime | null;
}

/* ==========================================================================
 * 5. FINANCE
 * ======================================================================== */

/** Where the money came in from. Drives the revenue-by-source breakdown. */
export type RevenueSource =
  | 'shopify'
  | 'site'
  | 'cash'
  | 'zelle'
  | 'venmo'
  | 'check'
  | 'other';

/** Payment lifecycle. `refunded` amounts stay positive; the flag is the truth. */
export type PaymentStatus =
  | 'paid'
  | 'pending'
  | 'refunded'
  | 'partially-refunded'
  | 'failed';

/** What the money was for. Mirrors `registrations.items` collapsed to a label. */
export type PaymentCategory =
  | 'private'
  | 'partner'
  | 'workout'
  | 'clinic'
  | 'package'
  | 'camp'
  | 'merch'
  | 'other';

/**
 * One money movement. Mirrors Supabase `public.registrations` (one row per
 * purchase) and, once linked, one Shopify order.
 */
export interface Payment {
  id: PaymentId;
  /** When the money landed. */
  date: IsoDate;
  clientId: ClientId | null;
  /** Set when the payment settles a specific ledger session. */
  sessionId: SessionId | null;
  offeringId: OfferingId | null;
  category: PaymentCategory;
  /** Gross, in cents. Always positive, including refunds. */
  amountCents: number;
  /** Amount given back, in cents. 0 for a clean payment. */
  refundedCents: number;
  /** Processor fee withheld, in cents. 0 for cash/Zelle. */
  feeCents: number;
  /** `amountCents - refundedCents - feeCents`. Precomputed for charts. */
  netCents: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  source: RevenueSource;
  status: PaymentStatus;
  /** Human line, e.g. "Private 1-on-1 · 60 min". */
  description: string;
  /** `registrations.shopify_order_id`. Null until the store is linked. */
  shopifyOrderId: string | null;
  /** `registrations.shopify_order_name`, e.g. "#1042". */
  shopifyOrderName: string | null;
}

/** One slice of the revenue-by-source donut/bars. */
export interface RevenueBySource {
  source: RevenueSource;
  label: string;
  grossCents: number;
  netCents: number;
  /** Number of payments in this slice. */
  count: number;
  /** Share of gross, 0-100, already rounded for display. */
  share: number;
}

/** One column of the revenue chart. Six of these make the six-month view. */
export interface MonthlyRevenue {
  month: MonthKey;
  /** "Mar" — pre-rendered so no Intl call happens at render time. */
  label: string;
  grossCents: number;
  netCents: number;
  refundedCents: number;
  /** Distinct paying clients that month. */
  clients: number;
  sessions: number;
  /** Gross ÷ sessions, in cents. Rounded. */
  avgSessionCents: number;
}

/** Direction of a KPI delta — decides the arrow and whether it reads as good. */
export type KpiDirection = 'up' | 'down' | 'flat';

/** How a KPI's raw value should be rendered. */
export type KpiFormat = 'money' | 'money-compact' | 'count' | 'percent' | 'text';

/**
 * A headline figure. Exactly ONE KPI per group should set `emphasis: true` —
 * that is the one that gets the gold treatment. Restraint is the whole point.
 */
export interface KPI {
  id: string;
  /** Short uppercase label, e.g. "GROSS REVENUE". */
  label: string;
  /** Raw value: cents when `format` is money-ish, otherwise a plain number. */
  value: number;
  format: KpiFormat;
  /** Pre-formatted display string. Use this in the DOM; keep it `.tabular`. */
  display: string;
  /** Sub-label under the figure, e.g. "Last 30 days". */
  caption: string;
  /** Percent change vs the comparison period, signed. Null when N/A. */
  deltaPercent: number | null;
  direction: KpiDirection;
  /**
   * True when `direction: 'down'` is actually good (e.g. outstanding balance).
   * The UI colours on meaning, not on the arrow.
   */
  inverse: boolean;
  /** 6-12 raw points for a hand-rolled SVG sparkline. Never a chart library. */
  spark: number[];
  /** The single gold figure in its group. At most one per row. */
  emphasis: boolean;
}

/** An unpaid balance, rolled up the way Jesse actually chases it: by household. */
export interface OutstandingAccount {
  /** "Account 07" — never a family name. */
  accountLabel: string;
  familyGroup: string | null;
  clientIds: ClientId[];
  balanceCents: number;
  /** Days since the oldest unpaid session. Drives the aging buckets. */
  daysOverdue: number;
  oldestUnpaidDate: IsoDate;
  /** Count of unpaid sessions behind the balance. */
  sessionCount: number;
  lastContactedAt: IsoDate | null;
}

/* ==========================================================================
 * 6. PRODUCT
 *
 * Shaped to Shopify's Product/ProductVariant vocabulary so that swapping the
 * seed for a real Admin API response is a rename-free change. The Shopify ids
 * are `null` until the store is linked — that null IS the "not yet synced"
 * signal the products page renders.
 * ======================================================================== */

/** Shopify `ProductStatus`, lowercased. */
export type ProductStatus = 'active' | 'draft' | 'archived';

/** Shopify's inventory policy: what happens at zero stock. */
export type InventoryPolicy = 'deny' | 'continue';

/** How the thing is delivered — decides which fields matter. */
export type ProductCategory =
  | 'session'
  | 'package'
  | 'camp'
  | 'clinic'
  | 'apparel'
  | 'gear'
  | 'digital';

export interface ProductImage {
  /**
   * A photo id from `~/lib/photos.ts`, used with `<Img id=… />`.
   * NOT a URL — the CSP is same-origin only and forbids external assets.
   */
  photoId: string;
  altText: string;
}

/** A purchasable variant. Price and inventory live here, as in Shopify. */
export interface ProductVariant {
  id: VariantId;
  /** "Default", "60 min", "Large", "3-Day". Shopify's variant title. */
  title: string;
  sku: string;
  priceCents: number;
  /** Strike-through price, in cents. Null when not on sale. */
  compareAtPriceCents: number | null;
  currency: CurrencyCode;
  /** Units on hand. Null when inventory is not tracked (most services). */
  inventoryQuantity: number | null;
  inventoryPolicy: InventoryPolicy;
  /** Null until the store is linked. `gid://shopify/ProductVariant/…` after. */
  shopifyVariantId: string | null;
}

/** A bookable offering or an add-on, in Shopify's vocabulary. */
export interface Product {
  id: ProductId;
  title: string;
  /** URL slug. Must match the Shopify handle exactly once created. */
  handle: string;
  description: string;
  status: ProductStatus;
  category: ProductCategory;
  /** The training offering this sells, when there is one. */
  offeringId: OfferingId | null;

  /** Default-variant price, mirrored up for list rendering. In cents. */
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: CurrencyCode;
  /** Default-variant SKU, mirrored up. */
  sku: string;
  /** Total across variants. Null when inventory is not tracked. */
  inventory: number | null;

  variants: ProductVariant[];
  images: ProductImage[];
  tags: string[];
  /** Shopify's vendor/product-type fields, kept for a clean import. */
  vendor: string;
  productType: string;

  /** Null until the store is linked. `gid://shopify/Product/…` after. */
  shopifyProductId: string | null;
  /** Convenience mirror of the default variant's Shopify id. */
  shopifyVariantId: string | null;

  /* Trailing-window commerce stats, precomputed for the products page. */
  unitsSold: number;
  revenueCents: number;
  /** Percent of sessions of this type that got booked. 0-100. */
  conversionRate: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/* ==========================================================================
 * 7. SYNC STATUS
 *
 * The hub must be honest about the fact that nothing is live yet. Every page
 * that shows a figure should be able to say where it came from.
 * ======================================================================== */

export type ConnectionState = 'connected' | 'disconnected' | 'error' | 'partial';

export interface IntegrationStatus {
  id: 'shopify' | 'supabase' | 'google-calendar' | 'stripe';
  label: string;
  state: ConnectionState;
  /** One line the UI prints verbatim. Be plain about what is not working. */
  detail: string;
  lastSyncedAt: IsoDateTime | null;
  /** Records currently held locally in the seed for this integration. */
  recordCount: number;
}

/* ==========================================================================
 * 8. THE DATASET
 *
 * The single object a loader returns. When Shopify + Supabase are live, build
 * this same object from the live queries and every page keeps working.
 * ======================================================================== */

export interface OpsDataset {
  /** The date the whole dataset is anchored to. Never `Date.now()`. */
  anchorDate: IsoDate;
  clients: Client[];
  sessions: TrainingSession[];
  calendar: CalendarEvent[];
  payments: Payment[];
  products: Product[];
  monthlyRevenue: MonthlyRevenue[];
  revenueBySource: RevenueBySource[];
  outstanding: OutstandingAccount[];
  kpis: KPI[];
  integrations: IntegrationStatus[];
}
