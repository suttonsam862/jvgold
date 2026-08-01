/**
 * Training offerings, availability rules and the pricing engine behind
 * /train. Everything a human might want to edit — prices, camp dates,
 * clinic capacity, which weeknights are open — lives in this file.
 *
 * All rates are provisional for the 2026 founding season.
 *
 * Availability is generated deterministically from a hash of the date, so the
 * server render and the client hydration always agree. When real availability
 * lands, replace `slotsFor()` / `campById()` with loader data — the components
 * only ever talk to the helpers exported here.
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

interface OfferingBase {
  id: OfferingId;
  /** Bracketed micro-label on the card. */
  index: string;
  name: string;
  /** One line: who this is for. */
  bestFor: string;
  blurb: string;
  /** Headline price as displayed on the selector card. */
  priceFrom: string;
  priceUnit: string;
  duration: string;
  includes: string[];
  photoId: string;
  /** Copy for the schedule step heading. */
  scheduleHeading: string;
  scheduleHint: string;
  featured?: boolean;
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

export interface Camp {
  id: string;
  name: string;
  startIso: string;
  endIso: string;
  nights: number;
  price: number;
  deposit: number;
  capacity: number;
  spotsRemaining: number;
  location: string;
  summary: string;
  includes: string[];
}

export interface CampOffering extends OfferingBase {
  mode: 'camp-block';
  camps: Camp[];
  /** Balance falls due this many days before the first day of camp. */
  balanceDueDaysBefore: number;
}

export type Offering =
  | SingleDateOffering
  | SessionListOffering
  | WeeklyPatternOffering
  | CampOffering;

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

