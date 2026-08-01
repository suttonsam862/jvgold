/**
 * ============================================================================
 * JV GOLD — OPERATIONS SEED DATASET
 * ============================================================================
 *
 * A realistic, fully-typed stand-in for the live business data, so every page
 * in the private hub can be built against the real shape while the Shopify
 * connector is disconnected and the store is unlinked.
 *
 * ---------------------------------------------------------------------------
 * THREE RULES THIS FILE OBEYS. Do not relax any of them.
 * ---------------------------------------------------------------------------
 *
 * 1. EVERY PERSON IS DE-IDENTIFIED.
 *    "Athlete 01", "Guardian 07", "Family 03", "Account 12". Never a human
 *    name — invented or otherwise — and never invented medical, injury or
 *    weight-cut status attached to a name. An earlier draft of this project
 *    shipped fabricated named minors with weights and injury status and it had
 *    to be torn out. A screenshot of this hub must never read as real records
 *    about real children.
 *
 * 2. NOTHING IS RANDOM AND NOTHING IS "NOW".
 *    `Math.random()` and `Date.now()` must not appear in this file. Unstable
 *    data renders one way on the server and another in the browser, which
 *    breaks SSR hydration. All variation comes from the inline seeded PRNG
 *    below; all dates are derived from `ANCHOR_DATE` using the pure civil-date
 *    integer arithmetic in `./types`. No `new Date()` anywhere.
 *
 * 3. MONEY IS INTEGER CENTS.
 *    $200.00 is `20000`. Format with `formatMoney` at the render edge only.
 *
 * ---------------------------------------------------------------------------
 * SWAPPING IN LIVE DATA
 * ---------------------------------------------------------------------------
 * Pages should import the named arrays (`CLIENTS`, `SESSIONS`, …) or the whole
 * `OPS_DATASET`. When Shopify + Supabase are linked, the loaders build the same
 * `OpsDataset` from live queries and this module is deleted. Nothing in a page
 * component changes. See docs/DATA-MODEL.md.
 */

import {OFFERINGS, type OfferingId} from '~/lib/offerings';
import {
  addDays,
  daysBetween,
  daysFromIso,
  isoFromDays,
  monthKeyOf,
  percentOf,
  sumCents,
  weekdayOfIso,
  formatMoney,
  DEFAULT_CURRENCY,
  type CalendarAttendee,
  type CalendarEvent,
  type Client,
  type ClientLevel,
  type ClientSource,
  type ClientStatus,
  type Compliance,
  type GoogleColorId,
  type IsoDate,
  type IsoDateTime,
  type IntegrationStatus,
  type KPI,
  type MonthKey,
  type MonthlyRevenue,
  type OpsDataset,
  type OutstandingAccount,
  type PackageState,
  type Payment,
  type PaymentCategory,
  type PaymentMethod,
  type Product,
  type ProductVariant,
  type RevenueBySource,
  type RevenueSource,
  type SessionKind,
  type SessionStatus,
  type TrainingSession,
} from './types';

/* ==========================================================================
 * ANCHOR
 * ======================================================================== */

/**
 * The one fixed point the entire dataset hangs off. Everything — birthdays,
 * session dates, "last 30 days", the calendar week — is derived from this by
 * integer day arithmetic.
 *
 * Treat it as "today" inside the hub. Never call `Date.now()` to get today:
 * the server and the browser would disagree and React would blow up hydration.
 */
export const ANCHOR_DATE: IsoDate = '2026-08-01';

/** Day number of the anchor. Cheap base for every offset below. */
const ANCHOR = daysFromIso(ANCHOR_DATE);

/** History window: six months of sessions ending at the anchor. */
const HISTORY_DAYS = 181;
/** Forward window: three weeks of already-scheduled sessions. */
const FUTURE_DAYS = 21;

const WINDOW_START: IsoDate = isoFromDays(ANCHOR - HISTORY_DAYS);
const WINDOW_END: IsoDate = isoFromDays(ANCHOR + FUTURE_DAYS);

/** Target volumes. Fixed, so filters and charts always have enough to chew on. */
const CLIENT_COUNT = 40;
const SESSION_COUNT = 124;
const PAYMENT_COUNT = 90;
/** Ledger-session payments; the remainder of PAYMENT_COUNT is big-ticket. */
const SESSION_PAYMENT_COUNT = 74;

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/* ==========================================================================
 * SEEDED PRNG — inline, dependency-free, deterministic
 *
 * FNV-1a to turn a label into a 32-bit seed, then mulberry32 to stream floats
 * in [0, 1). Same seed ⇒ same sequence ⇒ identical HTML on server and client.
 * ======================================================================== */

function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Rng = () => number;

function makeRng(seedText: string): Rng {
  let a = fnv1a(seedText) | 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** True with probability `p` (0-1). */
function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** One element of a non-empty list. */
function one<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

/** In-place Fisher-Yates on a copy. Used to shuffle exact-count pools. */
function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Take exactly `count` items spread evenly across `list`. Used instead of a
 * probability gate so the totals (124 sessions, 90 payments) are guaranteed
 * rather than approximate, while keeping the temporal spread even.
 */
function stride<T>(list: readonly T[], count: number): T[] {
  if (count >= list.length) return list.slice();
  const out: T[] = [];
  const step = list.length / count;
  for (let i = 0; i < count; i++) out.push(list[Math.floor(i * step)]);
  return out;
}

/** An exact-count pool: `[['Active', 22], ['Trial', 5]]` → 27 entries. */
function pool<T>(spec: ReadonlyArray<readonly [T, number]>): T[] {
  const out: T[] = [];
  for (const [value, n] of spec) {
    for (let i = 0; i < n; i++) out.push(value);
  }
  return out;
}

const nn = (n: number) => String(n).padStart(2, '0');
const nnn = (n: number) => String(n).padStart(3, '0');

/** `'2026-08-01'` + hour/minute → `'2026-08-01T16:30:00'`. */
function at(date: IsoDate, hour: number, minute: number): IsoDateTime {
  return `${date}T${nn(hour)}:${nn(minute)}:00`;
}

/** Add whole minutes to a wall-clock timestamp. Rolls the date correctly. */
function addMinutes(stamp: IsoDateTime, minutes: number): IsoDateTime {
  const date = stamp.slice(0, 10);
  const total =
    Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16)) + minutes;
  const dayShift = Math.floor(total / (24 * 60));
  const rest = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return at(addDays(date, dayShift), Math.floor(rest / 60), rest % 60);
}

/** `'2026-03'` → `'Mar'`. */
function monthLabelShort(key: MonthKey): string {
  return MONTH_ABBR[Number(key.slice(5, 7)) - 1];
}

/* ==========================================================================
 * VOCABULARY POOLS
 *
 * Places and technical focus are real coaching language. People are not.
 * ======================================================================== */

const LOCATIONS = [
  'Riverside Mat Room',
  'Private Studio',
  'Deep Waters RTC',
  'Garage — 5AM',
  'Riverside Strength Annex',
];

