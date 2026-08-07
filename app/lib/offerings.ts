/**
 * Training offerings, availability rules and the pricing engine behind
 * /train. Everything a human might want to edit — prices, camp dates,
 * clinic capacity, which weeknights are open — lives in this file.
 *
 * All rates are provisional for the 2026 founding season.
 *
 * Availability is generated deterministically from a hash of the date, so the
 * server render and the client hydration always agree. When real availability
 * lands, replace `slotsFor()` / `canStartCampOn()` with loader data — the
 * components only ever talk to the helpers exported here.
 *
 * MONEY IN THIS FILE IS US DOLLARS, not cents. (`app/lib/ops` keeps its own
 * ledger in integer cents and exports a different `formatMoney`; the two are
 * deliberately separate units and must never be mixed without an explicit
 * conversion.)
 *
 * Dollars here are allowed to carry cents. The six-month Dedicated Workout
 * rate is $127.50 and nothing is permitted to round that away: every derived
 * rate goes through `roundMoney()` so it lands on an exact cent, the term
 * total is always `rate × cycles` of that already-rounded rate — so the
 * monthly figure on screen times the months is exactly the amount charged —
 * and `formatMoney()` prints the cents only when they exist.
 *
 * ONE ENGINE. Every price on screen must trace back to a function exported
 * here. Components never multiply, discount or divide a rate themselves: if a
 * picker needs a figure the receipt doesn't already carry, add a helper here
 * rather than re-deriving it at the call site. A picker that does its own
 * arithmetic will eventually disagree with the receipt, and a customer will be
 * shown a price they are not charged.
 */

/* ------------------------------------------------------------------ */
/* Dates — small, dependency-free, timezone-safe (local civil dates).  */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Column headers for the month grid. */
export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-08-14` for year/monthIndex/day. */
export function isoFrom(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function isoOf(date: Date): string {
  return isoFrom(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Parses `YYYY-MM-DD` as a local civil date (never UTC-shifted). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayOf(iso: string): number {
  return parseIso(iso).getDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** `2026-08` */
export function monthKeyOf(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

export function splitMonthKey(key: string): {year: number; month: number} {
  const [y, m] = key.split('-').map(Number);
  return {year: y, month: m - 1};
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const {year, month} = splitMonthKey(key);
  return `${MONTH_NAMES[month]} ${year}`;
}

export function monthShortLabel(key: string): string {
  const {year, month} = splitMonthKey(key);
  return `${MONTH_NAMES[month].slice(0, 3)} ${year}`;
}

/** `Saturday, August 15, 2026` */
export function formatLongDate(iso: string): string {
  const d = parseIso(iso);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** `Sat, Aug 15` */
export function formatMediumDate(iso: string): string {
  const d = parseIso(iso);
  return `${DAY_ABBR[d.getDay()]}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/**
 * `Sat, Aug 15, 2027` — for dates far enough out that a bare month and day
 * would be ambiguous, like the renewal of a twelve-month plan.
 */
export function formatMediumDateWithYear(iso: string): string {
  return `${formatMediumDate(iso)}, ${parseIso(iso).getFullYear()}`;
}