export const OFFERINGS: Offering[] = [
  {
    id: 'private',
    index: '01',
    mode: 'single-date',
    name: 'Private 1-on-1',
    bestFor: 'One athlete, undivided attention.',
    blurb:
      'The full standard: individual technique work, live situations, and a development plan built around your athlete. Every session ends with clear homework.',
    priceFrom: '$200',
    priceUnit: 'per hour',
    duration: '60 minutes',
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
    priceFrom: '$100',
    priceUnit: 'per athlete',
    duration: '60 minutes',
    price: 200,
    athletes: 2,
    minutes: 60,
    splitNote: '$200 total, split between two families',
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
    priceFrom: '$150',
    priceUnit: 'per session',
    duration: '90 minutes',
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
    priceFrom: '$100',
    priceUnit: 'per athlete / day',
    duration: '2 hours',
    pricePerSession: 100,
    bundleSize: 3,
    bundlePrice: 200,
    includes: [
      'Up to 20 athletes per clinic',
      '3-session bundle at $200 — provisional',
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
    priceFrom: '$1,400',
    priceUnit: 'per month',
    duration: 'Recurring weekly',
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
    name: 'Overnight Camp',
    bestFor: 'The full immersion — mat, meals, and mindset.',
    blurb:
      'Multi-day residential camps: three sessions a day, film in the evening, and a room full of athletes who all decided to be there. Reserve with a deposit.',
    priceFrom: '$895',
    priceUnit: 'from, per athlete',
    duration: '3–5 days',
    balanceDueDaysBefore: 21,
    camps: [
      {
        id: 'camp-summer',
        name: 'Summer Intensive',
        startIso: '2026-08-14',
        endIso: '2026-08-16',
        nights: 2,
        price: 895,
        deposit: 200,
        capacity: 24,
        spotsRemaining: 7,
        location: 'Riverside, CA',
        summary:
          'Three days of technique, live wrestling and film before the season starts.',
        includes: [
          'Three training sessions daily',
          'Lodging & all meals',
          'Evening film with Jesse',
          'Camp gear package',
        ],
      },
      {
        id: 'camp-elite',
        name: 'Elite Overnight Camp',
        startIso: '2026-10-09',
        endIso: '2026-10-13',
        nights: 4,
        price: 1450,
        deposit: 300,
        capacity: 16,
        spotsRemaining: 11,
        location: 'Riverside, CA',
        summary:
          'Invitation-level room, capped at 16. Five days built like a college training block.',
        includes: [
          'Capped at 16.',
          'Daily individualized coaching',
          'Strength & recovery programming',
          'Lodging, meals & full film library',
        ],
      },
      {
        id: 'camp-winter',
        name: 'Winter Break Intensive',
        startIso: '2026-12-27',
        endIso: '2026-12-29',
        nights: 2,
        price: 895,
        deposit: 200,
        capacity: 24,
        spotsRemaining: 0,
        location: 'Riverside, CA',
        summary:
          'Mid-season sharpening for athletes heading into the postseason.',
        includes: [
          'Three training sessions daily',
          'Lodging & all meals',
          'Postseason game-planning',
        ],
      },
    ],
    includes: [
      'Deposit reserves the spot',
      'Lodging, meals and gear included',
      'Balance due three weeks out',
    ],
    photoId: '20CIFFNL3895',
    scheduleHeading: 'Choose your camp',
    scheduleHint:
      'Each camp is one block. The deposit holds the bed; the balance comes later.',
  },
];

export function getOffering(id: OfferingId | null): Offering | null {
  if (!id) return null;
  return OFFERINGS.find((o) => o.id === id) ?? null;
}

export function campById(offering: CampOffering, id: string | null): Camp | null {
  if (!id) return null;
  return offering.camps.find((c) => c.id === id) ?? null;
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
  /** camp-block */
  campId: string | null;
}

export const EMPTY_SELECTION: BookingSelection = {
  offeringId: null,
  dateIso: null,
  slotId: null,
  sessionIds: [],
  weekdays: [],
  bandId: null,
  startMonth: SEASON_START_MONTH,
  campId: null,
};

export type Cadence = 'once' | 'monthly' | 'deposit';

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

export interface Quote {
  cadence: Cadence;
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
  savings?: number;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

const EMPTY_QUOTE: Quote = {
  cadence: 'once',
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
};

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

  const lines: PriceLine[] = [
    {
      label: `${offering.name} · ${offering.minutes} min`,
      detail:
        offering.athletes > 1
          ? `${offering.athletes} athletes, one mat`
          : 'One athlete, one coach',
      amount: offering.price,
      kind: 'charge',
    },
  ];

  if (offering.athletes > 1) {
    lines.push({
      label: 'Per athlete',
      detail: 'Split between two families',
      amount: offering.price / offering.athletes,
      kind: 'note',
    });
  }

  const schedule: ScheduleLine[] = [];
  if (dateIso) schedule.push({label: 'Date', value: formatLongDate(dateIso)});
  if (slot) {
    schedule.push({
      label: 'Time',
      value: `${slot.label} · ${offering.minutes} minutes`,
    });
  }
  schedule.push({label: 'Location', value: 'Riverside, CA'});

  const complete = Boolean(dateIso && slot);

  return {
    cadence: 'once',
    lines,
    schedule,
    total: offering.price,
    totalLabel: 'Session total',
    dueNow: offering.price,
    dueLabel: 'Due at booking',
    balance: null,
    balanceLabel: null,
  balanceDueDate: null,
    terms:
      'Paid in full when Jesse confirms. Free to reschedule up to 24 hours before the session.',
    complete,
    nextHint: !dateIso
      ? 'Pick a date on the calendar.'
      : !slot
        ? 'Choose an open time.'
        : 'Ready — continue to your details.',
  };
}

function quoteSessions(
  offering: SessionListOffering,
  selection: BookingSelection,
): Quote {
  const picked = offering.sessions.filter((s) =>
    selection.sessionIds.includes(s.id),
  );
  const count = picked.length;
  const bundles = Math.floor(count / offering.bundleSize);
  const singles = count % offering.bundleSize;
  const total = bundles * offering.bundlePrice + singles * offering.pricePerSession;
  const listPrice = count * offering.pricePerSession;

  const lines: PriceLine[] = [];
  if (bundles > 0) {
    lines.push({
      label: `${offering.bundleSize}-session bundle${bundles > 1 ? ` ×${bundles}` : ''}`,
      detail: 'Bundle rate applied automatically',
      amount: bundles * offering.bundlePrice,
      kind: 'charge',
    });
  }
  if (singles > 0) {
    lines.push({
      label: `Single clinic${singles > 1 ? ` ×${singles}` : ''}`,
      detail: `${formatMoney(offering.pricePerSession)} per athlete, per day`,
      amount: singles * offering.pricePerSession,
      kind: 'charge',
    });
  }

  const schedule: ScheduleLine[] = picked.map((s) => ({
    label: formatMediumDate(s.dateIso),
    value: `${s.title} · ${s.window}`,
  }));

  const savings = listPrice - total;

  return {
    cadence: 'once',
    lines,
    schedule,
    total,
    totalLabel: 'Clinic total',
    dueNow: total,
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
    savings: savings > 0 ? savings : undefined,
  };
}

function quotePackage(
  offering: WeeklyPatternOffering,
  selection: BookingSelection,
): Quote {
  const days = selection.weekdays.length;
  const tier = tierForDays(offering, days);
  const band = offering.bands.find((b) => b.id === selection.bandId) ?? null;
  const dates = datesForWeekdaysInMonth(selection.startMonth, selection.weekdays);
  const monthly = tier?.monthly ?? 0;

  const lines: PriceLine[] = tier
    ? [
        {
          label: `${tier.name} package`,
          detail: `${days} days per week · ${offering.location}`,
          amount: tier.monthly,
          kind: 'charge',
        },
        {
          label: 'Per session',
          detail: `≈ ${dates.length} sessions in ${monthLabel(selection.startMonth)}`,
          amount: dates.length
            ? Math.round(tier.monthly / dates.length)
            : tier.monthly,
          kind: 'note',
        },
      ]
    : [];

  const schedule: ScheduleLine[] = [];
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

  const complete = Boolean(tier && band);

  return {
    cadence: 'monthly',
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
    terms:
      'Billed monthly on the day of your first session. Cancel or change your training days with 30 days notice.',
    complete,
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
  const camp = campById(offering, selection.campId);
  if (!camp) {
    return {
      ...EMPTY_QUOTE,
      dueLabel: 'Deposit',
      totalLabel: 'Camp total',
      cadence: 'deposit',
      terms:
        'A deposit reserves the bed. The balance is due three weeks before the first day.',
      nextHint: 'Choose a camp.',
    };
  }

  const balance = camp.price - camp.deposit;
  const balanceDate = addDaysIso(camp.startIso, -offering.balanceDueDaysBefore);

  return {
    cadence: 'deposit',
    lines: [
      {
        label: `${camp.name} · ${camp.nights + 1} days`,
        detail: `${formatDateRange(camp.startIso, camp.endIso)} · ${camp.location}`,
        amount: camp.price,
        kind: 'charge',
      },
      {
        label: 'Booking deposit',
        detail: 'Reserves the spot, applied to the total',
        amount: camp.deposit,
        kind: 'note',
      },
    ],
    schedule: [
      {label: 'Dates', value: formatDateRange(camp.startIso, camp.endIso)},
      {
        label: 'Length',
        value: `${camp.nights + 1} days, ${camp.nights} nights`,
      },
      {label: 'Location', value: camp.location},
      {
        label: 'Spots',
        value:
          camp.spotsRemaining > 0
            ? `${camp.spotsRemaining} of ${camp.capacity} remaining`
            : 'Waitlist only',
      },
    ],
    total: camp.price,
    totalLabel: 'Camp total',
    dueNow: camp.deposit,
    dueLabel: 'Deposit due now',
    balance,
    balanceLabel: `Balance ${formatMoney(balance)} due ${formatMediumDate(balanceDate)}`,
    balanceDueDate: formatMediumDate(balanceDate),
    terms: `The deposit is non-refundable inside ${offering.balanceDueDaysBefore} days of camp. Everything else — lodging, meals, gear — is included in the total.`,
    complete: camp.spotsRemaining > 0,
    nextHint:
      camp.spotsRemaining > 0
        ? 'Ready — continue to your details.'
        : 'This camp is full. Choose another date or join the waitlist.',
  };
}

/* ------------------------------------------------------------------ */
/* Request payload                                                     */
/* ------------------------------------------------------------------ */

export interface AthleteDetails {
  athleteName: string;
  age: string;
  grade: string;
  email: string;
  phone: string;
  notes: string;
  acceptsDepositTerms: boolean;
}

export const EMPTY_DETAILS: AthleteDetails = {
  athleteName: '',
  age: '',
  grade: '',
  email: '',
  phone: '',
  notes: '',
  acceptsDepositTerms: false,
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

export type DetailErrors = Partial<Record<keyof AthleteDetails, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validateDetails(
  details: AthleteDetails,
  requireDepositTerms: boolean,
): DetailErrors {
  const errors: DetailErrors = {};

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

  return errors;
}

/** Short human reference for the confirmation screen. */
export function referenceCode(
  selection: BookingSelection,
  details: AthleteDetails,
): string {
  const seed = `${selection.offeringId}|${selection.dateIso}|${selection.slotId}|${selection.campId}|${selection.sessionIds.join(',')}|${selection.weekdays.join('')}|${details.email}`;
  return `JV-${hash(seed).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)}`;
}