const FOCUS_BY_KIND: Record<SessionKind, readonly string[]> = {
  private: [
    'Leg attacks — re-attack off the whistle',
    'Front headlock series',
    'Bottom half — stand up on the whistle',
    'Hand fighting, ties and level change',
    'Edge finishes and out-of-bounds awareness',
    'Top pressure — breakdown to legs',
  ],
  partner: [
    'Live situations, 30-second goes',
    'Chain wrestling off the single',
    'Scramble positions, both sides',
    'Front headlock into go-behind',
  ],
  workout: [
    'Strength block + live conditioning',
    'Posterior chain, then hard drilling',
    'Motor work — third-period conditioning',
    'Tempo circuits + situational live',
  ],
  clinic: [
    'Leg attacks & finishes',
    'Top pressure & turns',
    'Short offense & scrambles',
    'Hand fighting & ties',
    'Bottom escapes & reversals',
  ],
  group: [
    'Open mat — live goes',
    'Team technique + situations',
    'Youth fundamentals block',
    'Pre-tournament sharpening',
  ],
  camp: [
    'Camp session — technique block',
    'Camp session — live block',
    'Camp session — evening film',
  ],
};

const TAG_POOL = [
  'state-qualifier',
  'camp-2026',
  'referral',
  'sibling',
  'weekend-only',
  'travel-team',
  'new-this-season',
  'film-review',
  'club-partner',
  'priority',
];

/** Operational notes only. Never medical, never injury, never body weight. */
const NOTE_POOL: readonly (string | null)[] = [
  null,
  null,
  null,
  'Prefers evening slots.',
  'Travels for tournaments most weekends.',
  'Billing handled by the household account.',
  'Wants film sent after each session.',
  'Carpools with another family — keep the same slot.',
  'Booked through the site, not yet in Shopify.',
  'Coach to confirm package renewal.',
];

const SCHOOL_SUFFIX = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/* ==========================================================================
 * 1. CLIENTS
 * ======================================================================== */

/**
 * Sibling households. Each inner array holds client indices (0-based) that
 * share a `familyGroup`, mirroring how the club actually bills: one household,
 * several wrestlers. 22 of the 40 athletes sit in a household; the rest are
 * billed alone.
 */
const FAMILY_PLAN: ReadonlyArray<readonly number[]> = [
  [0, 1],
  [2, 3, 4],
  [5, 6],
  [9, 10],
  [13, 14],
  [17, 18, 19],
  [22, 23],
  [27, 28],
  [31, 32, 33],
];

function buildClients(rng: Rng): Client[] {
  // Exact-count pools keep the distributions readable in the UI rather than
  // leaving them to chance.
  const levels = shuffled(
    rng,
    pool<ClientLevel>([
      ['Youth', 17],
      ['HS', 16],
      ['College', 4],
      ['Adult', 3],
    ]),
  );
  const statuses = shuffled(
    rng,
    pool<ClientStatus>([
      ['Active', 22],
      ['Trial', 5],
      ['Paid In Full', 6],
      ['Owes Balance', 4],
      ['Inactive', 3],
    ]),
  );
  const sources = shuffled(
    rng,
    pool<ClientSource>([
      ['shopify', 12],
      ['site', 11],
      ['manual', 10],
      ['import', 7],
    ]),
  );

  // index → 'Family 03'
  const familyOf = new Map<number, string>();
  FAMILY_PLAN.forEach((members, i) => {
    for (const m of members) familyOf.set(m, `Family ${nn(i + 1)}`);
  });

  const clients: Client[] = [];

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const label = nn(i + 1);
    const level = levels[i];
    const status = statuses[i];
    const source = sources[i];

    // Age band follows the competitive level. DOB is stored; age is derived at
    // render time with `ageOn(dob, ANCHOR_DATE)` so it never goes stale.
    const ageBand: Record<ClientLevel, [number, number]> = {
      Youth: [8, 13],
      HS: [14, 18],
      College: [19, 22],
      Adult: [23, 38],
    };
    const [minAge, maxAge] = ageBand[level];
    const age = int(rng, minAge, maxAge);
    const dateOfBirth = isoFromDays(ANCHOR - (age * 365 + int(rng, 1, 364)));

    // Trial athletes are by definition recent; everyone else has history. This
    // is what makes the "new athletes — 30 days" figure non-zero and honest.
    const joinedAt = isoFromDays(
      ANCHOR - (status === 'Trial' ? int(rng, 4, 46) : int(rng, 34, 700)),
    );
    const isMinor = level === 'Youth' || level === 'HS';

    const compliance: Compliance = {
      // The holes are the point — the compliance screen exists to chase them.
      usawCardNumber: chance(rng, 0.72)
        ? `USAW-2026-${nnn(int(rng, 100, 999))}`
        : null,
      hasHealthInsurance: chance(rng, 0.82) ? true : chance(rng, 0.5) ? false : null,
      insuranceProvider: chance(rng, 0.62) ? `Carrier ${one(rng, SCHOOL_SUFFIX)}` : null,
      insurancePolicyNumber: chance(rng, 0.55)
        ? `POL-${nnn(int(rng, 100, 999))}-${int(rng, 10, 99)}`
        : null,
      emergencyContactName: isMinor && chance(rng, 0.85) ? `Contact ${label}` : null,
      emergencyContactPhone: chance(rng, 0.8) ? `(951) 555-02${label}` : null,
      waiverSigned: chance(rng, 0.86),
    };

    const packageState = buildPackage(rng, status, level);

    const tagCount = int(rng, 0, 3);
    const tags = shuffled(rng, TAG_POOL).slice(0, tagCount).sort();

    clients.push({
      id: `cl-${label}`,
      name: `Athlete ${label}`,
      accountLabel: `Account ${label}`,
      guardian: isMinor ? `Guardian ${label}` : null,
      email: `athlete${label}@example.com`,
      phone: `(951) 555-01${label}`,
      level,
      school:
        level === 'Adult'
          ? null
          : level === 'College'
            ? `University ${one(rng, SCHOOL_SUFFIX)}`
            : `School ${one(rng, SCHOOL_SUFFIX)}`,
      dateOfBirth,
      status,
      familyGroup: familyOf.get(i) ?? null,
      packages: packageState,
      compliance,
      tags,
      joinedAt,
      // Patched from the session ledger once sessions exist.
      lastSessionAt: null,
      lifetimeValueCents: 0,
      balanceCents: 0,
      source,
      rateCents: chance(rng, 0.15) ? one(rng, [15000, 17500, 20000, 22500]) : null,
      colorIndex: i % 8,
      notes: one(rng, NOTE_POOL),
      // Null until the store is linked. This null is what the products and
      // clients pages render as "not synced".
      shopifyCustomerId: null,
    });
  }

  return clients;
}

function buildPackage(
  rng: Rng,
  status: ClientStatus,
  level: ClientLevel,
): PackageState {
  if (status === 'Trial') {
    return {
      name: 'Trial — pay as you go',
      priceCents: null,
      purchased: null,
      used: int(rng, 1, 2),
      remaining: 0,
      offeringId: 'private',
    };
  }
  if (status === 'Inactive') {
    return {
      name: null,
      priceCents: null,
      purchased: null,
      used: null,
      remaining: 0,
      offeringId: null,
    };
  }

  // Monthly packages skew to HS/College; session blocks to Youth.
  const monthly = level === 'HS' || level === 'College' ? chance(rng, 0.55) : chance(rng, 0.25);

  if (monthly) {
    const tier = one(rng, [
      ['Two-Day Monthly Package', 140000],
      ['Three-Day Monthly Package', 200000],
      ['Gold Standard Monthly Package', 320000],
    ] as const);
    const purchased = int(rng, 8, 20);
    const used = int(rng, 2, purchased);
    return {
      name: tier[0],
      priceCents: tier[1],
      purchased,
      used,
      remaining: purchased - used,
      offeringId: 'package',
    };
  }

  const blocks = one(rng, [5, 10, 10, 20] as const);
  const used = int(rng, 0, blocks);
  return {
    name: `${blocks}-Session Block`,
    priceCents: blocks * 20000 - (blocks >= 10 ? 10000 : 0),
    purchased: blocks,
    used,
    remaining: blocks - used,
    offeringId: 'private',
  };
}