/** `Aug 14 – 16, 2026` (collapses the month when the range doesn't cross one). */
export function formatDateRange(startIso: string, endIso: string): string {
  const a = parseIso(startIso);
  const b = parseIso(endIso);
  const am = MONTH_NAMES[a.getMonth()].slice(0, 3);
  const bm = MONTH_NAMES[b.getMonth()].slice(0, 3);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${am} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${am} ${a.getDate()} – ${bm} ${b.getDate()}, ${b.getFullYear()}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

/**
 * Adds whole months, clamping to the end of the shorter month — a plan whose
 * first charge lands on Jan 31 renews on Feb 28, not Mar 3.
 */
export function addMonthsIso(iso: string, months: number): string {
  const d = parseIso(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  return isoFrom(year, month, Math.min(d.getDate(), daysInMonth(year, month)));
}

export function isoInRange(iso: string, startIso: string, endIso: string): boolean {
  return iso >= startIso && iso <= endIso;
}

/**
 * The months the calendar offers. Fixed to the founding season so the server
 * and the browser never disagree about which months exist.
 */
export const SEASON_START_MONTH = '2026-08';
export const SEASON_MONTH_COUNT = 6;
export const SEASON_LABEL = '2026 founding season';

export function seasonMonths(): string[] {
  const {year, month} = splitMonthKey(SEASON_START_MONTH);
  const out: string[] = [];
  for (let i = 0; i < SEASON_MONTH_COUNT; i++) {
    const d = new Date(year, month + i, 1);
    out.push(monthKeyOf(d.getFullYear(), d.getMonth()));
  }
  return out;
}

/** Every date in `monthKey` that falls on one of `weekdays`. */
export function datesForWeekdaysInMonth(
  monthKey: string,
  weekdays: number[],
): string[] {
  if (weekdays.length === 0) return [];
  const {year, month} = splitMonthKey(monthKey);
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    if (weekdays.includes(new Date(year, month, day).getDay())) {
      out.push(isoFrom(year, month, day));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type OfferingId =
  | 'private'
  | 'partner'
  | 'workout'
  | 'clinic'
  | 'package'
  | 'camp';

export type BookingMode =
  | 'single-date'
  | 'session-list'
  | 'weekly-pattern'
  | 'camp-block';

export type TimeBandId = 'morning' | 'afternoon' | 'evening';

export interface TimeSlot {
  id: string;
  label: string;
  band: TimeBandId;
}

export interface TimeBand {
  id: TimeBandId;
  label: string;
  window: string;
}

/**
 * How an offering bills when no discounted term is attached.
 *   `once`    — one charge, one session (private, partner, workout, clinic)
 *   `monthly` — recurring by nature; a package renews even month-to-month
 *   `deposit` — a deposit now, the balance before the dates (camp)
 */
export type Cadence = 'once' | 'monthly' | 'deposit';

interface OfferingBase {
  id: OfferingId;
  /** Bracketed micro-label on the card. */
  index: string;
  name: string;
  /** One line: who this is for. */
  bestFor: string;
  blurb: string;
  /**
   * DERIVED — do not hand-write these. `buildOffering()` computes them from
   * the numeric fields below, so a label can never drift from its price.
   * They are the ONE-OFF list rate; for the rate under a subscription term,
   * call `headlineFor(offering, term)`.
   */
  priceFrom: string;
  priceUnit: string;
  duration: string;
  includes: string[];
  photoId: string;
  /** Copy for the schedule step heading. */
  scheduleHeading: string;
  scheduleHint: string;
  featured?: boolean;
  /**
   * Can this be bought as a discounted subscription term? Camp is false — it
   * is a host booking sold to clubs and schools by the day, not a consumer
   * subscription. Clinic is false too: its sessions are five fixed dates with
   * their own bundle discount, and the client's price matrix gives it no term
   * rates. Neither may be given a term without Jesse pricing it first.
   */
  subscribable: boolean;
  /** What this bills like at term `once`. See `Cadence`. */
  baseCadence: Cadence;
}

export interface SingleDateOffering extends OfferingBase {
  mode: 'single-date';
  /** Total charged for the session, regardless of athlete count. */
  price: number;
  athletes: number;
  minutes: number;
  /** Weekday (0 = Sunday) → the slots Jesse opens that day. */
  availability: Record<number, TimeSlot[]>;
  availabilityNote: string;
  /** Percentage of slots already booked, for the generated demo calendar. */
  bookedRate: number;
  splitNote?: string;
}

export interface ClinicSession {
  id: string;
  dateIso: string;
  title: string;
  focus: string;
  window: string;
  capacity: number;
  spotsRemaining: number;
}

export interface SessionListOffering extends OfferingBase {
  mode: 'session-list';
  pricePerSession: number;
  bundleSize: number;
  bundlePrice: number;
  sessions: ClinicSession[];
}

export interface PackageTier {
  id: string;
  name: string;
  /** Minimum days/week that unlocks this tier. */
  minDays: number;
  maxDays: number;
  monthly: number;
  perks: string[];
}

export interface WeeklyPatternOffering extends OfferingBase {
  mode: 'weekly-pattern';
  weekdayOptions: number[];
  bands: TimeBand[];
  tiers: PackageTier[];
  minDays: number;
  location: string;
}

/**
 * A camp is a booking of Jesse, not a per-athlete ticket. A host — a club, a
 * school, an event organiser — reserves him for consecutive days and pays the
 * day rate for every one of them. The host supplies the room and the athletes.
 */
export interface CampOffering extends OfferingBase {
  mode: 'camp-block';
  /** Charged for every consecutive day of the booking. */
  dayRate: number;
  minDays: number;
  maxDays: number;
  /** Deposit as a share of the booking, e.g. 0.25 → a quarter of the total. */
  depositShare: number;
  /** Balance falls due this many days before day one. */
  balanceDueDaysBefore: number;
  /** What a day with Jesse contains. */
  dayFormat: string[];
  /** What the host is responsible for. */
  hostProvides: string[];
}

export type Offering =
  | SingleDateOffering
  | SessionListOffering
  | WeeklyPatternOffering
  | CampOffering;

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/**
 * Snaps a dollar amount to an exact cent. Every derived rate passes through
 * here so `$150 × 0.85` becomes `127.5` and never `127.49999999999999`.
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * `$200`, `$1,500`, `$127.50`. Cents are printed only when they exist, so
 * whole-dollar rates keep reading as whole dollars.
 *
 * NOTE: `app/lib/ops` exports a DIFFERENT `formatMoney` that takes integer
 * cents. If a file needs both, alias one of them.
 */
export function formatMoney(amount: number): string {
  const value = roundMoney(amount);
  const digits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  })}`;
}

/* ------------------------------------------------------------------ */
/* Subscription terms                                                  */
/* ------------------------------------------------------------------ */

/**
 * The commitment a buyer chooses. `once` is a single charge (or, on an
 * offering that is monthly by nature, month-to-month with no minimum).
 *
 * Discounts confirmed by the client: 3 months −10%, 6 months −15%,
 * 12 months −20%. TWELVE MONTHS IS THE DEFAULT SELECTION.
 */
export type SubscriptionTerm = 'once' | 'm3' | 'm6' | 'm12';

export interface TermDefinition {
  id: SubscriptionTerm;
  /** How a single-charge offering names the term. */
  label: string;
  /** How a monthly-by-nature offering names it ('Month to month'). */
  recurringLabel: string;
  /** Compact label for a segmented control. */
  shortLabel: string;
  /** Months in the minimum commitment. */
  months: number;
  /** Monthly charges inside the minimum commitment. */
  cycles: number;
  /** 0, 0.1, 0.15, 0.2. */
  discountRate: number;
  /** `20% off`, or '' when there is no discount. */
  discountLabel: string;
  /** Does choosing this term create a recurring charge? */
  renews: boolean;
  /**
   * Shopify sellingPlan `minCycles`. The commitment is a MINIMUM, not a hard
   * stop — the plan auto-renews past it — so `maxCycles` is deliberately never
   * set anywhere in this file.
   */
  minCycles: number | null;
  /** Sales copy for the term control. */
  blurb: string;
  /** How the buyer gets out. Rendered verbatim in the disclosures. */
  cancelCopy: string;
  /**
   * California requires a pre-renewal notice for automatic renewal terms of
   * twelve months or more. See PRE_RENEWAL_NOTICE_DAYS.
   */
  requiresPreRenewalNotice: boolean;
}

/** Display order for a term picker: cheapest commitment first, best value last. */
export const TERM_ORDER: SubscriptionTerm[] = ['once', 'm3', 'm6', 'm12'];

/**
 * Preselected on every subscribable offering. Preselecting a PLAN is lawful
 * and intended; pre-checking CONSENT is not — see `RenewalTerms.consentLabel`.
 */
export const DEFAULT_TERM: SubscriptionTerm = 'm12';

/** Cancel-any-time language shared by every renewing term. */
const CANCEL_ONLINE =
  'Cancel online at any time from your account — no phone call, no email, no retention offer.';

export const TERMS: Record<SubscriptionTerm, TermDefinition> = {
  once: {
    id: 'once',
    label: 'One-off',
    recurringLabel: 'Month to month',
    shortLabel: 'Once',
    months: 1,
    cycles: 1,
    discountRate: 0,
    discountLabel: '',
    renews: false,
    minCycles: null,
    blurb: 'Pay for the one session. Nothing recurring, nothing to cancel.',
    cancelCopy: CANCEL_ONLINE,
    requiresPreRenewalNotice: false,
  },
  m3: {
    id: 'm3',
    label: '3 months',
    recurringLabel: '3 months',
    shortLabel: '3 mo',
    months: 3,
    cycles: 3,
    discountRate: 0.1,
    discountLabel: '10% off',
    renews: true,
    minCycles: 3,
    blurb: 'A season block. Renews month to month after the three.',
    cancelCopy: CANCEL_ONLINE,
    requiresPreRenewalNotice: false,
  },
  m6: {
    id: 'm6',
    label: '6 months',
    recurringLabel: '6 months',
    shortLabel: '6 mo',
    months: 6,
    cycles: 6,
    discountRate: 0.15,
    discountLabel: '15% off',
    renews: true,
    minCycles: 6,
    blurb: 'Half a year of standing work. Renews after the six.',
    cancelCopy: CANCEL_ONLINE,
    requiresPreRenewalNotice: false,
  },
  m12: {
    id: 'm12',
    label: '12 months',
    recurringLabel: '12 months',
    shortLabel: '12 mo',
    months: 12,
    cycles: 12,
    discountRate: 0.2,
    discountLabel: '20% off',
    renews: true,
    minCycles: 12,
    blurb: 'The full year, at the lowest rate. Renews after the twelve.',
    cancelCopy: CANCEL_ONLINE,
    requiresPreRenewalNotice: true,
  },
};

/**
 * California's Automatic Renewal Law requires a reminder 15–45 days before an
 * automatic renewal term of twelve months or more renews.
 */
export const PRE_RENEWAL_NOTICE_DAYS = {min: 15, max: 45};

/**
 * FALSE until a reminder is genuinely scheduled and sent.
 *
 * While this is false, `RenewalSchedule` is an OPS obligation, not a customer
 * promise: do not render "we will email you before it renews" anywhere a buyer
 * can read it. Telling a family a notice is coming when nothing sends it is
 * both a lie and the exact compliance failure the notice exists to prevent.
 * Flip this to true in the same change that wires the send.
 */
export const PRE_RENEWAL_NOTICE_WIRED = false;

/**
 * The priced result of applying a term to a list rate. THE single place the
 * discount arithmetic happens — nothing else in the app multiplies by
 * `discountRate`.
 */
export interface TermPricing {
  term: SubscriptionTerm;
  /** `12 months`, or `Month to month` on a recurring offering at `once`. */
  label: string;
  shortLabel: string;
  months: number;
  cycles: number;
  renews: boolean;
  discountRate: number;
  discountLabel: string;
  /** The undiscounted rate for one cycle. */
  listRate: number;
  /** What is actually charged each cycle. Already rounded to the cent. */
  rate: number;
  /** `rate × cycles` — the minimum commitment, in full. */
  commitmentTotal: number;
  /** `listRate × cycles − commitmentTotal`. Zero when there is no discount. */
  savings: number;
  /** sellingPlan minCycles. Never paired with a maxCycles. */
  minCycles: number | null;
  /** `$160/mo`, or `$200` when nothing recurs. */
  rateLabel: string;
}

export interface TermPricingOptions {
  /**
   * True for offerings that bill monthly whatever term is chosen — a package
   * at `once` is month-to-month with no minimum, and still auto-renews.
   */
  alwaysRecurring?: boolean;
}

export function termPricing(
  listRate: number,
  term: SubscriptionTerm,
  options: TermPricingOptions = {},
): TermPricing {
  const def = TERMS[term];
  const recurring = def.renews || options.alwaysRecurring === true;
  const listOne = roundMoney(listRate);
  // Round the per-cycle rate first, then multiply. The buyer is charged this
  // rounded figure every cycle, so the term total must be built from it —
  // discounting the total and dividing would leave the "/mo" figure on screen
  // a cent adrift from the money that actually moves.
  const rate = roundMoney(listOne * (1 - def.discountRate));
  const commitmentTotal = roundMoney(rate * def.cycles);

  return {
    term,
    label: recurring ? def.recurringLabel : def.label,
    shortLabel: def.shortLabel,
    months: def.months,
    cycles: def.cycles,
    renews: recurring,
    discountRate: def.discountRate,
    discountLabel: def.discountLabel,
    listRate: listOne,
    rate,
    commitmentTotal,
    savings: roundMoney(listOne * def.cycles - commitmentTotal),
    minCycles: def.minCycles,
    rateLabel: `${formatMoney(rate)}${recurring ? '/mo' : ''}`,
  };
}

/* ------------------------------------------------------------------ */
/* Auto-renewal disclosures                                            */
/* ------------------------------------------------------------------ */

/**
 * Everything California's Automatic Renewal Law (Bus & Prof Code 17600 et
 * seq., as amended by AB 2863, effective July 2025) and federal ROSCA require
 * a buyer to be shown before a recurring charge is authorised. Jesse sells
 * from Riverside to California families, so this applies to every renewing
 * plan in this file.
 *
 * How the UI must use it:
 *   - `headline`, `amountLine`, `commitmentLine`, `cancelLine` are the "clear
 *     and conspicuous" disclosures. Set them off in larger or contrasting
 *     type — not body copy — in visual proximity to the consent control, and
 *     show them again beside the billing details.
 *   - `consentLabel` is ONE separate affirmative action, tied specifically to
 *     the auto-renewal. It must render INITIALLY UNCHECKED, must not be the
 *     general terms box, and must not be folded into the submit button's fine
 *     print. Preselecting the 12-month PLAN is fine; pre-checking this is not.
 *   - Cancellation must be completable online, at will, without extra steps.
 *
 * This is researched fact, not legal advice. A California attorney should
 * review this flow before launch.
 */
export interface RenewalTerms {
  term: SubscriptionTerm;
  /** The one-line statement that this does not stop on its own. */
  headline: string;
  /** The recurring amount and its frequency. */
  amountLine: string;
  /** The minimum commitment and what it costs in full. */
  commitmentLine: string;
  /** How to get out. */
  cancelLine: string;
  /** Label for the separate, initially-unchecked consent control. */
  consentLabel: string;
  /** The four disclosure lines, for a boxed summary. */
  bullets: string[];
  /** Null unless the term is long enough to require a reminder. */
  preRenewalNoticeDays: {min: number; max: number} | null;
  /**
   * Internal wording for the reminder obligation. Null when not required.
   * Do NOT show this to a buyer while `PRE_RENEWAL_NOTICE_WIRED` is false.
   */
  preRenewalNotice: string | null;
}

export function renewalTerms(pricing: TermPricing): RenewalTerms {
  const def = TERMS[pricing.term];
  const every = `${formatMoney(pricing.rate)} every month`;

  const headline = 'This plan renews automatically until you cancel.';
  const amountLine = `${every}, charged on the same day each month.`;
  const commitmentLine =
    pricing.minCycles === null
      ? 'Month to month — no minimum term.'
      : `${pricing.months}-month minimum: ${pricing.cycles} charges of ${formatMoney(
          pricing.rate,
        )}, ${formatMoney(pricing.commitmentTotal)} in total.`;
  const cancelLine = def.cancelCopy;

  const requiresNotice = def.requiresPreRenewalNotice && pricing.renews;

  return {
    term: pricing.term,
    headline,
    amountLine,
    commitmentLine,
    cancelLine,
    consentLabel: `I agree to a recurring charge of ${every}${
      pricing.minCycles === null
        ? ''
        : `, with a ${pricing.months}-month minimum`
    }, which continues automatically until I cancel.`,
    bullets: [headline, amountLine, commitmentLine, cancelLine],
    preRenewalNoticeDays: requiresNotice ? PRE_RENEWAL_NOTICE_DAYS : null,
    preRenewalNotice: requiresNotice
      ? `A ${pricing.months}-month term requires a renewal reminder ${PRE_RENEWAL_NOTICE_DAYS.min}–${PRE_RENEWAL_NOTICE_DAYS.max} days before it renews.`
      : null,
  };
}

/** When a plan renews, and the window its reminder has to land in. */
export interface RenewalSchedule {
  firstChargeIso: string;
  cycles: number;
  /** Last charge inside the minimum term. */
  lastCommittedIso: string;
  /** First charge after the minimum — the renewal itself. */
  renewsOnIso: string;
  renewsOnLabel: string;
  /** 45 days before the renewal. */
  noticeEarliestIso: string;
  /** 15 days before the renewal. */
  noticeLatestIso: string;
  noticeWindowLabel: string;
  /** False when the term is too short to require a notice. */
  noticeRequired: boolean;
}

/**
 * Models the renewal calendar for a plan whose first charge is `firstChargeIso`.
 * Returns null when the term does not renew. Pure civil-date arithmetic — no
 * `new Date()` at render time, so the server and the browser always agree.
 */
export function renewalScheduleFor(
  firstChargeIso: string,
  term: SubscriptionTerm,
): RenewalSchedule | null {
  const def = TERMS[term];
  if (!def.renews) return null;

  const renewsOnIso = addMonthsIso(firstChargeIso, def.cycles);
  const noticeEarliestIso = addDaysIso(renewsOnIso, -PRE_RENEWAL_NOTICE_DAYS.max);
  const noticeLatestIso = addDaysIso(renewsOnIso, -PRE_RENEWAL_NOTICE_DAYS.min);

  return {
    firstChargeIso,
    cycles: def.cycles,
    lastCommittedIso: addMonthsIso(firstChargeIso, def.cycles - 1),
    renewsOnIso,
    // Carries the year: a twelve-month plan renews far enough out that a bare
    // `Aug 25` reads as this month.
    renewsOnLabel: formatMediumDateWithYear(renewsOnIso),
    noticeEarliestIso,
    noticeLatestIso,
    noticeWindowLabel: formatDateRange(noticeEarliestIso, noticeLatestIso),
    noticeRequired: def.requiresPreRenewalNotice,
  };
}

/* ------------------------------------------------------------------ */
/* Slot vocabulary                                                     */
/* ------------------------------------------------------------------ */

const EVENING_SLOTS: TimeSlot[] = [
  {id: 'e400', label: '4:00 PM', band: 'evening'},
  {id: 'e515', label: '5:15 PM', band: 'evening'},
  {id: 'e630', label: '6:30 PM', band: 'evening'},
  {id: 'e745', label: '7:45 PM', band: 'evening'},
];

const SATURDAY_SLOTS: TimeSlot[] = [
  {id: 's800', label: '8:00 AM', band: 'morning'},
  {id: 's915', label: '9:15 AM', band: 'morning'},
  {id: 's1030', label: '10:30 AM', band: 'morning'},
];

const WORKOUT_SLOTS: TimeSlot[] = [
  {id: 'w600', label: '6:00 AM', band: 'morning'},
  {id: 'w330', label: '3:30 PM', band: 'afternoon'},
  {id: 'w600p', label: '6:00 PM', band: 'evening'},
];

const WORKOUT_SATURDAY: TimeSlot[] = [
  {id: 'w900', label: '9:00 AM', band: 'morning'},
  {id: 'w1100', label: '11:00 AM', band: 'morning'},
];

export const TIME_BANDS: TimeBand[] = [
  {id: 'morning', label: 'Morning', window: '6:00 – 8:00 AM'},
  {id: 'afternoon', label: 'Afternoon', window: '3:00 – 5:00 PM'},
  {id: 'evening', label: 'Evening', window: '5:00 – 8:00 PM'},
];

/* ------------------------------------------------------------------ */
/* The offerings                                                       */
/* ------------------------------------------------------------------ */

/**
 * The literal below omits `priceFrom` and `priceUnit` on purpose: they are
 * DERIVED from the numeric fields by `buildOffering()`, so a headline price
 * can never drift from the number it is supposed to describe.
 *
 * Copy strings may embed a price with a `{token}` — `{price}`, `{perAthlete}`,
 * `{dayRate}`, `{bundlePrice}`, `{bundleSize}`, `{sessionPrice}`, `{monthly}`,
 * `{headline}`. The tokens are resolved from the same numbers at module load,
 * so editing a rate updates every sentence that quotes it. Write a price into
 * copy as a literal and it WILL go stale.
 */
type DerivedCopyKey = 'priceFrom' | 'priceUnit';

type OfferingSource =
  | Omit<SingleDateOffering, DerivedCopyKey>
  | Omit<SessionListOffering, DerivedCopyKey>
  | Omit<WeeklyPatternOffering, DerivedCopyKey>
  | Omit<CampOffering, DerivedCopyKey>;

const OFFERING_SOURCE: OfferingSource[] = [
  {
    id: 'private',
    index: '01',
    mode: 'single-date',
    name: 'Private 1-on-1',
    bestFor: 'One athlete, undivided attention.',
    blurb:
      'The full standard: individual technique work, live situations, and a development plan built around your athlete. Every session ends with clear homework.',
    duration: '60 minutes',
    subscribable: true,
    baseCadence: 'once',
    price: 200,
    athletes: 1,
    minutes: 60,
    includes: [
      '60 minutes, one athlete',
      'Video review on request',
      'Written plan + homework',
    ],
    availability: {
      2: EVENING_SLOTS,
      4: EVENING_SLOTS,
      6: SATURDAY_SLOTS,
    },
    availabilityNote: 'Tuesday & Thursday evenings · Saturday mornings',
    bookedRate: 34,
    photoId: '25CMW_SCUFFLE_QF_6387',
    scheduleHeading: 'Pick your mat time',
    scheduleHint:
      'Choose a date, then an open hour. Sessions are held at the Riverside room.',
    featured: true,
  },
  {
    id: 'partner',
    index: '02',
    mode: 'single-date',
    name: 'Partner Session',
    bestFor: 'Two athletes who push each other.',
    blurb:
      'Bring a teammate or a sibling. Same intensity, a built-in live drilling partner, and a rate the two families share.',
    duration: '60 minutes',
    subscribable: true,
    baseCadence: 'once',
    price: 200,
    athletes: 2,
    minutes: 60,
    splitNote: '{price} total, split between two families',
    includes: [
      '60 minutes, two athletes',
      'Built-in drilling partner',
      'Shared rate, same standard',
    ],
    availability: {
      2: EVENING_SLOTS,
      4: EVENING_SLOTS,
      6: SATURDAY_SLOTS,
    },
    availabilityNote: 'Tuesday & Thursday evenings · Saturday mornings',
    bookedRate: 28,
    photoId: '25CMW_SCUFFLE_QF_6342',
    scheduleHeading: 'Pick your mat time',
    scheduleHint:
      'One booking covers both athletes. Name your partner in the notes at the end.',
  },
  {
    id: 'workout',
    index: '03',
    mode: 'single-date',
    name: 'Dedicated Workout',
    bestFor: 'Conditioning that carries into the third period.',
    blurb:
      'A strength and conditioning block followed by a live wrestling block — the exact work Jesse used to build a motor that never broke in a final.',
    duration: '90 minutes',
    subscribable: true,
    baseCadence: 'once',
    price: 150,
    athletes: 1,
    minutes: 90,
    includes: [
      '45 min strength & conditioning',
      '45 min live wrestling block',
      'Benchmarks tracked session to session',
    ],
    availability: {
      1: WORKOUT_SLOTS,
      3: WORKOUT_SLOTS,
      5: WORKOUT_SLOTS,
      6: WORKOUT_SATURDAY,
    },
    availabilityNote: 'Monday · Wednesday · Friday · Saturday',
    bookedRate: 22,
    photoId: '25CMW_SCUFFLE_QF_6325',
    scheduleHeading: 'Pick your workout',
    scheduleHint:
      '90 minutes. Come fed, hydrated, and ready to be uncomfortable.',
  },
  {
    id: 'clinic',
    index: '04',
    mode: 'session-list',
    name: 'Small-Group Clinic',
    bestFor: 'Teams, clubs and schools.',
    blurb:
      'Position-focused clinics — leg attacks, top pressure, short offense. High-level technique taught to a room, then drilled live.',
    duration: '2 hours',
    // Fixed dates with their own bundle discount, and no term rates in the
    // client's matrix. Not subscribable until Jesse prices one.
    subscribable: false,
    baseCadence: 'once',
    pricePerSession: 100,
    bundleSize: 3,
    bundlePrice: 200,
    includes: [
      'Up to 20 athletes per clinic',
      '{bundleSize}-session bundle at {bundlePrice} — provisional',
      'Team & club dates by request',
    ],
    sessions: [
      {
        id: 'cl-aug22',
        dateIso: '2026-08-22',
        title: 'Leg Attacks & Finishes',
        focus: 'Entries, re-attacks, finishing on the edge',
        window: '9:00 – 11:00 AM',
        capacity: 20,
        spotsRemaining: 6,
      },
      {
        id: 'cl-sep12',
        dateIso: '2026-09-12',
        title: 'Top Pressure & Turns',
        focus: 'Rides, breakdowns, legs, and the tilt game',
        window: '9:00 – 11:00 AM',
        capacity: 20,
        spotsRemaining: 14,
      },
      {
        id: 'cl-oct03',
        dateIso: '2026-10-03',
        title: 'Short Offense & Scrambles',
        focus: 'Front headlock, snaps, and winning the chaos',
        window: '9:00 – 11:00 AM',
        capacity: 20,
        spotsRemaining: 20,
      },
      {
        id: 'cl-nov07',
        dateIso: '2026-11-07',
        title: 'Hand Fighting & Ties',
        focus: 'Setting the level before the level change',
        window: '9:00 – 11:00 AM',
        capacity: 20,
        spotsRemaining: 3,
      },
      {
        id: 'cl-dec05',
        dateIso: '2026-12-05',
        title: 'Bottom Escapes & Reversals',
        focus: 'Standing up on the whistle, every time',
        window: '9:00 – 11:00 AM',
        capacity: 20,
        spotsRemaining: 0,
      },
    ],
    photoId: '23CMW_ASU_STANFORD11323',
    scheduleHeading: 'Choose your clinic dates',
    scheduleHint:
      'Pick any three and the bundle rate applies automatically. Booking a whole team? Say so in the notes.',
  },
  {
    id: 'package',
    index: '05',
    mode: 'weekly-pattern',
    name: 'Monthly Private Package',
    bestFor: 'Athletes chasing a state title this season.',
    blurb:
      'Standing private sessions on the same days every week, in the Riverside area, billed monthly. The tier is set by how many days you train — the more you commit, the more of Jesse you get.',
    duration: 'Recurring weekly',
    subscribable: true,
    baseCadence: 'monthly',
    location: 'Riverside area',
    minDays: 2,
    weekdayOptions: [1, 2, 3, 4, 5, 6],
    bands: TIME_BANDS,
    tiers: [
      {
        id: 'two-day',
        name: 'Two-Day',
        minDays: 2,
        maxDays: 2,
        monthly: 1400,
        perks: [
          'Two 60-minute privates each week',
          'Monthly development plan',
          'Text access for match-week questions',
        ],
      },
      {
        id: 'three-day',
        name: 'Three-Day',
        minDays: 3,
        maxDays: 3,
        monthly: 2000,
        perks: [
          'Three 60-minute privates each week',
          'One conditioning block included',
          'Monthly film session',
        ],
      },
      {
        id: 'gold-standard',
        name: 'Gold Standard',
        minDays: 4,
        maxDays: 6,
        monthly: 3200,
        perks: [
          'Four to six sessions each week',
          'Film review after every competition',
          'Jesse in your corner at two events a month',
          'Priority on all camp dates',
        ],
      },
    ],
    includes: [
      'Standing days, same time each week',
      'Riverside-area training',
      'Film review at the top tiers',
    ],
    photoId: '24COL_NCAA_RND16_9991',
    scheduleHeading: 'Build your training week',
    scheduleHint:
      'Choose the days your athlete trains. The tier and the monthly rate follow the commitment.',
    featured: true,
  },
  {
    id: 'camp',
    index: '06',
    mode: 'camp-block',
    name: 'Camp Booking',
    bestFor: 'Clubs, schools and event hosts.',
    blurb:
      'Bring Jesse in for consecutive days and hand him the room. Four straight California state titles across three high schools, the first Southern California wrestler to four-peat, a National Wrestling Hall of Fame honoree, a Pac-12 title at 141 and an NCAA berth, a Mexico National Team singlet — and a coach who now runs his own room every week. One rate, one clinician, every day of the camp.',
    duration: '1–5 consecutive days',
    // CAMP IS EXCLUDED from the subscription matrix by the client: it is a
    // host booking sold to clubs and schools by the day, not a consumer
    // subscription. Never give it a term.
    subscribable: false,
    baseCadence: 'deposit',
    dayRate: 1500,
    minDays: 1,
    maxDays: 5,
    depositShare: 0.25,
    balanceDueDaysBefore: 21,
    dayFormat: [
      'A full coaching day, built with the host',
      'Technique taught to the room, then drilled live',
      'Film and questions in the evening block',
      'Jesse on the mat for every session — no assistants sent in his place',
    ],
    hostProvides: [
      'The venue, the mats and the schedule window',
      'The athletes — you set the headcount, the ages and the level',
      'Travel and lodging agreed with Jesse for dates outside Southern California',
    ],
    includes: [
      '{dayRate} per day, every consecutive day',
      'Your room, your athletes, your dates',
      'A quarter down holds the dates',
    ],
    photoId: '20CIFFNL3895',
    scheduleHeading: 'Book Jesse by the day',
    scheduleHint:
      'Pick day one, then how many consecutive days you want him. The rate is {dayRate} a day and the total moves as you do.',
  },
];

/* ------------------------------------------------------------------ */
/* Derived display copy                                                */
/* ------------------------------------------------------------------ */

/**
 * The undiscounted headline for a card: the number and the unit under it.
 * This is the ONLY definition of "what price does this offering lead with".
 */
function listHeadline(offering: OfferingSource): {
  amount: number;
  unit: string;
} {
  switch (offering.mode) {
    case 'single-date':
      // Two athletes share one mat and one invoice, so the card leads with a
      // family's share rather than the number neither of them pays alone.
      return offering.athletes > 1
        ? {
            amount: roundMoney(offering.price / offering.athletes),
            unit: 'per athlete',
          }
        : {
            amount: offering.price,
            unit: offering.minutes === 60 ? 'per hour' : 'per session',
          };
    case 'session-list':
      return {amount: offering.pricePerSession, unit: 'per athlete / day'};
    case 'weekly-pattern':
      return {
        amount: Math.min(...offering.tiers.map((t) => t.monthly)),
        unit: 'per month',
      };
    case 'camp-block':
      return {amount: offering.dayRate, unit: 'per day'};
  }
}

/** Every price this offering is allowed to quote in its own copy. */
function copyTokens(offering: OfferingSource): Record<string, string> {
  const headline = listHeadline(offering);
  const tokens: Record<string, string> = {
    headline: formatMoney(headline.amount),
    headlineUnit: headline.unit,
  };

  switch (offering.mode) {
    case 'single-date':
      tokens.price = formatMoney(offering.price);
      tokens.perAthlete = formatMoney(
        roundMoney(offering.price / offering.athletes),
      );
      tokens.athletes = String(offering.athletes);
      break;
    case 'session-list':
      tokens.sessionPrice = formatMoney(offering.pricePerSession);
      tokens.bundlePrice = formatMoney(offering.bundlePrice);
      tokens.bundleSize = String(offering.bundleSize);
      break;
    case 'weekly-pattern':
      tokens.monthly = formatMoney(headline.amount);
      tokens.minDays = String(offering.minDays);
      break;
    case 'camp-block':
      tokens.dayRate = formatMoney(offering.dayRate);
      tokens.minDays = String(offering.minDays);
      tokens.maxDays = String(offering.maxDays);
      break;
  }

  return tokens;
}

/** Replaces `{token}` with its resolved value. Unknown tokens are left alone. */
function fillCopy(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in tokens ? tokens[key] : whole,
  );
}

function buildOffering(source: OfferingSource): Offering {
  const headline = listHeadline(source);
  const tokens = copyTokens(source);
  const shared = {
    priceFrom: formatMoney(headline.amount),
    priceUnit: headline.unit,
    bestFor: fillCopy(source.bestFor, tokens),
    blurb: fillCopy(source.blurb, tokens),
    includes: source.includes.map((line) => fillCopy(line, tokens)),
    scheduleHint: fillCopy(source.scheduleHint, tokens),
  };

  switch (source.mode) {
    case 'single-date':
      return {
        ...source,
        ...shared,
        splitNote: source.splitNote
          ? fillCopy(source.splitNote, tokens)
          : undefined,
      };
    case 'session-list':
      return {...source, ...shared};
    case 'weekly-pattern':
      return {
        ...source,
        ...shared,
        tiers: source.tiers.map((tier) => ({
          ...tier,
          perks: tier.perks.map((perk) => fillCopy(perk, tokens)),
        })),
      };
    case 'camp-block':
      return {
        ...source,
        ...shared,
        dayFormat: source.dayFormat.map((line) => fillCopy(line, tokens)),
        hostProvides: source.hostProvides.map((line) => fillCopy(line, tokens)),
      };
  }
}

export const OFFERINGS: Offering[] = OFFERING_SOURCE.map(buildOffering);

/* ------------------------------------------------------------------ */
/* Headline pricing (the selector card)                                */
/* ------------------------------------------------------------------ */

/**
 * What a card should print for an offering under a given term. The card must
 * not assemble this itself — a hand-built "$160/mo" is exactly how a label
 * ends up disagreeing with the receipt.
 */
export interface Headline {
  term: SubscriptionTerm;
  subscribable: boolean;
  /** The rate being advertised, after any term discount. */
  amount: number;
  /** `$160` */
  price: string;
  /** `per month`, `per athlete / month`, `per hour`, `per day`… */
  unit: string;
  /** `/mo` when this recurs, '' otherwise. */
  suffix: string;
  /** `$160/mo` — price and suffix, already joined. */
  rateLabel: string;
  /** The undiscounted rate, present only when a discount applies. */
  listAmount: number | null;
  /** `$200` — strike this through next to `price`. Null when no discount. */
  listPrice: string | null;
  /** The one-off unit, for the struck-through figure. */
  listUnit: string;
  /** `20% off on the 12-month plan`. Null when no discount applies. */
  termNote: string | null;
  /** `One session a month` — what the recurring charge buys. Null if obvious. */
  frequencyNote: string | null;
}

/** A term the offering cannot actually be sold on collapses to `once`. */
export function effectiveTerm(
  offering: Offering | null,
  term: SubscriptionTerm,
): SubscriptionTerm {
  if (!offering || !offering.subscribable) return 'once';
  return term;
}

/** The terms an offering can actually be sold on, in display order. */
export function termsFor(offering: Offering | null): TermDefinition[] {
  if (!offering || !offering.subscribable) return [TERMS.once];
  return TERM_ORDER.map((id) => TERMS[id]);
}

function recurringUnit(listUnit: string): string {
  return listUnit === 'per athlete' ? 'per athlete / month' : 'per month';
}

export function headlineFor(
  offering: Offering,
  term: SubscriptionTerm = DEFAULT_TERM,
): Headline {
  const resolved = effectiveTerm(offering, term);
  const list = listHeadline(offering);
  const pricing = termPricing(list.amount, resolved, {
    alwaysRecurring: offering.baseCadence === 'monthly',
  });
  const discounted = pricing.rate !== pricing.listRate;

  return {
    term: resolved,
    subscribable: offering.subscribable,
    amount: pricing.rate,
    price: formatMoney(pricing.rate),
    unit: pricing.renews ? recurringUnit(list.unit) : list.unit,
    suffix: pricing.renews ? '/mo' : '',
    rateLabel: pricing.rateLabel,
    listAmount: discounted ? pricing.listRate : null,
    listPrice: discounted ? formatMoney(pricing.listRate) : null,
    listUnit: list.unit,
    termNote: discounted
      ? `${pricing.discountLabel} on the ${pricing.months}-month plan`
      : null,
    frequencyNote:
      pricing.renews && offering.baseCadence === 'once'
        ? 'One session a month'
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* Per-option pricing                                                  */
/* ------------------------------------------------------------------ */
/**
 * One helper per booking mode, each returning every figure that mode's picker
 * and its receipt need. `quoteFor()` builds its lines from exactly these, so a
 * picker that reads them cannot disagree with the total the buyer is shown.
 *
 * Pickers: call these. Never multiply a rate, apply a discount, or divide out
 * a per-session figure in a component.
 */

export interface SessionPricing extends TermPricing {
  athletes: number;
  /** One family's share of `rate` when two athletes split the mat. */
  perAthlete: number;
  /** One family's share of the undiscounted rate. */
  listPerAthlete: number;
  minutes: number;
}

/** Private, Partner and Dedicated Workout, under a term. */
export function sessionPricing(
  offering: SingleDateOffering,
  term: SubscriptionTerm = DEFAULT_TERM,
): SessionPricing {
  const pricing = termPricing(offering.price, effectiveTerm(offering, term), {
    alwaysRecurring: offering.baseCadence === 'monthly',
  });
  return {
    ...pricing,
    athletes: offering.athletes,
    perAthlete: roundMoney(pricing.rate / offering.athletes),
    listPerAthlete: roundMoney(pricing.listRate / offering.athletes),
    minutes: offering.minutes,
  };
}

export interface TierPricing extends TermPricing {
  tier: PackageTier;
  /** Sessions the pattern generates in the chosen month; 0 when unknown. */
  sessionsPerMonth: number;
  /**
   * `rate ÷ sessionsPerMonth`, to the nearest whole dollar. APPROXIMATE and
   * labelled as such — it is never charged and never summed.
   */
  perSession: number | null;
}

/** A monthly package tier, under a term. */
export function tierPricing(
  tier: PackageTier,
  term: SubscriptionTerm = DEFAULT_TERM,
  sessionsPerMonth = 0,
): TierPricing {
  // A package is monthly by nature: at `once` it is month-to-month, full
  // price, and it still auto-renews.
  const pricing = termPricing(tier.monthly, term, {alwaysRecurring: true});
  return {
    ...pricing,
    tier,
    sessionsPerMonth,
    perSession:
      sessionsPerMonth > 0 ? Math.round(pricing.rate / sessionsPerMonth) : null,
  };
}

/**
 * Resolves the whole package selection: which tier the chosen days unlock,
 * the dates that pattern generates, and the priced tier.
 */
export interface PackagePricing {
  tier: PackageTier | null;
  dates: string[];
  pricing: TierPricing | null;
  days: number;
}

export function packagePricing(
  offering: WeeklyPatternOffering,
  weekdays: number[],
  startMonth: string,
  term: SubscriptionTerm = DEFAULT_TERM,
): PackagePricing {
  const tier = tierForDays(offering, weekdays.length);
  const dates = datesForWeekdaysInMonth(startMonth, weekdays);
  return {
    tier,
    dates,
    days: weekdays.length,
    pricing: tier
      ? tierPricing(tier, effectiveTerm(offering, term), dates.length)
      : null,
  };
}

export interface ClinicPricing {
  count: number;
  bundles: number;
  singles: number;
  pricePerSession: number;
  bundleSize: number;
  bundlePrice: number;
  /** What the same dates would cost one at a time. */
  listPrice: number;
  total: number;
  /**
   * `listPrice − total`. The bundle only discounts COMPLETE bundles, so four
   * dates save exactly what three do — pro-rating the saving across the
   * leftover date overstates it.
   */
  savings: number;
  /** Dates still needed to complete the next bundle; 0 when none is pending. */
  toNextBundle: number;
  /** At least one full bundle has been earned. */
  bundleComplete: boolean;
}

/** Small-Group Clinic. No term — see `subscribable` on the offering. */
export function clinicPricing(
  offering: SessionListOffering,
  count: number,
): ClinicPricing {
  const bundles = Math.floor(count / offering.bundleSize);
  const singles = count % offering.bundleSize;
  const total = roundMoney(
    bundles * offering.bundlePrice + singles * offering.pricePerSession,
  );
  const listPrice = roundMoney(count * offering.pricePerSession);

  return {
    count,
    bundles,
    singles,
    pricePerSession: offering.pricePerSession,
    bundleSize: offering.bundleSize,
    bundlePrice: offering.bundlePrice,
    listPrice,
    total,
    savings: roundMoney(listPrice - total),
    toNextBundle: singles === 0 ? 0 : offering.bundleSize - singles,
    bundleComplete: bundles > 0,
  };
}

export interface CampPricing {
  days: number;
  dayRate: number;
  total: number;
  depositShare: number;
  /** `25%` */
  depositLabel: string;
  deposit: number;
  /** `total − deposit`. */
  balance: number;
  balanceDueDaysBefore: number;
  /** Null until day one is picked. */
  balanceDueIso: string | null;
  balanceDueLabel: string | null;
}

/** Camp booking. No term — camp is excluded from the subscription matrix. */
export function campPricing(
  offering: CampOffering,
  days: number,
  startIso: string | null = null,
): CampPricing {
  const clamped = clampCampDays(offering, days);
  const total = roundMoney(offering.dayRate * clamped);
  const deposit = Math.round(total * offering.depositShare);
  const balanceDueIso = startIso
    ? addDaysIso(startIso, -offering.balanceDueDaysBefore)
    : null;

  return {
    days: clamped,
    dayRate: offering.dayRate,
    total,
    depositShare: offering.depositShare,
    depositLabel: campDepositLabel(offering),
    deposit,
    balance: roundMoney(total - deposit),
    balanceDueDaysBefore: offering.balanceDueDaysBefore,
    balanceDueIso,
    balanceDueLabel: balanceDueIso ? formatMediumDate(balanceDueIso) : null,
  };
}

export function getOffering(id: OfferingId | null): Offering | null {
  if (!id) return null;
  return OFFERINGS.find((o) => o.id === id) ?? null;
}

/** `[1, 2, 3, 4, 5]` — the day counts a host can book. */
export function campDayOptions(offering: CampOffering): number[] {
  const out: number[] = [];
  for (let d = offering.minDays; d <= offering.maxDays; d++) out.push(d);
  return out;
}

/** Clamps a day count into the bookable range. */
export function clampCampDays(offering: CampOffering, days: number): number {
  return Math.min(offering.maxDays, Math.max(offering.minDays, days));
}

/** The last day of a block that starts on `startIso` and runs `days` days. */
export function campEndIso(startIso: string, days: number): string {
  return addDaysIso(startIso, Math.max(1, days) - 1);
}

/** `Aug 14 – 16, 2026`, or a single date when the booking is one day. */
export function campDatesLabel(startIso: string, days: number): string {
  const endIso = campEndIso(startIso, days);
  return startIso === endIso
    ? formatLongDate(startIso)
    : formatDateRange(startIso, endIso);
}

/**
 * Day rate × consecutive days. Nothing per-athlete enters this number.
 * Thin wrapper over `campPricing()` — prefer that when you need more than one
 * of the figures, so the total, deposit and balance are read from one object.
 */
export function campTotal(offering: CampOffering, days: number): number {
  return campPricing(offering, days).total;
}

/** The deposit as a share of the booking, rounded to whole dollars. */
export function campDeposit(offering: CampOffering, days: number): number {
  return campPricing(offering, days).deposit;
}

/** The balance left after the deposit. Never recompute this in a component. */
export function campBalance(offering: CampOffering, days: number): number {
  return campPricing(offering, days).balance;
}

/** `25%` — the deposit share, for copy. */
export function campDepositLabel(offering: CampOffering): string {
  return `${Math.round(offering.depositShare * 100)}%`;
}

/** First and last bookable dates of the season, inclusive. */
export function seasonBounds(): {firstIso: string; lastIso: string} {
  const months = seasonMonths();
  const first = splitMonthKey(months[0]);
  const last = splitMonthKey(months[months.length - 1]);
  return {
    firstIso: isoFrom(first.year, first.month, 1),
    lastIso: isoFrom(last.year, last.month, daysInMonth(last.year, last.month)),
  };
}

/** A block can start here only if the whole run fits inside the season. */
export function canStartCampOn(
  iso: string,
  days: number,
  todayIso: string | null,
): boolean {
  const {firstIso, lastIso} = seasonBounds();
  if (iso < firstIso || iso > lastIso) return false;
  if (todayIso !== null && iso < todayIso) return false;
  return campEndIso(iso, days) <= lastIso;
}

export function tierForDays(
  offering: WeeklyPatternOffering,
  days: number,
): PackageTier | null {
  return (
    offering.tiers.find((t) => days >= t.minDays && days <= t.maxDays) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Generated availability                                              */
/* ------------------------------------------------------------------ */

/** FNV-1a. Stable across server and browser — no Math.random anywhere. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SlotState extends TimeSlot {
  taken: boolean;
}

export type DayState = 'open' | 'limited' | 'full' | 'closed';

export interface DayAvailability {
  state: DayState;
  open: number;
  total: number;
}

export function slotsFor(
  offering: SingleDateOffering,
  iso: string,
): SlotState[] {
  const slots = offering.availability[weekdayOf(iso)];
  if (!slots) return [];
  return slots.map((slot) => ({
    ...slot,
    taken: hash(`${offering.id}:${iso}:${slot.id}`) % 100 < offering.bookedRate,
  }));
}

export function dayAvailability(
  offering: SingleDateOffering,
  iso: string,
): DayAvailability {
  const slots = slotsFor(offering, iso);
  if (slots.length === 0) return {state: 'closed', open: 0, total: 0};
  const open = slots.filter((s) => !s.taken).length;
  if (open === 0) return {state: 'full', open, total: slots.length};
  if (open === 1) return {state: 'limited', open, total: slots.length};
  return {state: 'open', open, total: slots.length};
}

/** Human sentence used as the accessible name of a calendar cell. */
export function dayAccessibleName(iso: string, info: DayAvailability): string {
  const date = formatLongDate(iso);
  switch (info.state) {
    case 'open':
      return `${date} — ${info.open} times available`;
    case 'limited':
      return `${date} — 1 time left`;
    case 'full':
      return `${date} — fully booked`;
    default:
      return `${date} — no sessions offered`;
  }
}

/** Scarcity is only shown when it is genuinely scarce. */
export function isScarce(remaining: number, capacity: number): boolean {
  return remaining > 0 && (remaining <= 3 || remaining / capacity <= 0.3);
}

/* ------------------------------------------------------------------ */
/* Selection + pricing                                                 */
/* ------------------------------------------------------------------ */

export interface BookingSelection {
  offeringId: OfferingId | null;
  /** single-date */
  dateIso: string | null;
  slotId: string | null;
  /** session-list */
  sessionIds: string[];
  /** weekly-pattern */
  weekdays: number[];
  bandId: TimeBandId | null;
  startMonth: string;
  /** camp-block — day one of the block, and how many consecutive days. */
  campStartIso: string | null;
  campDays: number;
  /**
   * The commitment. Preselected to `m12` — the client's default — on every
   * offering; `effectiveTerm()` collapses it to `once` on anything that is
   * not `subscribable`, so carrying `m12` here is always safe.
   */
  term: SubscriptionTerm;
}

export const EMPTY_SELECTION: BookingSelection = {
  offeringId: null,
  dateIso: null,
  slotId: null,
  sessionIds: [],
  weekdays: [],
  bandId: null,
  startMonth: SEASON_START_MONTH,
  campStartIso: null,
  campDays: 2,
  term: DEFAULT_TERM,
};

export interface PriceLine {
  label: string;
  detail?: string;
  amount: number;
  /** Notes are shown in the receipt but never summed. */
  kind: 'charge' | 'credit' | 'note';
}

export interface ScheduleLine {
  label: string;
  value: string;
}

/**
 * The priced plan behind a renewing quote. Null when nothing recurs — a
 * one-off session, a clinic, a camp booking.
 */
export interface QuotePlan extends TermPricing {
  /** The disclosures this plan must carry. Same object as `Quote.renewal`. */
  renewal: RenewalTerms;
}

export interface Quote {
  cadence: Cadence;
  /** The term actually applied, after `effectiveTerm()`. */
  term: SubscriptionTerm;
  /** Whether a term could be chosen at all. */
  subscribable: boolean;
  /** Null unless this quote recurs. */
  plan: QuotePlan | null;
  /**
   * The auto-renewal disclosures, or null. When this is non-null the details
   * step MUST render `renewal.consentLabel` as its own, initially-unchecked
   * control and pass `requireRenewalConsent` to `validateDetails`.
   */
  renewal: RenewalTerms | null;
  /** True whenever consent to an auto-renewal is legally required here. */
  requiresRenewalConsent: boolean;
  lines: PriceLine[];
  schedule: ScheduleLine[];
  total: number;
  totalLabel: string;
  dueNow: number;
  dueLabel: string;
  balance: number | null;
  balanceLabel: string | null;
  /**
   * The date the balance falls due, already formatted. Kept separate from
   * `balanceLabel` so the summary can set the figure and the date as two
   * columns of a ledger rather than one sentence.
   */
  balanceDueDate: string | null;
  /** Extra plain-language line under the totals. */
  terms: string;
  /** Enough is selected to move to the request step. */
  complete: boolean;
  /** What the athlete still has to do. */
  nextHint: string;
  /** The headline saving — a bundle discount, or a term discount. */
  savings?: number;
  /** That saving, in words, with the period it applies to. */
  savingsLabel: string | null;
}

/* ------------------------------------------------------------------ */
/* Cadence wording                                                     */
/* ------------------------------------------------------------------ */

/**
 * The ONE place `/mo` and its long forms are produced. Components branching on
 * `cadence === 'monthly'` to bolt on a suffix should read this instead.
 */
export interface RateCopy {
  cadence: Cadence;
  isMonthly: boolean;
  isDeposit: boolean;
  /** `/mo` or ''. */
  suffix: string;
  /** `per month`, `per session`, `per booking`. */
  unit: string;
  /** `Billed monthly until cancelled.` — one sentence under the total. */
  billingLine: string;
  /** `$160/mo` — amount and suffix, already joined. */
  format: (amount: number) => string;
}

export function rateCopy(source: Quote | Cadence, plan?: QuotePlan | null): RateCopy {
  const cadence = typeof source === 'string' ? source : source.cadence;
  const resolved =
    plan ?? (typeof source === 'string' ? null : source.plan) ?? null;
  const isMonthly = cadence === 'monthly';
  const suffix = isMonthly ? '/mo' : '';

  const billingLine = isMonthly
    ? resolved && resolved.minCycles !== null
      ? `Billed monthly until cancelled — ${resolved.months}-month minimum.`
      : 'Billed monthly until cancelled.'
    : cadence === 'deposit'
      ? 'Deposit now, balance before day one.'
      : 'A single charge. Nothing recurring.';

  return {
    cadence,
    isMonthly,
    isDeposit: cadence === 'deposit',
    suffix,
    unit: isMonthly ? 'per month' : cadence === 'deposit' ? 'per booking' : 'per session',
    billingLine,
    format: (amount: number) => `${formatMoney(amount)}${suffix}`,
  };
}

/** Wraps a `TermPricing` as a plan, or null when nothing recurs. */
function planFrom(pricing: TermPricing): QuotePlan | null {
  if (!pricing.renews) return null;
  return {...pricing, renewal: renewalTerms(pricing)};
}

const EMPTY_QUOTE: Quote = {
  cadence: 'once',
  term: 'once',
  subscribable: false,
  plan: null,
  renewal: null,
  requiresRenewalConsent: false,
  lines: [],
  schedule: [],
  total: 0,
  totalLabel: 'Total',
  dueNow: 0,
  dueLabel: 'Total',
  balance: null,
  balanceLabel: null,
  balanceDueDate: null,
  terms: '',
  complete: false,
  nextHint: 'Choose a session type to begin.',
  savingsLabel: null,
};

/** The saving sentence, so no component has to word it twice. */
function termSavingsLabel(plan: QuotePlan | null): string | null {
  if (!plan || plan.savings <= 0) return null;
  return `You save ${formatMoney(plan.savings)} over ${plan.months} months`;
}

/** The renewal disclosures, appended to a quote's plain-language terms. */
function planTermsSentence(plan: QuotePlan | null): string {
  if (!plan) return '';
  const {renewal} = plan;
  return ` ${renewal.headline} ${renewal.amountLine} ${renewal.commitmentLine} ${renewal.cancelLine}`;
}

/** The two anchoring note lines every discounted plan shows in the receipt. */
function planNoteLines(plan: QuotePlan | null, listLabel: string): PriceLine[] {
  if (!plan) return [];
  const lines: PriceLine[] = [];
  if (plan.savings > 0) {
    lines.push({
      label: 'Without a plan',
      detail: listLabel,
      amount: plan.listRate,
      kind: 'note',
    });
  }
  if (plan.minCycles !== null) {
    lines.push({
      label: `${plan.months}-month minimum`,
      detail: `${plan.cycles} charges of ${formatMoney(plan.rate)}`,
      amount: plan.commitmentTotal,
      kind: 'note',
    });
  }
  return lines;
}

export function quoteFor(selection: BookingSelection): Quote {
  const offering = getOffering(selection.offeringId);
  if (!offering) return EMPTY_QUOTE;

  switch (offering.mode) {
    case 'single-date':
      return quoteSingleDate(offering, selection);
    case 'session-list':
      return quoteSessions(offering, selection);
    case 'weekly-pattern':
      return quotePackage(offering, selection);
    case 'camp-block':
      return quoteCamp(offering, selection);
  }
}

function quoteSingleDate(
  offering: SingleDateOffering,
  selection: BookingSelection,
): Quote {
  const {dateIso, slotId} = selection;
  const slot = dateIso
    ? slotsFor(offering, dateIso).find((s) => s.id === slotId) ?? null
    : null;

  const pricing = sessionPricing(offering, selection.term);
  const plan = planFrom(pricing);
  const who =
    offering.athletes > 1
      ? `${offering.athletes} athletes, one mat`
      : 'One athlete, one coach';

  const lines: PriceLine[] = [
    {
      label: `${offering.name} · ${offering.minutes} min`,
      detail: plan ? `${who} · one session a month` : who,
      amount: pricing.rate,
      kind: 'charge',
    },
  ];

  if (offering.athletes > 1) {
    lines.push({
      label: 'Per athlete',
      detail: 'Split between two families',
      amount: pricing.perAthlete,
      kind: 'note',
    });
  }

  lines.push(
    ...planNoteLines(
      plan,
      `One-off rate, ${formatMoney(pricing.listRate)} a session`,
    ),
  );

  const schedule: ScheduleLine[] = [];
  if (plan) {
    schedule.push({
      label: 'Plan',
      value: `${plan.label} · one session a month`,
    });
  }
  if (dateIso) {
    schedule.push({
      label: plan ? 'First session' : 'Date',
      value: formatLongDate(dateIso),
    });
  }
  if (slot) {
    schedule.push({
      label: 'Time',
      value: `${slot.label} · ${offering.minutes} minutes`,
    });
  }
  schedule.push({label: 'Location', value: 'Riverside, CA'});

  if (plan && dateIso) {
    const renewal = renewalScheduleFor(dateIso, plan.term);
    if (renewal) {
      schedule.push({label: 'Renews', value: renewal.renewsOnLabel});
    }
  }

  const complete = Boolean(dateIso && slot);
  const baseTerms = plan
    ? 'Free to reschedule up to 24 hours before any session.'
    : 'Paid in full when Jesse confirms. Free to reschedule up to 24 hours before the session.';

  return {
    cadence: plan ? 'monthly' : 'once',
    term: pricing.term,
    subscribable: offering.subscribable,
    plan,
    renewal: plan?.renewal ?? null,
    requiresRenewalConsent: Boolean(plan),
    lines,
    schedule,
    total: pricing.rate,
    totalLabel: plan ? 'Per month' : 'Session total',
    dueNow: pricing.rate,
    dueLabel: plan ? 'Due today · first month' : 'Due at booking',
    balance: null,
    balanceLabel: plan
      ? `${formatMoney(plan.rate)} every month until you cancel`
      : null,
    balanceDueDate: null,
    terms: `${baseTerms}${planTermsSentence(plan)}`,
    complete,
    nextHint: !dateIso
      ? 'Pick a date on the calendar.'
      : !slot
        ? 'Choose an open time.'
        : 'Ready — continue to your details.',
    savings: plan && plan.savings > 0 ? plan.savings : undefined,
    savingsLabel: termSavingsLabel(plan),
  };
}

function quoteSessions(
  offering: SessionListOffering,
  selection: BookingSelection,
): Quote {
  const picked = offering.sessions.filter((s) =>
    selection.sessionIds.includes(s.id),
  );
  const pricing = clinicPricing(offering, picked.length);
  const {count, bundles, singles} = pricing;

  const lines: PriceLine[] = [];
  if (bundles > 0) {
    lines.push({
      label: `${offering.bundleSize}-session bundle${bundles > 1 ? ` ×${bundles}` : ''}`,
      detail: 'Bundle rate applied automatically',
      amount: roundMoney(bundles * offering.bundlePrice),
      kind: 'charge',
    });
  }
  if (singles > 0) {
    lines.push({
      label: `Single clinic${singles > 1 ? ` ×${singles}` : ''}`,
      detail: `${formatMoney(offering.pricePerSession)} per athlete, per day`,
      amount: roundMoney(singles * offering.pricePerSession),
      kind: 'charge',
    });
  }

  const schedule: ScheduleLine[] = picked.map((s) => ({
    label: formatMediumDate(s.dateIso),
    value: `${s.title} · ${s.window}`,
  }));

  return {
    cadence: 'once',
    term: 'once',
    subscribable: offering.subscribable,
    plan: null,
    renewal: null,
    requiresRenewalConsent: false,
    lines,
    schedule,
    total: pricing.total,
    totalLabel: 'Clinic total',
    dueNow: pricing.total,
    dueLabel: 'Due at booking',
    balance: null,
    balanceLabel: null,
    balanceDueDate: null,
    terms:
      'Per athlete. Booking a full team or club? Note the headcount and Jesse will quote the room.',
    complete: count > 0,
    nextHint:
      count === 0
        ? 'Select at least one clinic date.'
        : count < offering.bundleSize
          ? `Add ${offering.bundleSize - count} more to unlock the bundle rate.`
          : 'Bundle rate applied — continue to your details.',
    savings: pricing.savings > 0 ? pricing.savings : undefined,
    savingsLabel:
      pricing.savings > 0
        ? `You save ${formatMoney(pricing.savings)} on the bundle rate`
        : null,
  };
}

function quotePackage(
  offering: WeeklyPatternOffering,
  selection: BookingSelection,
): Quote {
  const {tier, dates, pricing} = packagePricing(
    offering,
    selection.weekdays,
    selection.startMonth,
    selection.term,
  );
  const days = selection.weekdays.length;
  const band = offering.bands.find((b) => b.id === selection.bandId) ?? null;
  const plan = pricing ? planFrom(pricing) : null;
  const monthly = pricing?.rate ?? 0;

  const lines: PriceLine[] =
    tier && pricing
      ? [
          {
            label: `${tier.name} package`,
            detail: `${days} days per week · ${offering.location}`,
            amount: pricing.rate,
            kind: 'charge',
          },
          {
            label: 'Per session',
            detail: `≈ ${dates.length} sessions in ${monthLabel(selection.startMonth)}`,
            amount: pricing.perSession ?? pricing.rate,
            kind: 'note',
          },
          ...planNoteLines(plan, `Month-to-month rate, ${formatMoney(pricing.listRate)} a month`),
        ]
      : [];

  const schedule: ScheduleLine[] = [];
  if (plan) {
    schedule.push({label: 'Plan', value: plan.label});
  }
  if (days > 0) {
    schedule.push({
      label: 'Training days',
      value: selection.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DAY_ABBR[d])
        .join(' · '),
    });
  }
  if (band) {
    schedule.push({label: 'Time band', value: `${band.label} · ${band.window}`});
  }
  schedule.push({
    label: 'Starts',
    value: monthLabel(selection.startMonth),
  });
  if (dates.length) {
    schedule.push({
      label: 'First month',
      value: `${dates.length} sessions, first on ${formatMediumDate(dates[0])}`,
    });
  }

  if (plan && dates.length) {
    const renewal = renewalScheduleFor(dates[0], plan.term);
    if (renewal) {
      schedule.push({label: 'Renews', value: renewal.renewsOnLabel});
    }
  }

  const complete = Boolean(tier && band);

  return {
    // A package bills monthly whatever term is chosen — at `once` it is
    // month-to-month with no minimum, and it still renews on its own.
    cadence: 'monthly',
    term: pricing?.term ?? effectiveTerm(offering, selection.term),
    subscribable: offering.subscribable,
    plan,
    renewal: plan?.renewal ?? null,
    requiresRenewalConsent: Boolean(plan),
    lines,
    schedule,
    total: monthly,
    totalLabel: 'Per month',
    dueNow: monthly,
    dueLabel: 'First month',
    balance: null,
    balanceLabel: dates.length
      ? `Billed monthly, first charge ${formatMediumDate(dates[0])}`
      : null,
    balanceDueDate: dates.length ? formatMediumDate(dates[0]) : null,
    terms: `Billed monthly on the day of your first session. Change your training days with 30 days notice.${planTermsSentence(plan)}`,
    complete,
    savings: plan && plan.savings > 0 ? plan.savings : undefined,
    savingsLabel: termSavingsLabel(plan),
    nextHint:
      days === 0
        ? `Choose at least ${offering.minDays} training days.`
        : days < offering.minDays
          ? `Packages start at ${offering.minDays} days per week.`
          : !band
            ? 'Choose a preferred time band.'
            : 'Ready — continue to your details.',
  };
}

function quoteCamp(
  offering: CampOffering,
  selection: BookingSelection,
): Quote {
  const startIso = selection.campStartIso;
  const pricing = campPricing(offering, selection.campDays, startIso);
  const {days, total, deposit, balance} = pricing;
  const share = pricing.depositLabel;

  const terms = `${formatMoney(offering.dayRate)} for every consecutive day Jesse is on site. The ${share} deposit holds the dates and comes off the total; the balance is due ${offering.balanceDueDaysBefore} days before day one. Inside 24 hours, a cancelled day is charged in full.`;

  const lines: PriceLine[] = [
    {
      label: `Jesse on site · ${days} consecutive day${days === 1 ? '' : 's'}`,
      detail: `${formatMoney(offering.dayRate)} per day × ${days}`,
      amount: total,
      kind: 'charge',
    },
    {
      label: `Booking deposit · ${share}`,
      detail: 'Holds the dates, applied to the total',
      amount: deposit,
      kind: 'note',
    },
  ];

  // Camp is excluded from the subscription matrix — no term, no plan, no
  // renewal consent. `campPricing()` never sees `selection.term`.
  const campFlags = {
    term: 'once' as const,
    subscribable: false,
    plan: null,
    renewal: null,
    requiresRenewalConsent: false,
    savingsLabel: null,
  };

  if (!startIso) {
    return {
      cadence: 'deposit',
      ...campFlags,
      lines,
      schedule: [
        {
          label: 'Length',
          value: `${days} consecutive day${days === 1 ? '' : 's'}`,
        },
        {label: 'Day rate', value: `${formatMoney(offering.dayRate)} per day`},
      ],
      total,
      totalLabel: 'Booking total',
      dueNow: deposit,
      dueLabel: 'Deposit to hold the dates',
      balance,
      balanceLabel: null,
      balanceDueDate: null,
      terms,
      complete: false,
      nextHint: 'Pick day one on the calendar.',
    };
  }

  return {
    cadence: 'deposit',
    ...campFlags,
    lines,
    schedule: [
      {label: 'Day one', value: formatLongDate(startIso)},
      {label: 'Dates', value: campDatesLabel(startIso, days)},
      {
        label: 'Length',
        value: `${days} consecutive day${days === 1 ? '' : 's'}`,
      },
      {label: 'Day rate', value: `${formatMoney(offering.dayRate)} per day`},
      {label: 'Venue', value: 'Your room — supplied by the host'},
    ],
    total,
    totalLabel: 'Booking total',
    dueNow: deposit,
    dueLabel: 'Deposit to hold the dates',
    balance,
    balanceLabel: `Balance ${formatMoney(balance)} due ${pricing.balanceDueLabel}`,
    balanceDueDate: pricing.balanceDueLabel,
    terms,
    complete: true,
    nextHint: 'Dates held — continue to your details.',
  };
}

/* ------------------------------------------------------------------ */
/* Request payload                                                     */
/* ------------------------------------------------------------------ */

/**
 * One payload, two buyers. Private sessions, clinics and packages are bought
 * by a parent, so they fill the athlete fields. A camp is bought by a host —
 * a club, a school, an event organiser — so they fill the host fields
 * instead. `RequestForm` renders one set or the other; `validateDetails`
 * checks whichever set is on screen.
 */
export interface RequestDetails {
  /* parent-facing */
  athleteName: string;
  age: string;
  grade: string;
  /* host-facing (camp bookings) */
  contactName: string;
  organisation: string;
  venue: string;
  athleteCount: string;
  ageRange: string;
  skillRange: string;
  dateFlexibility: string;
  /* shared */
  email: string;
  phone: string;
  notes: string;
  acceptsDepositTerms: boolean;
  /**
   * Consent to the AUTO-RENEWAL specifically — its own control, its own
   * affirmative action, and initially FALSE. It is not the general terms box
   * and it is not `acceptsDepositTerms`. Label it with
   * `quote.renewal.consentLabel`, and never render it pre-checked.
   */
  acceptsAutoRenewal: boolean;
}

/** Retained for callers written against the parent-only shape. */
export type AthleteDetails = RequestDetails;

export const EMPTY_DETAILS: RequestDetails = {
  athleteName: '',
  age: '',
  grade: '',
  contactName: '',
  organisation: '',
  venue: '',
  athleteCount: '',
  ageRange: '',
  skillRange: '',
  dateFlexibility: '',
  email: '',
  phone: '',
  notes: '',
  acceptsDepositTerms: false,
  // Never seed this true. Preselecting the plan is lawful; pre-checking the
  // consent is not.
  acceptsAutoRenewal: false,
};

export const GRADE_OPTIONS = [
  'K – 2nd',
  '3rd – 5th',
  'Middle school',
  '9th grade',
  '10th grade',
  '11th grade',
  '12th grade',
  'College',
  'Open / post-grad',
];

/** Age bands a host can expect in the room. */
export const AGE_RANGE_OPTIONS = [
  'Elementary (K – 5th)',
  'Middle school',
  'High school',
  'Middle & high school',
  'High school & college',
  'Mixed — all ages',
];

/** How experienced the room is, so Jesse can pitch the day correctly. */
export const SKILL_RANGE_OPTIONS = [
  'Beginners — first or second season',
  'Developing — some competition experience',
  'Varsity level',
  'State-qualifier level and up',
  'Mixed — beginners through varsity',
];

/** How much the host's dates can move. */
export const DATE_FLEXIBILITY_OPTIONS = [
  'These dates only',
  'Within the same week',
  'Within the same month',
  'Flexible — work it out with Jesse',
];

export type DetailErrors = Partial<Record<keyof RequestDetails, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export interface ValidateOptions {
  requireDepositTerms: boolean;
  /** Camp bookings validate the host fields instead of the athlete fields. */
  host: boolean;
  /**
   * Pass `quote.requiresRenewalConsent`. Optional so existing callers still
   * type-check, but a renewing quote that submits without it is a compliance
   * failure — wire it.
   */
  requireRenewalConsent?: boolean;
}

export function validateDetails(
  details: RequestDetails,
  options: ValidateOptions,
): DetailErrors {
  const {requireDepositTerms, host} = options;
  const errors: DetailErrors = {};

  if (host) {
    if (details.contactName.trim().length < 2) {
      errors.contactName = 'Enter the name of the person booking.';
    }
    if (details.organisation.trim().length < 2) {
      errors.organisation = 'Name the club, school or organisation.';
    }
    if (details.venue.trim().length < 2) {
      errors.venue = 'Where is the camp being held? City is enough for now.';
    }

    const count = Number(details.athleteCount);
    if (!details.athleteCount.trim()) {
      errors.athleteCount = 'Roughly how many athletes will be there?';
    } else if (!Number.isFinite(count) || count < 1 || count > 500) {
      errors.athleteCount = 'Enter an expected headcount between 1 and 500.';
    }

    if (!details.ageRange) errors.ageRange = 'Choose the age range in the room.';
    if (!details.skillRange) {
      errors.skillRange = 'Choose the skill range in the room.';
    }
    if (!details.dateFlexibility) {
      errors.dateFlexibility = 'Tell Jesse how firm the dates are.';
    }
  } else {
    if (details.athleteName.trim().length < 2) {
      errors.athleteName = 'Enter the athlete’s full name.';
    }

    const age = Number(details.age);
    if (!details.age.trim()) {
      errors.age = 'Age is required.';
    } else if (!Number.isFinite(age) || age < 4 || age > 30) {
      errors.age = 'Enter an age between 4 and 30.';
    }

    if (!details.grade) errors.grade = 'Choose a grade level.';
  }

  if (!details.email.trim()) {
    errors.email = 'An email is required to confirm.';
  } else if (!EMAIL_RE.test(details.email.trim())) {
    errors.email = 'That email doesn’t look right.';
  }

  const digits = details.phone.replace(/\D/g, '');
  if (!details.phone.trim()) {
    errors.phone = 'A phone number is required.';
  } else if (digits.length < 10 || digits.length > 11) {
    errors.phone = 'Enter a 10-digit phone number.';
  }

  if (details.notes.length > 600) {
    errors.notes = 'Keep notes under 600 characters.';
  }

  if (requireDepositTerms && !details.acceptsDepositTerms) {
    errors.acceptsDepositTerms = 'Please acknowledge the deposit terms.';
  }

  if (options.requireRenewalConsent && !details.acceptsAutoRenewal) {
    errors.acceptsAutoRenewal =
      'Please agree to the automatic renewal before continuing.';
  }

  return errors;
}

/** Short human reference for the confirmation screen. */
export function referenceCode(
  selection: BookingSelection,
  details: RequestDetails,
): string {
  const seed = `${selection.offeringId}|${selection.term}|${selection.dateIso}|${selection.slotId}|${selection.campStartIso}:${selection.campDays}|${selection.sessionIds.join(',')}|${selection.weekdays.join('')}|${details.email}`;
  return `JV-${hash(seed).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