/* ==========================================================================
 * 2. SESSIONS
 *
 * Candidate mat times are generated from Jesse's real weekly pattern (see
 * `offerings.ts`), then exactly SESSION_COUNT of them are taken with an even
 * stride so the six-month spread stays realistic and the total is fixed.
 * ======================================================================== */

/** Weekday (0=Sun) → the hours Jesse opens, and what usually happens then. */
const WEEK_PATTERN: Record<number, ReadonlyArray<[number, number, SessionKind]>> = {
  0: [],
  1: [
    [6, 0, 'workout'],
    [18, 0, 'workout'],
  ],
  2: [
    [16, 0, 'private'],
    [17, 15, 'private'],
    [18, 30, 'private'],
    [19, 45, 'partner'],
  ],
  3: [
    [6, 0, 'workout'],
    [15, 30, 'group'],
  ],
  4: [
    [16, 0, 'private'],
    [17, 15, 'private'],
    [18, 30, 'partner'],
    [19, 45, 'private'],
  ],
  5: [
    [6, 0, 'workout'],
    [18, 0, 'group'],
  ],
  6: [
    [8, 0, 'private'],
    [9, 15, 'clinic'],
    [10, 30, 'partner'],
  ],
};

const MINUTES_BY_KIND: Record<SessionKind, number> = {
  private: 60,
  partner: 60,
  workout: 90,
  clinic: 120,
  group: 90,
  camp: 180,
};

const OFFERING_BY_KIND: Record<SessionKind, OfferingId | null> = {
  private: 'private',
  partner: 'partner',
  workout: 'workout',
  clinic: 'clinic',
  group: null,
  camp: 'camp',
};

/** Per-athlete rate in cents, straight off `offerings.ts`. */
const RATE_BY_KIND: Record<SessionKind, number> = {
  private: 20000,
  partner: 20000, // total for the mat, split between two families
  workout: 15000,
  clinic: 10000, // per athlete, per day
  group: 3500, // open-mat drop-in
  camp: 0, // paid as a camp registration, not per session
};

const PAY_METHODS = pool<PaymentMethod>([
  ['Zelle', 8],
  ['Cash', 7],
  ['Venmo', 5],
  ['Card', 4],
  ['Shopify', 3],
  ['Check', 1],
]);

function buildSessions(rng: Rng, clients: Client[]): TrainingSession[] {
  // Athletes eligible to appear on the mat. Inactive athletes still show in
  // older sessions, which is exactly what makes the roster filters meaningful.
  const activeIds = clients
    .filter((c) => c.status !== 'Inactive')
    .map((c) => c.id);
  const allIds = clients.map((c) => c.id);

  type Candidate = {date: IsoDate; hour: number; minute: number; kind: SessionKind};
  const candidates: Candidate[] = [];

  for (let d = daysFromIso(WINDOW_START); d <= daysFromIso(WINDOW_END); d++) {
    const date = isoFromDays(d);
    for (const [hour, minute, kind] of WEEK_PATTERN[weekdayOfIso(date)]) {
      candidates.push({date, hour, minute, kind});
    }
  }

  const chosen = stride(candidates, SESSION_COUNT);
  const sessions: TrainingSession[] = [];

  chosen.forEach((slot, i) => {
    const id = `se-${nnn(i + 1)}`;
    const kind = slot.kind;
    const minutes = MINUTES_BY_KIND[kind];
    const start = at(slot.date, slot.hour, slot.minute);
    const end = addMinutes(start, minutes);
    const isPast = slot.date < ANCHOR_DATE;

    // Roster for the block. Past sessions may include athletes who have since
    // gone inactive; future sessions only use athletes still on the mat.
    const idPool = isPast ? allIds : activeIds;
    const headcount =
      kind === 'private' || kind === 'workout'
        ? 1
        : kind === 'partner'
          ? 2
          : kind === 'clinic'
            ? int(rng, 6, 16)
            : kind === 'camp'
              ? int(rng, 8, 16)
              : int(rng, 6, 18);

    const athleteIds = shuffled(rng, idPool).slice(0, Math.min(headcount, idPool.length));

    // Status: history is mostly completed with a realistic tail of drops.
    let status: SessionStatus;
    if (!isPast) {
      status = 'scheduled';
    } else {
      const roll = rng();
      status = roll < 0.9 ? 'completed' : roll < 0.96 ? 'cancelled' : 'no-show';
    }

    // Money. A cancelled session earns nothing; a no-show is still billed.
    const perAthlete = RATE_BY_KIND[kind];
    const gross =
      kind === 'private' || kind === 'partner' || kind === 'workout'
        ? perAthlete
        : perAthlete * athleteIds.length;
    const amountCents = status === 'cancelled' ? 0 : gross;

    // A session covered by a package consumes a session but takes no cash.
    const coveredByPackage = kind !== 'clinic' && kind !== 'camp' && chance(rng, 0.18);
    const billable = amountCents > 0 && !coveredByPackage;

    const paid = billable && status !== 'scheduled' && chance(rng, 0.87);
    const paidDate = paid ? addDays(slot.date, int(rng, 0, 4)) : null;

    sessions.push({
      id,
      start,
      end,
      minutes,
      kind,
      offeringId: OFFERING_BY_KIND[kind],
      athleteIds,
      location:
        kind === 'workout'
          ? one(rng, ['Riverside Strength Annex', 'Garage — 5AM'])
          : kind === 'private' || kind === 'partner'
            ? one(rng, ['Riverside Mat Room', 'Private Studio'])
            : one(rng, LOCATIONS),
      focus: one(rng, FOCUS_BY_KIND[kind]),
      amountCents: coveredByPackage ? 0 : amountCents,
      paid,
      paidDate,
      method: paid ? one(rng, PAY_METHODS) : null,
      notes: coveredByPackage
        ? 'Covered by package — no separate charge.'
        : status === 'cancelled'
          ? 'Cancelled with more than 24 hours notice.'
          : status === 'no-show'
            ? 'No-show. Billed per policy.'
            : '',
      status,
      sessionsUsed: status === 'cancelled' ? 0 : 1,
    });
  });

  return sessions;
}

/* ==========================================================================
 * 3. PAYMENTS
 * ======================================================================== */

const CATEGORY_BY_KIND: Record<SessionKind, PaymentCategory> = {
  private: 'private',
  partner: 'partner',
  workout: 'workout',
  clinic: 'clinic',
  group: 'other',
  camp: 'camp',
};

/** Which revenue bucket a payment method rolls into. */
const SOURCE_BY_METHOD: Record<PaymentMethod, RevenueSource> = {
  Cash: 'cash',
  Zelle: 'zelle',
  Venmo: 'venmo',
  Card: 'site',
  Check: 'check',
  Shopify: 'shopify',
  Other: 'other',
};

/** Card-present/online processing fee, in cents. Cash and Zelle are free. */
function feeFor(method: PaymentMethod, amountCents: number): number {
  if (method === 'Card' || method === 'Shopify') {
    return Math.round(amountCents * 0.029) + 30;
  }
  return 0;
}

function buildPayments(
  rng: Rng,
  clients: Client[],
  sessions: TrainingSession[],
): Payment[] {
  const payments: Payment[] = [];

  /* --- a) One payment per settled ledger session ----------------------- */
  const settled = sessions.filter(
    (s) => s.paid && s.amountCents > 0 && s.paidDate !== null,
  );
  const picked = stride(settled, Math.min(SESSION_PAYMENT_COUNT, settled.length));

  picked.forEach((s, i) => {
    const method = s.method ?? 'Cash';
    const amountCents = s.amountCents;
    // A small, believable tail of goodwill refunds.
    const refundedCents = chance(rng, 0.03) ? Math.round(amountCents / 2) : 0;
    const feeCents = feeFor(method, amountCents);
    const offering = s.offeringId ? OFFERINGS.find((o) => o.id === s.offeringId) : null;

    payments.push({
      id: `pay-${nnn(i + 1)}`,
      date: s.paidDate as IsoDate,
      clientId: s.athleteIds[0] ?? null,
      sessionId: s.id,
      offeringId: s.offeringId,
      category: CATEGORY_BY_KIND[s.kind],
      amountCents,
      refundedCents,
      feeCents,
      netCents: amountCents - refundedCents - feeCents,
      currency: DEFAULT_CURRENCY,
      method,
      source: SOURCE_BY_METHOD[method],
      status: refundedCents > 0 ? 'partially-refunded' : 'paid',
      description: `${offering?.name ?? 'Training session'} · ${s.minutes} min`,
      // Null everywhere until the store is linked and orders start syncing.
      shopifyOrderId: null,
      shopifyOrderName: null,
    });
  });

  /* --- b) Non-session revenue: packages, camps, clinics, merch --------- */
  const bigTicket = [
    {label: 'Two-Day Monthly Package', cents: 140000, cat: 'package' as PaymentCategory, off: 'package' as OfferingId},
    {label: 'Three-Day Monthly Package', cents: 200000, cat: 'package' as PaymentCategory, off: 'package' as OfferingId},
    {label: 'Gold Standard Monthly Package', cents: 320000, cat: 'package' as PaymentCategory, off: 'package' as OfferingId},
    {label: 'Summer Intensive — camp deposit', cents: 20000, cat: 'camp' as PaymentCategory, off: 'camp' as OfferingId},
    {label: 'Summer Intensive — balance', cents: 69500, cat: 'camp' as PaymentCategory, off: 'camp' as OfferingId},
    {label: 'Elite Overnight Camp — deposit', cents: 30000, cat: 'camp' as PaymentCategory, off: 'camp' as OfferingId},
    {label: '3-clinic bundle', cents: 20000, cat: 'clinic' as PaymentCategory, off: 'clinic' as OfferingId},
    {label: 'Training tee + shorts', cents: 9000, cat: 'merch' as PaymentCategory, off: null},
    {label: 'Standard hoodie', cents: 7500, cat: 'merch' as PaymentCategory, off: null},
  ];

  const payingClients = clients.filter((c) => c.status !== 'Inactive');

  // Whatever is left of the 90 after the ledger payments. Computed rather than
  // hardcoded so the total is exact even if the settled pool shifts.
  const otherCount = Math.max(0, PAYMENT_COUNT - picked.length);
  const spanDays = HISTORY_DAYS - 6;

  for (let i = 0; i < otherCount; i++) {
    const item = one(rng, bigTicket);
    const client = one(rng, payingClients);
    // Spread evenly backwards across the six-month history rather than
    // randomly, so no month is left with a suspiciously empty bar.
    const date = isoFromDays(
      ANCHOR - 3 - Math.round((i * spanDays) / otherCount) - int(rng, 0, 4),
    );
    const method: PaymentMethod =
      item.cat === 'merch' ? 'Shopify' : one(rng, ['Zelle', 'Card', 'Shopify', 'Cash', 'Check']);
    const amountCents = item.cents;
    const feeCents = feeFor(method, amountCents);

    payments.push({
      id: `pay-${nnn(picked.length + i + 1)}`,
      date,
      clientId: client.id,
      sessionId: null,
      offeringId: item.off,
      category: item.cat,
      amountCents,
      refundedCents: 0,
      feeCents,
      netCents: amountCents - feeCents,
      currency: DEFAULT_CURRENCY,
      method,
      source: SOURCE_BY_METHOD[method],
      status: 'paid',
      description: item.label,
      shopifyOrderId: null,
      shopifyOrderName: null,
    });
  }

  // Chronological — every finance view reads newest-first off a sorted list.
  payments.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
  return payments;
}

/* ==========================================================================
 * 4. CLIENT ROLL-UPS
 *
 * `lifetimeValueCents`, `balanceCents` and `lastSessionAt` are DERIVED. They
 * are stored on the client only because every screen wants them and nobody
 * should be re-reducing the ledger in a render.
 * ======================================================================== */

function patchClientRollups(
  clients: Client[],
  sessions: TrainingSession[],
  payments: Payment[],
): void {
  const ltv = new Map<string, number>();
  for (const p of payments) {
    if (!p.clientId) continue;
    ltv.set(p.clientId, (ltv.get(p.clientId) ?? 0) + (p.amountCents - p.refundedCents));
  }

  const balance = new Map<string, number>();
  const last = new Map<string, IsoDate>();

  for (const s of sessions) {
    const date = s.start.slice(0, 10);
    for (const id of s.athleteIds) {
      if (s.status === 'completed' && (!last.has(id) || last.get(id)! < date)) {
        last.set(id, date);
      }
    }
    // Unpaid, already-delivered, actually billable → an outstanding balance.
    // Attributed to the first athlete on the block, which is who the invoice
    // goes to for privates and partner sessions.
    if (!s.paid && s.amountCents > 0 && (s.status === 'completed' || s.status === 'no-show')) {
      const owner = s.athleteIds[0];
      if (owner) balance.set(owner, (balance.get(owner) ?? 0) + s.amountCents);
    }
  }

  for (const c of clients) {
    c.lifetimeValueCents = ltv.get(c.id) ?? 0;
    c.balanceCents = balance.get(c.id) ?? 0;
    c.lastSessionAt = last.get(c.id) ?? null;

    // Reconcile the label with the ledger. A client cannot read "Paid In Full"
    // on the roster while the sessions page shows them carrying a balance —
    // that contradiction is exactly the kind of thing that erodes trust in the
    // hub. The ledger wins; the status follows it.
    if (c.status !== 'Inactive') {
      if (c.balanceCents > 0) c.status = 'Owes Balance';
      else if (c.status === 'Owes Balance') c.status = 'Active';
    } else {
      // An inactive athlete's old balance is written off, not chased.
      c.balanceCents = 0;
    }
  }
}

/* ==========================================================================
 * 5. CALENDAR
 *
 * JV Gold sessions in the visible window become native events. On top of them
 * sit imported Google events — school duals, travel, family — which is half of
 * Jesse's real week. Imported events are `readOnly` until claimed, because
 * writing back before two-way sync exists would silently diverge from the copy
 * on his phone.
 * ======================================================================== */

const GOOGLE_CALENDAR_ID = 'jesse@jvgold.com';

/** Titles are venues, events and logistics — never a private person's name. */
const GOOGLE_EVENTS: ReadonlyArray<{
  offset: number;
  hour: number;
  minutes: number;
  title: string;
  location: string | null;
  allDay?: boolean;
  colorId: GoogleColorId;
  recurring?: boolean;
  claimed?: boolean;
}> = [
  {offset: -3, hour: 7, minutes: 60, title: 'Team lift — school room', location: 'Norco, CA', colorId: '9'},
  {offset: -2, hour: 12, minutes: 45, title: 'Sponsor call', location: null, colorId: '5'},
  {offset: -1, hour: 19, minutes: 90, title: 'Film session — travel team', location: 'Riverside Mat Room', colorId: '2', claimed: true},
  {offset: 0, hour: 9, minutes: 60, title: 'Gear vendor walkthrough', location: 'Riverside, CA', colorId: '6'},
  {offset: 1, hour: 8, minutes: 0, title: 'IEWA dual meet — all day', location: 'Corona, CA', allDay: true, colorId: '11'},
  {offset: 2, hour: 17, minutes: 60, title: 'Parent meeting — fall season', location: 'Riverside Mat Room', colorId: '10'},
  {offset: 4, hour: 6, minutes: 45, title: 'Recovery + mobility', location: null, colorId: '8', recurring: true},
  {offset: 5, hour: 13, minutes: 120, title: 'Camp logistics — lodging site visit', location: 'Riverside, CA', colorId: '3'},
  {offset: 6, hour: 8, minutes: 0, title: 'Travel — national duals', location: 'Fargo, ND', allDay: true, colorId: '11'},
  {offset: 8, hour: 16, minutes: 60, title: 'Podcast recording', location: null, colorId: '5'},
  {offset: 9, hour: 7, minutes: 45, title: 'Recovery + mobility', location: null, colorId: '8', recurring: true},
  {offset: 11, hour: 10, minutes: 90, title: 'Clinic walkthrough — partner club', location: 'Corona, CA', colorId: '6'},
  {offset: 13, hour: 8, minutes: 0, title: 'Summer Intensive — camp block', location: 'Riverside, CA', allDay: true, colorId: '11', claimed: true},
  {offset: 15, hour: 18, minutes: 60, title: 'Board call — Future Champions', location: null, colorId: '2'},
];

function buildCalendar(rng: Rng, sessions: TrainingSession[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // A five-week window either side of the anchor is all the calendar view ever
  // renders; keeping the array small keeps the phone fast.
  const from = isoFromDays(ANCHOR - 14);
  const to = isoFromDays(ANCHOR + FUTURE_DAYS);

  const inWindow = sessions.filter((s) => {
    const d = s.start.slice(0, 10);
    return d >= from && d <= to && s.status !== 'cancelled';
  });

  inWindow.forEach((s, i) => {
    const offering = s.offeringId ? OFFERINGS.find((o) => o.id === s.offeringId) : null;
    events.push({
      id: `ev-${nnn(i + 1)}`,
      source: 'jvgold',
      title:
        s.kind === 'private' || s.kind === 'workout'
          ? `${offering?.name ?? 'Session'} — 1 athlete`
          : `${offering?.name ?? 'Open mat'} — ${s.athleteIds.length} athletes`,
      start: s.start,
      end: s.end,
      allDay: false,
      location: s.location,
      description: s.focus,
      sessionId: s.id,
      kind: s.kind,
      offeringId: s.offeringId,
      athleteIds: s.athleteIds,
      amountCents: s.amountCents,
      googleEventId: null,
      calendarId: null,
      colorId: null,
      recurrence: null,
      attendees: [],
      // Native events are always editable.
      readOnly: false,
      claimed: true,
      syncedAt: null,
    });
  });

  GOOGLE_EVENTS.forEach((g, i) => {
    const date = isoFromDays(ANCHOR + g.offset);
    const start = g.allDay ? at(date, 0, 0) : at(date, g.hour, 0);
    const end = g.allDay ? at(addDays(date, 1), 0, 0) : addMinutes(start, g.minutes);
    const claimed = g.claimed === true;

    const attendees: CalendarAttendee[] = [
      {
        displayName: 'Jesse Vasquez',
        email: GOOGLE_CALENDAR_ID,
        responseStatus: 'accepted',
        self: true,
        clientId: null,
      },
    ];
    if (chance(rng, 0.45)) {
      attendees.push({
        // De-identified, exactly like the roster.
        displayName: `Contact ${nn(int(rng, 1, CLIENT_COUNT))}`,
        email: null,
        responseStatus: one(rng, ['accepted', 'tentative', 'needsAction'] as const),
        self: false,
        clientId: null,
      });
    }

    events.push({
      id: `gc-${nnn(i + 1)}`,
      source: 'google',
      title: g.title,
      start,
      end,
      allDay: g.allDay === true,
      location: g.location,
      description: null,
      // Claimed Google events have been matched to the ledger; unclaimed ones
      // have not, and must not be edited in-app.
      sessionId: null,
      kind: claimed ? 'group' : null,
      offeringId: null,
      athleteIds: [],
      amountCents: null,
      googleEventId: `g_${fnv1a(`${g.title}${g.offset}`).toString(36)}`,
      calendarId: GOOGLE_CALENDAR_ID,
      colorId: g.colorId,
      recurrence: g.recurring
        ? {
            rules: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TH'],
            label: 'Every Monday and Thursday',
            isException: false,
          }
        : null,
      attendees,
      readOnly: !claimed,
      claimed,
      // A fixed sync stamp, not `Date.now()`.
      syncedAt: at(ANCHOR_DATE, 6, 12),
    });
  });

  events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1));
  return events;
}

/* ==========================================================================
 * 6. FINANCE AGGREGATES
 * ======================================================================== */

/** The six complete months ending the month before the anchor. */
function historyMonths(): MonthKey[] {
  const y = Number(ANCHOR_DATE.slice(0, 4));
  const m = Number(ANCHOR_DATE.slice(5, 7));
  const out: MonthKey[] = [];
  for (let i = 6; i >= 1; i--) {
    const total = (y * 12 + (m - 1)) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    out.push(`${yy}-${nn(mm)}`);
  }
  return out;
}

function buildMonthlyRevenue(
  payments: Payment[],
  sessions: TrainingSession[],
): MonthlyRevenue[] {
  return historyMonths().map((month) => {
    const inMonth = payments.filter((p) => monthKeyOf(p.date) === month);
    const grossCents = sumCents(inMonth.map((p) => p.amountCents));
    const refundedCents = sumCents(inMonth.map((p) => p.refundedCents));
    const netCents = sumCents(inMonth.map((p) => p.netCents));
    const clientIds = new Set(inMonth.map((p) => p.clientId).filter(Boolean));
    const sessionCount = sessions.filter(
      (s) => monthKeyOf(s.start) === month && s.status === 'completed',
    ).length;

    return {
      month,
      label: monthLabelShort(month),
      grossCents,
      netCents,
      refundedCents,
      clients: clientIds.size,
      sessions: sessionCount,
      avgSessionCents: sessionCount ? Math.round(grossCents / sessionCount) : 0,
    };
  });
}

const SOURCE_LABELS: Record<RevenueSource, string> = {
  shopify: 'Shopify',
  site: 'Site / card',
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  check: 'Check',
  other: 'Other',
};

function buildRevenueBySource(payments: Payment[]): RevenueBySource[] {
  const totalGross = sumCents(payments.map((p) => p.amountCents));
  const keys: RevenueSource[] = ['shopify', 'site', 'cash', 'zelle', 'venmo', 'check', 'other'];

  return keys
    .map((source) => {
      const rows = payments.filter((p) => p.source === source);
      const grossCents = sumCents(rows.map((p) => p.amountCents));
      return {
        source,
        label: SOURCE_LABELS[source],
        grossCents,
        netCents: sumCents(rows.map((p) => p.netCents)),
        count: rows.length,
        share: Math.round(percentOf(grossCents, totalGross) * 10) / 10,
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.grossCents - a.grossCents);
}

/**
 * Outstanding balances, rolled up the way Jesse actually chases them: by
 * household, not by athlete. Siblings on one `familyGroup` are one phone call.
 */
function buildOutstanding(
  clients: Client[],
  sessions: TrainingSession[],
): OutstandingAccount[] {
  const owing = clients.filter((c) => c.balanceCents > 0);
  const groups = new Map<string, Client[]>();

  for (const c of owing) {
    const key = c.familyGroup ?? c.accountLabel;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  const accounts: OutstandingAccount[] = [];

  for (const [key, members] of groups) {
    const ids = new Set(members.map((m) => m.id));
    const unpaid = sessions.filter(
      (s) =>
        !s.paid &&
        s.amountCents > 0 &&
        (s.status === 'completed' || s.status === 'no-show') &&
        s.athleteIds.length > 0 &&
        ids.has(s.athleteIds[0]),
    );
    if (unpaid.length === 0) continue;

    const oldest = unpaid.reduce(
      (acc, s) => (s.start < acc ? s.start : acc),
      unpaid[0].start,
    );
    const oldestDate = oldest.slice(0, 10);

    accounts.push({
      // Household accounts read as "Family 03"; solo accounts as "Account 12".
      accountLabel: members[0].familyGroup ? key : members[0].accountLabel,
      familyGroup: members[0].familyGroup,
      clientIds: members.map((m) => m.id),
      balanceCents: sumCents(members.map((m) => m.balanceCents)),
      daysOverdue: daysBetween(oldestDate, ANCHOR_DATE),
      oldestUnpaidDate: oldestDate,
      sessionCount: unpaid.length,
      lastContactedAt: null,
    });
  }

  return accounts.sort((a, b) => b.balanceCents - a.balanceCents);
}

/* ==========================================================================
 * 7. KPIs
 *
 * Exactly ONE KPI in the set carries `emphasis: true`. That is the single gold
 * figure. Restraint is the design.
 * ======================================================================== */

function buildKpis(
  clients: Client[],
  sessions: TrainingSession[],
  payments: Payment[],
  monthly: MonthlyRevenue[],
  outstanding: OutstandingAccount[],
): KPI[] {
  const last30 = payments.filter((p) => daysBetween(p.date, ANCHOR_DATE) <= 30 && p.date <= ANCHOR_DATE);
  const prev30 = payments.filter((p) => {
    const age = daysBetween(p.date, ANCHOR_DATE);
    return age > 30 && age <= 60;
  });

  const gross30 = sumCents(last30.map((p) => p.amountCents));
  const grossPrev30 = sumCents(prev30.map((p) => p.amountCents));
  const net6mo = sumCents(monthly.map((m) => m.netCents));

  const activeClients = clients.filter((c) => c.status !== 'Inactive').length;
  const completed30 = sessions.filter(
    (s) => s.status === 'completed' && daysBetween(s.start.slice(0, 10), ANCHOR_DATE) <= 30,
  ).length;
  const completedPrev30 = sessions.filter((s) => {
    const age = daysBetween(s.start.slice(0, 10), ANCHOR_DATE);
    return s.status === 'completed' && age > 30 && age <= 60;
  }).length;

  const outstandingCents = sumCents(outstanding.map((a) => a.balanceCents));

  // Average value of a session, from the sessions themselves — NOT gross ÷
  // sessions, which would fold monthly packages and camp deposits into a
  // per-hour figure and read far too high.
  const billed30 = sessions.filter(
    (s) =>
      s.status === 'completed' &&
      s.amountCents > 0 &&
      daysBetween(s.start.slice(0, 10), ANCHOR_DATE) <= 30,
  );
  const avgSessionCents = billed30.length
    ? Math.round(sumCents(billed30.map((s) => s.amountCents)) / billed30.length)
    : 0;
  const newClients30 = clients.filter((c) => daysBetween(c.joinedAt, ANCHOR_DATE) <= 30).length;

  const delivered = sessions.filter((s) => s.status !== 'scheduled');
  const showRate = delivered.length
    ? percentOf(delivered.filter((s) => s.status === 'completed').length, delivered.length)
    : 0;

  const grossSpark = monthly.map((m) => m.grossCents);
  const sessionSpark = monthly.map((m) => m.sessions);
  const clientSpark = monthly.map((m) => m.clients);

  const delta = (now: number, before: number): number | null =>
    before === 0 ? null : Math.round(percentOf(now - before, before) * 10) / 10;

  const dir = (d: number | null) => (d === null || d === 0 ? 'flat' : d > 0 ? 'up' : 'down');

  const d30 = delta(gross30, grossPrev30);
  const dSessions = delta(completed30, completedPrev30);

  return [
    {
      id: 'gross-30',
      label: 'Gross — last 30 days',
      value: gross30,
      format: 'money',
      display: formatMoney(gross30),
      caption: `vs ${formatMoney(grossPrev30)} the 30 before`,
      deltaPercent: d30,
      direction: dir(d30),
      inverse: false,
      spark: grossSpark,
      // The single gold figure in the hub.
      emphasis: true,
    },
    {
      id: 'net-6mo',
      label: 'Net collected — 6 months',
      value: net6mo,
      format: 'money-compact',
      display: formatMoney(net6mo, {compact: true}),
      caption: 'After refunds and processing',
      deltaPercent: null,
      direction: 'flat',
      inverse: false,
      spark: monthly.map((m) => m.netCents),
      emphasis: false,
    },
    {
      id: 'active-athletes',
      label: 'Athletes on the mat',
      value: activeClients,
      format: 'count',
      display: String(activeClients),
      caption: `of ${clients.length} on the roster`,
      deltaPercent: null,
      direction: 'flat',
      inverse: false,
      spark: clientSpark,
      emphasis: false,
    },
    {
      id: 'sessions-30',
      label: 'Sessions — last 30 days',
      value: completed30,
      format: 'count',
      display: String(completed30),
      caption: `vs ${completedPrev30} the 30 before`,
      deltaPercent: dSessions,
      direction: dir(dSessions),
      inverse: false,
      spark: sessionSpark,
      emphasis: false,
    },
    {
      id: 'outstanding',
      label: 'Outstanding balance',
      value: outstandingCents,
      format: 'money',
      display: formatMoney(outstandingCents),
      caption: `${outstanding.length} accounts`,
      deltaPercent: null,
      direction: 'flat',
      // Down is good here — the UI colours on meaning, not on the arrow.
      inverse: true,
      spark: grossSpark,
      emphasis: false,
    },
    {
      id: 'avg-session',
      label: 'Average session value',
      value: avgSessionCents,
      format: 'money',
      display: formatMoney(avgSessionCents),
      caption: 'Last 30 days',
      deltaPercent: null,
      direction: 'flat',
      inverse: false,
      spark: monthly.map((m) => m.avgSessionCents),
      emphasis: false,
    },
    {
      id: 'new-athletes',
      label: 'New athletes — 30 days',
      value: newClients30,
      format: 'count',
      display: String(newClients30),
      caption: 'First session booked',
      deltaPercent: null,
      direction: 'flat',
      inverse: false,
      spark: clientSpark,
      emphasis: false,
    },
    {
      id: 'show-rate',
      label: 'Show rate',
      value: Math.round(showRate * 10) / 10,
      format: 'percent',
      display: `${Math.round(showRate)}%`,
      caption: 'Completed vs cancelled and no-show',
      deltaPercent: null,
      direction: 'flat',
      inverse: false,
      spark: sessionSpark,
      emphasis: false,
    },
  ];
}

/* ==========================================================================
 * 8. PRODUCTS
 *
 * Six bookable offerings, straight off `offerings.ts`, plus a small add-on
 * catalogue. Every `shopifyProductId` / `shopifyVariantId` is `null` — that is
 * the honest state of the world until the store is linked, and it is what the
 * products page renders as "not synced".
 * ======================================================================== */

function photoFor(id: OfferingId): string {
  return OFFERINGS.find((o) => o.id === id)?.photoId ?? '19HSWCIFF9832';
}

function variant(
  id: string,
  title: string,
  sku: string,
  priceCents: number,
  inventoryQuantity: number | null = null,
  compareAtPriceCents: number | null = null,
): ProductVariant {
  return {
    id,
    title,
    sku,
    priceCents,
    compareAtPriceCents,
    currency: DEFAULT_CURRENCY,
    inventoryQuantity,
    inventoryPolicy: inventoryQuantity === null ? 'continue' : 'deny',
    shopifyVariantId: null,
  };
}

function buildProducts(rng: Rng, payments: Payment[]): Product[] {
  const revenueFor = (category: Product['category'], offeringId: OfferingId | null) => {
    const rows = payments.filter((p) =>
      offeringId ? p.offeringId === offeringId : p.category === 'merch',
    );
    return {
      revenueCents: sumCents(rows.map((p) => p.amountCents - p.refundedCents)),
      unitsSold: rows.length,
    };
  };

  const base = (
    handle: string,
    title: string,
    description: string,
    category: Product['category'],
    offeringId: OfferingId | null,
    variants: ProductVariant[],
    photoId: string,
    tags: string[],
    productType: string,
  ): Product => {
    const {revenueCents, unitsSold} = revenueFor(category, offeringId);
    const head = variants[0];
    const tracked = variants.some((v) => v.inventoryQuantity !== null);
    return {
      id: `prod-${handle}`,
      title,
      handle,
      description,
      status: 'active',
      category,
      offeringId,
      priceCents: head.priceCents,
      compareAtPriceCents: head.compareAtPriceCents,
      currency: DEFAULT_CURRENCY,
      sku: head.sku,
      inventory: tracked
        ? variants.reduce((n, v) => n + (v.inventoryQuantity ?? 0), 0)
        : null,
      variants,
      images: [{photoId, altText: title}],
      tags,
      vendor: 'JV Gold',
      productType,
      // Null until the store is linked. Do not fake a gid.
      shopifyProductId: null,
      shopifyVariantId: null,
      unitsSold,
      revenueCents,
      conversionRate: Math.round(int(rng, 22, 68) * 10) / 10,
      createdAt: isoFromDays(ANCHOR - int(rng, 200, 400)),
      updatedAt: isoFromDays(ANCHOR - int(rng, 2, 40)),
    };
  };

  const products: Product[] = [
    base(
      'private-1-on-1',
      'Private 1-on-1',
      'Sixty minutes, one athlete, one coach. Individual technique work, live situations and a written plan every session.',
      'session',
      'private',
      [variant('v-private-60', '60 minutes', 'JV-PRIV-60', 20000), variant('v-private-90', '90 minutes', 'JV-PRIV-90', 28000)],
      photoFor('private'),
      ['training', 'private', 'featured'],
      'Training session',
    ),
    base(
      'partner-session',
      'Partner Session',
      'Two athletes, one mat, one rate the families share. Built-in live drilling partner at the same standard.',
      'session',
      'partner',
      [variant('v-partner-60', '60 minutes · 2 athletes', 'JV-PART-60', 20000)],
      photoFor('partner'),
      ['training', 'partner'],
      'Training session',
    ),
    base(
      'dedicated-workout',
      'Dedicated Workout',
      'Forty-five minutes of strength and conditioning, then forty-five of live wrestling. Benchmarks tracked session to session.',
      'session',
      'workout',
      [variant('v-workout-90', '90 minutes', 'JV-WORK-90', 15000)],
      photoFor('workout'),
      ['training', 'conditioning'],
      'Training session',
    ),
    base(
      'small-group-clinic',
      'Small-Group Clinic',
      'Position-focused clinics for teams, clubs and schools. Up to twenty athletes, two hours, technique then live.',
      'clinic',
      'clinic',
      [
        variant('v-clinic-1', 'Single clinic', 'JV-CLIN-1', 10000),
        variant('v-clinic-3', '3-clinic bundle', 'JV-CLIN-3', 20000, null, 30000),
      ],
      photoFor('clinic'),
      ['clinic', 'team'],
      'Clinic',
    ),
    base(
      'monthly-private-package',
      'Monthly Private Package',
      'Standing private sessions on the same days each week, billed monthly. The tier follows the commitment.',
      'package',
      'package',
      [
        variant('v-pkg-2', 'Two-Day', 'JV-PKG-2', 140000),
        variant('v-pkg-3', 'Three-Day', 'JV-PKG-3', 200000),
        variant('v-pkg-gold', 'Gold Standard', 'JV-PKG-GOLD', 320000),
      ],
      photoFor('package'),
      ['package', 'recurring', 'featured'],
      'Membership',
    ),
    base(
      'overnight-camp',
      'Overnight Camp',
      'Multi-day residential camps. Three sessions a day, film in the evening, lodging and meals included.',
      'camp',
      'camp',
      [
        variant('v-camp-summer', 'Summer Intensive · Aug 14–16', 'JV-CAMP-SUM', 89500, 7),
        variant('v-camp-elite', 'Elite Overnight · Oct 9–13', 'JV-CAMP-ELT', 145000, 11),
        variant('v-camp-winter', 'Winter Intensive · Dec 27–29', 'JV-CAMP-WIN', 89500, 0),
      ],
      photoFor('camp'),
      ['camp', 'residential'],
      'Camp',
    ),
    base(
      'standard-training-tee',
      'Standard Training Tee',
      'Heavyweight cotton tee. "Confidence. Discipline. Standard." on the back.',
      'apparel',
      null,
      [
        variant('v-tee-s', 'Small', 'JV-TEE-S', 4500, 12),
        variant('v-tee-m', 'Medium', 'JV-TEE-M', 4500, 24),
        variant('v-tee-l', 'Large', 'JV-TEE-L', 4500, 18),
        variant('v-tee-xl', 'X-Large', 'JV-TEE-XL', 4500, 6),
      ],
      '19HSWCIFF9832',
      ['apparel', 'merch'],
      'Apparel',
    ),
    base(
      'training-shorts',
      'Training Shorts',
      'Four-way stretch fight shorts, gold stitch at the hem.',
      'apparel',
      null,
      [
        variant('v-short-s', 'Small', 'JV-SHRT-S', 6500, 8),
        variant('v-short-m', 'Medium', 'JV-SHRT-M', 6500, 14),
        variant('v-short-l', 'Large', 'JV-SHRT-L', 6500, 9),
      ],
      '20CIFFNL3895',
      ['apparel', 'merch'],
      'Apparel',
    ),
  ];

  // One deliberately unpublished item, so the products page has a draft state
  // to render rather than a uniformly green wall.
  const draft = base(
    'film-review-remote',
    'Remote Film Review',
    'Send match footage, get a written breakdown and a corrective plan inside 48 hours.',
    'digital',
    null,
    [variant('v-film-1', 'Single match', 'JV-FILM-1', 7500)],
    '24COL_NCAA_RND16_9991',
    ['digital', 'film'],
    'Digital service',
  );
  draft.status = 'draft';
  draft.unitsSold = 0;
  draft.revenueCents = 0;
  draft.conversionRate = 0;
  products.push(draft);

  return products;
}

/* ==========================================================================
 * 9. INTEGRATIONS — be honest about what is and is not live
 * ======================================================================== */

function buildIntegrations(dataset: {
  clients: Client[];
  sessions: TrainingSession[];
  payments: Payment[];
  products: Product[];
  calendar: CalendarEvent[];
}): IntegrationStatus[] {
  return [
    {
      id: 'shopify',
      label: 'Shopify',
      state: 'disconnected',
      detail:
        'Store not linked. Products, customers and orders below are seed data — no live figures are being read.',
      lastSyncedAt: null,
      recordCount: dataset.products.length,
    },
    {
      id: 'supabase',
      label: 'Supabase — club records',
      state: 'disconnected',
      detail:
        'Schema exists (athletes, sessions, session_athletes, registrations) but this hub is not yet pointed at it.',
      lastSyncedAt: null,
      recordCount: dataset.clients.length + dataset.sessions.length,
    },
    {
      id: 'google-calendar',
      label: 'Google Calendar',
      state: 'partial',
      detail:
        'Read-only import only. Imported events cannot be edited here until two-way sync ships.',
      lastSyncedAt: at(ANCHOR_DATE, 6, 12),
      recordCount: dataset.calendar.filter((e) => e.source === 'google').length,
    },
    {
      id: 'stripe',
      label: 'Payments',
      state: 'disconnected',
      detail:
        'Cash, Zelle and Venmo are recorded by hand today. Card and Shopify totals are seed data.',
      lastSyncedAt: null,
      recordCount: dataset.payments.length,
    },
  ];
}

/* ==========================================================================
 * 10. BUILD — runs once, at module load, on both server and client
 * ======================================================================== */

function buildDataset(): OpsDataset {
  // One stream per entity so adding a field to clients does not reshuffle
  // every session and payment downstream.
  const clients = buildClients(makeRng('jvgold:clients:v1'));
  const sessions = buildSessions(makeRng('jvgold:sessions:v1'), clients);
  const payments = buildPayments(makeRng('jvgold:payments:v1'), clients, sessions);

  patchClientRollups(clients, sessions, payments);

  const calendar = buildCalendar(makeRng('jvgold:calendar:v1'), sessions);
  const products = buildProducts(makeRng('jvgold:products:v1'), payments);
  const monthlyRevenue = buildMonthlyRevenue(payments, sessions);
  const revenueBySource = buildRevenueBySource(payments);
  const outstanding = buildOutstanding(clients, sessions);
  const kpis = buildKpis(clients, sessions, payments, monthlyRevenue, outstanding);
  const integrations = buildIntegrations({clients, sessions, payments, products, calendar});

  // Newest first is how every list in the hub reads.
  sessions.sort((a, b) => (a.start > b.start ? -1 : a.start < b.start ? 1 : 0));

  return {
    anchorDate: ANCHOR_DATE,
    clients,
    sessions,
    calendar,
    payments,
    products,
    monthlyRevenue,
    revenueBySource,
    outstanding,
    kpis,
    integrations,
  };
}

/** The whole world, built once. */
export const OPS_DATASET: OpsDataset = buildDataset();

export const CLIENTS: Client[] = OPS_DATASET.clients;
/** Newest first. */
export const SESSIONS: TrainingSession[] = OPS_DATASET.sessions;
export const CALENDAR_EVENTS: CalendarEvent[] = OPS_DATASET.calendar;
/** Oldest first — charts read left to right. */
export const PAYMENTS: Payment[] = OPS_DATASET.payments;
export const PRODUCTS: Product[] = OPS_DATASET.products;
export const MONTHLY_REVENUE: MonthlyRevenue[] = OPS_DATASET.monthlyRevenue;
export const REVENUE_BY_SOURCE: RevenueBySource[] = OPS_DATASET.revenueBySource;
export const OUTSTANDING_ACCOUNTS: OutstandingAccount[] = OPS_DATASET.outstanding;
export const KPIS: KPI[] = OPS_DATASET.kpis;
export const INTEGRATIONS: IntegrationStatus[] = OPS_DATASET.integrations;

/* ==========================================================================
 * 11. QUERY HELPERS
 *
 * Small, allocation-cheap lookups so pages never re-implement a filter. All of
 * them survive the swap to live data unchanged.
 * ======================================================================== */

const CLIENT_INDEX = new Map(CLIENTS.map((c) => [c.id, c]));

export function clientById(id: string | null | undefined): Client | null {
  if (!id) return null;
  return CLIENT_INDEX.get(id) ?? null;
}

/** Display name for an id, safe on a deleted or unmatched reference. */
export function clientName(id: string | null | undefined): string {
  return clientById(id)?.name ?? 'Unassigned';
}

export function sessionById(id: string): TrainingSession | null {
  return SESSIONS.find((s) => s.id === id) ?? null;
}

/** Every session an athlete appeared in, newest first. */
export function sessionsForClient(clientId: string): TrainingSession[] {
  return SESSIONS.filter((s) => s.athleteIds.includes(clientId));
}

/** Every payment attributed to an athlete, oldest first. */
export function paymentsForClient(clientId: string): Payment[] {
  return PAYMENTS.filter((p) => p.clientId === clientId);
}

/** Sessions on a given civil date, earliest first. */
export function sessionsOnDate(date: IsoDate): TrainingSession[] {
  return SESSIONS.filter((s) => s.start.slice(0, 10) === date).sort((a, b) =>
    a.start < b.start ? -1 : 1,
  );
}

/** Calendar events overlapping `[from, to]` inclusive, by date. */
export function eventsInRange(from: IsoDate, to: IsoDate): CalendarEvent[] {
  return CALENDAR_EVENTS.filter((e) => {
    const d = e.start.slice(0, 10);
    return d >= from && d <= to;
  });
}

/** The anchor day's schedule — what the dashboard opens on. */
export function todaysSessions(): TrainingSession[] {
  return sessionsOnDate(ANCHOR_DATE);
}

/** The seven days starting at the anchor. */
export function upcomingWeek(): CalendarEvent[] {
  return eventsInRange(ANCHOR_DATE, addDays(ANCHOR_DATE, 6));
}

export function productByHandle(handle: string): Product | null {
  return PRODUCTS.find((p) => p.handle === handle) ?? null;
}
