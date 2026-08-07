/**
 * ============================================================================
 * JV GOLD — JESSE'S CONTROLLED VOCABULARY
 * ============================================================================
 *
 * The dropdown lists out of the `Lists` sheet of
 * `SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm`, lifted into typed constants so
 * that every form, filter, chart legend and import in the private hub speaks
 * exactly the words Jesse already uses.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES THIS FILE OBEYS
 * ---------------------------------------------------------------------------
 *
 * 1. HIS LABEL IS VERBATIM.
 *    `label` is the string as it appears in his workbook, character for
 *    character, including the `/` in "Camp/Clinic" and the "&" in
 *    "Strength & Conditioning". Render `label`. Never re-word it.
 *
 * 2. THE MACHINE ID IS STABLE.
 *    `id` is a kebab-case slug that never changes, even if he renames a label.
 *    Ids are what go into URLs, filter state and the generated history file.
 *
 * 3. NOTHING REAL IS DISCARDED.
 *    His actual entries have already drifted off his own dropdowns, because
 *    several of those columns were free text. `STRENGTH`, `DRILL`,
 *    `TOURNAMENT`, `1-on-1 w Grey Oshiro (partner)`, `CASH`, `-`. The
 *    `*_ALIASES` maps below fold the case variants onto the canonical id. Where
 *    a real value had no honest home, a NEW canonical entry was added and
 *    flagged `invented: true` — it is never dropped and never silently
 *    rewritten into a neighbouring category.
 *
 * 4. MONEY IS INTEGER CENTS, DURATIONS ARE WHOLE MINUTES.
 *    `defaultAmountCents` is cents (`20000` === $200) so a picked package can
 *    prefill a form without ever touching a float. Where no rate is published,
 *    the field is `null` — an unknown price is not a free one.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE DEFAULTS COME FROM
 * ---------------------------------------------------------------------------
 * `defaultAmountCents` / `defaultDurationMins` are taken from Jesse's own
 * published rate card in `~/lib/offerings` (private $200/60min, partner $200
 * total/60min, dedicated workout $150/90min, monthly package from $1,400, camp
 * $1,500/day). They are FORM PREFILLS, not history. Nothing in
 * `~/lib/ops/history` is priced from them.
 */

import type {OfferingId} from '~/lib/offerings';
import type {
  ClientStatus,
  PaymentCategory,
  PaymentMethod,
  RevenueSource,
  SessionKind,
} from './types';

/* ==========================================================================
 * 0. SHARED SHAPES
 * ======================================================================== */

/** Every vocabulary entry carries at least these three. */
interface VocabularyEntry {
  /** Stable kebab-case machine id. Safe in URLs and in generated data. */
  readonly id: string;
  /** Jesse's exact string from the workbook. Render this. */
  readonly label: string;
  /** One short line of guidance for the picker. `''` when none is needed. */
  readonly hint: string;
  /**
   * `true` when this entry is NOT on his `Lists` sheet and was added here to
   * hold a real value found in his data (or on his Dashboard). Surface these
   * in the vocabulary admin screen so he can confirm or rename them.
   */
  readonly invented: boolean;
}

/* ==========================================================================
 * 1. PACKAGE TYPE
 * `Lists` → Package Type. All nine are his.
 * ======================================================================== */

interface PackageTypeDef extends VocabularyEntry {
  /** Sessions the package banks. `null` when it is not session-counted. */
  readonly defaultSessions: number | null;
  /** Prefill price in CENTS. `null` when no rate is published for it. */
  readonly defaultAmountCents: number | null;
  /** Prefill session length in minutes. `null` when it varies. */
  readonly defaultDurationMins: number | null;
  /** The public offering this sells, when the mapping is unambiguous. */
  readonly offeringId: OfferingId | null;
  /** Which bucket a payment against this package falls into. */
  readonly paymentCategory: PaymentCategory;
}

export const PACKAGE_TYPES = [
  {
    id: 'single-session',
    label: 'Single Session',
    hint: 'One session, paid as it happens. The format is set by Training Type.',
    defaultSessions: 1,
    defaultAmountCents: 20000,
    defaultDurationMins: 60,
    offeringId: 'private',
    paymentCategory: 'private',
    invented: false,
  },
  {
    id: '12-session-package',
    label: '12-Session Package',
    hint: 'Twelve banked sessions. No published bulk rate — set it per family.',
    defaultSessions: 12,
    defaultAmountCents: null,
    defaultDurationMins: 60,
    offeringId: 'package',
    paymentCategory: 'package',
    invented: false,
  },
  {
    id: '20-session-package',
    label: '20-Session Package',
    hint: 'Twenty banked sessions. No published bulk rate — set it per family.',
    defaultSessions: 20,
    defaultAmountCents: null,
    defaultDurationMins: 60,
    offeringId: 'package',
    paymentCategory: 'package',
    invented: false,
  },
  {
    id: 'monthly-membership',
    label: 'Monthly Membership',
    hint: 'Standing weekly days, billed monthly. Prefills the two-day tier.',
    defaultSessions: null,
    defaultAmountCents: 140000,
    defaultDurationMins: 60,
    offeringId: 'package',
    paymentCategory: 'package',
    invented: false,
  },
  {
    id: 'group-package',
    label: 'Group Package',
    hint: 'A block bought by a group. Rate is negotiated per group.',
    defaultSessions: null,
    defaultAmountCents: null,
    defaultDurationMins: 90,
    offeringId: null,
    paymentCategory: 'package',
    invented: false,
  },
  {
    id: 'strength-package',
    label: 'Strength Package',
    hint: 'Conditioning block. Prefills the Dedicated Workout rate.',
    defaultSessions: null,
    defaultAmountCents: 15000,
    defaultDurationMins: 90,
    offeringId: 'workout',
    paymentCategory: 'workout',
    invented: false,
  },
  {
    id: 'team-rate',
    label: 'Team Rate',
    hint: 'A school or club buying the room. Quoted per team.',
    defaultSessions: null,
    defaultAmountCents: null,
    defaultDurationMins: 120,
    offeringId: null,
    paymentCategory: 'other',
    invented: false,
  },
  {
    id: 'camp-clinic',
    label: 'Camp/Clinic',
    hint: 'Hosted day or clinic. Prefills the $1,500 day rate.',
    defaultSessions: null,
    defaultAmountCents: 150000,
    defaultDurationMins: null,
    offeringId: 'camp',
    paymentCategory: 'camp',
    invented: false,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Anything that does not fit. Write what it was in the notes.',
    defaultSessions: null,
    defaultAmountCents: null,
    defaultDurationMins: null,
    offeringId: null,
    paymentCategory: 'other',
    invented: false,
  },
] as const satisfies readonly PackageTypeDef[];

export type PackageType = (typeof PACKAGE_TYPES)[number];
export type PackageTypeId = PackageType['id'];

/* ==========================================================================
 * 2. PAYMENT METHOD
 * `Lists` → Payment Method. All eight are his.
 *
 * NOTE: `~/lib/ops/types` ships a narrower `PaymentMethod` union that predates
 * this file and has no member for Apple Pay or Cash App. `domainMethod` is the
 * lossy projection onto that union; `id`/`label` stay exact. When the domain
 * union is widened, only `domainMethod` changes.
 * ======================================================================== */

interface PaymentMethodDef extends VocabularyEntry {
  /** Projection onto the `PaymentMethod` union in `./types`. */
  readonly domainMethod: PaymentMethod;
  /** Which revenue-by-source slice this lands in. */
  readonly revenueSource: RevenueSource;
  /** `true` when the money is in hand instantly and carries no processor fee. */
  readonly instant: boolean;
  /**
   * `true` when `domainMethod` had to collapse this onto a broader member of
   * the legacy union. Those rows lose fidelity in `TrainingSession.method` and
   * `Payment.method` — read `id` instead when precision matters.
   */
  readonly lossyDomainMapping: boolean;
}

export const PAYMENT_METHODS = [
  {
    id: 'cash',
    label: 'Cash',
    hint: 'In hand. Still the most common line in the book.',
    domainMethod: 'Cash',
    revenueSource: 'cash',
    instant: true,
    lossyDomainMapping: false,
    invented: false,
  },
  {
    id: 'zelle',
    label: 'Zelle',
    hint: 'Bank to bank, no fee.',
    domainMethod: 'Zelle',
    revenueSource: 'zelle',
    instant: true,
    lossyDomainMapping: false,
    invented: false,
  },
  {
    id: 'venmo',
    label: 'Venmo',
    hint: '',
    domainMethod: 'Venmo',
    revenueSource: 'venmo',
    instant: true,
    lossyDomainMapping: false,
    invented: false,
  },
  {
    id: 'apple-pay',
    label: 'Apple Pay',
    hint: 'Recorded as "Other" in the legacy session/payment records.',
    domainMethod: 'Other',
    revenueSource: 'other',
    instant: true,
    lossyDomainMapping: true,
    invented: false,
  },
  {
    id: 'cash-app',
    label: 'Cash App',
    hint: 'Recorded as "Other" in the legacy session/payment records.',
    domainMethod: 'Other',
    revenueSource: 'other',
    instant: true,
    lossyDomainMapping: true,
    invented: false,
  },
  {
    id: 'check',
    label: 'Check',
    hint: 'Not money until it clears.',
    domainMethod: 'Check',
    revenueSource: 'check',
    instant: false,
    lossyDomainMapping: false,
    invented: false,
  },
  {
    id: 'card',
    label: 'Card',
    hint: 'Carries a processor fee — record it on the payment.',
    domainMethod: 'Card',
    revenueSource: 'other',
    instant: false,
    lossyDomainMapping: false,
    invented: false,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Say what it was in the notes.',
    domainMethod: 'Other',
    revenueSource: 'other',
    instant: false,
    lossyDomainMapping: false,
    invented: false,
  },
] as const satisfies readonly PaymentMethodDef[];

export type PaymentMethodOption = (typeof PAYMENT_METHODS)[number];
export type PaymentMethodId = PaymentMethodOption['id'];

/* ==========================================================================
 * 3. TRAINING TYPE
 * `Lists` → Training Type gives the first EIGHT. The last THREE are invented
 * (`invented: true`) to hold values that are already in his data:
 *
 *   'DRILL'                          → `drill`
 *   'TOURNAMENT'                     → `tournament`
 *   '1-on-1 w Grey Oshiro (partner)' → `partner`
 *
 * Each was given its own entry rather than being folded into a neighbour,
 * because none of the eight is honestly the same thing: a drilling block is not
 * a "Small Group", a day spent cornering at a tournament is not "Team
 * Training", and a two-athlete session is priced differently from a 1-on-1.
 * ======================================================================== */

interface TrainingTypeDef extends VocabularyEntry {
  /** Prefill length in minutes. */
  readonly defaultDurationMins: number;
  /** Prefill price in CENTS. `null` when the rate depends on headcount. */
  readonly defaultAmountCents: number | null;
  /** Projection onto the `SessionKind` union in `./types`. */
  readonly sessionKind: SessionKind;
  /** The public offering this corresponds to, when unambiguous. */
  readonly offeringId: OfferingId | null;
  /** Typical athletes on the mat. `null` when it is open-ended. */
  readonly typicalAthletes: number | null;
}

export const TRAINING_TYPES = [
  {
    id: '1-on-1',
    label: '1-on-1',
    hint: 'One athlete, undivided attention.',
    defaultDurationMins: 60,
    defaultAmountCents: 20000,
    sessionKind: 'private',
    offeringId: 'private',
    typicalAthletes: 1,
    invented: false,
  },
  {
    id: 'small-group',
    label: 'Small Group',
    hint: 'Three to six athletes he picked to train together.',
    defaultDurationMins: 90,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: 4,
    invented: false,
  },
  {
    id: 'group-session',
    label: 'Group Session',
    hint: 'Open group. Headcount varies night to night.',
    defaultDurationMins: 90,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: null,
    invented: false,
  },
  {
    id: 'strength-conditioning',
    label: 'Strength & Conditioning',
    hint: 'Lift or motor work. Prefills the Dedicated Workout rate.',
    defaultDurationMins: 90,
    defaultAmountCents: 15000,
    sessionKind: 'workout',
    offeringId: 'workout',
    typicalAthletes: null,
    invented: false,
  },
  {
    id: 'club-practice',
    label: 'Club Practice',
    hint: 'A Deep Waters room practice, not a sold private.',
    defaultDurationMins: 120,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: null,
    invented: false,
  },
  {
    id: 'team-training',
    label: 'Team Training',
    hint: 'A school or club team he was brought in to run.',
    defaultDurationMins: 120,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: null,
    invented: false,
  },
  {
    id: 'camp-clinic',
    label: 'Camp/Clinic',
    hint: 'A hosted camp day or clinic block.',
    defaultDurationMins: 240,
    defaultAmountCents: 150000,
    sessionKind: 'camp',
    offeringId: 'camp',
    typicalAthletes: null,
    invented: false,
  },
  {
    id: 'consultation',
    label: 'Consultation',
    hint: 'Talking, planning, film. No mat time billed.',
    defaultDurationMins: 30,
    defaultAmountCents: null,
    sessionKind: 'private',
    offeringId: null,
    typicalAthletes: 1,
    invented: false,
  },
  {
    id: 'partner',
    label: 'Partner Session',
    hint: 'Two athletes, one booking. Added for "1-on-1 w … (partner)" rows.',
    defaultDurationMins: 60,
    defaultAmountCents: 20000,
    sessionKind: 'partner',
    offeringId: 'partner',
    typicalAthletes: 2,
    invented: true,
  },
  {
    id: 'drill',
    label: 'Drill',
    hint: 'A drilling block, usually attached to a club practice.',
    defaultDurationMins: 60,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: null,
    invented: true,
  },
  {
    id: 'tournament',
    label: 'Tournament',
    hint: 'Cornering at an event. Coaching time, not mat instruction.',
    defaultDurationMins: 240,
    defaultAmountCents: null,
    sessionKind: 'group',
    offeringId: null,
    typicalAthletes: null,
    invented: true,
  },
] as const satisfies readonly TrainingTypeDef[];

export type TrainingType = (typeof TRAINING_TYPES)[number];
export type TrainingTypeId = TrainingType['id'];

/* ==========================================================================
 * 4. INCOME STREAM
 * `Lists` → Income Stream gives the first THREE. His Dashboard reports two
 * MORE that never made it onto the Lists sheet — they are here, flagged
 * `invented: true`, because his own May figures depend on them:
 *
 *   'CBU SCHOLARSHIP STIPEND'    → `cbu-scholarship-stipend`
 *   'MERCH / DEEP WATERS SINGLETS' → `merch-deep-waters-singlets`
 * ======================================================================== */

interface IncomeStreamDef extends VocabularyEntry {
  /** Which payment bucket money on this stream usually lands in. */
  readonly paymentCategory: PaymentCategory;
  /** `true` when the money is coaching income rather than product or stipend. */
  readonly isCoaching: boolean;
}

export const INCOME_STREAMS = [
  {
    id: 'personal-training',
    label: 'Personal Training',
    hint: 'Privates, small groups and packages sold under JV Gold.',
    paymentCategory: 'private',
    isCoaching: true,
    invented: false,
  },
  {
    id: 'deep-waters',
    label: 'Deep Waters Wrestling Club',
    hint: 'Club dues and club-side coaching.',
    paymentCategory: 'other',
    isCoaching: true,
    invented: false,
  },
  {
    id: 'future-champions',
    label: 'Future Champions / Camps',
    hint: 'Camp days, clinics and Champ Club work.',
    paymentCategory: 'camp',
    isCoaching: true,
    invented: false,
  },
  {
    id: 'cbu-scholarship-stipend',
    label: 'CBU SCHOLARSHIP STIPEND',
    hint: 'On his Dashboard, never on the Lists sheet. Not coaching revenue.',
    paymentCategory: 'other',
    isCoaching: false,
    invented: true,
  },
  {
    id: 'merch-deep-waters-singlets',
    label: 'MERCH / DEEP WATERS SINGLETS',
    hint: 'On his Dashboard, never on the Lists sheet. Product, not mat time.',
    paymentCategory: 'merch',
    isCoaching: false,
    invented: true,
  },
] as const satisfies readonly IncomeStreamDef[];

export type IncomeStream = (typeof INCOME_STREAMS)[number];
export type IncomeStreamId = IncomeStream['id'];

/* ==========================================================================
 * 5. EXPENSE CATEGORY
 * `Lists` → Expense Category. All eleven are his.
 * ======================================================================== */

interface ExpenseCategoryDef extends VocabularyEntry {
  /** `true` when the cost scales with sessions run rather than sitting fixed. */
  readonly isVariable: boolean;
  /** `true` when it is normally deductible and wants a receipt attached. */
  readonly needsReceipt: boolean;
}

export const EXPENSE_CATEGORIES = [
  {
    id: 'coach-pay',
    label: 'Coach Pay',
    hint: 'Paid out to assistant coaches. His largest single line.',
    isVariable: true,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'facility-rent',
    label: 'Facility Rent',
    hint: 'Mat time bought from a room.',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'equipment',
    label: 'Equipment',
    hint: 'Mats, bands, weights, headgear.',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    hint: '',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'travel',
    label: 'Travel',
    hint: 'Mileage, flights, lodging for camps and events.',
    isVariable: true,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'food-drinks',
    label: 'Food/Drinks',
    hint: '',
    isVariable: true,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'merchandise',
    label: 'Merchandise',
    hint: 'Cost of goods on singlets and apparel.',
    isVariable: true,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'tournament-fees',
    label: 'Tournament Fees',
    hint: 'Entries and coach passes.',
    isVariable: true,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'software',
    label: 'Software',
    hint: '',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    hint: '',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Say what it was in the notes.',
    isVariable: false,
    needsReceipt: true,
    invented: false,
  },
] as const satisfies readonly ExpenseCategoryDef[];

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseCategoryId = ExpenseCategory['id'];

/* ==========================================================================
 * 6. CLIENT STATUS
 * `Lists` → Client Status. All five are his, and they already match the
 * `ClientStatus` union in `./types` (and Supabase `athletes.status`) exactly.
 * ======================================================================== */

interface ClientStatusDef extends VocabularyEntry {
  /** The `ClientStatus` union member in `./types`. Same string as `label`. */
  readonly domainStatus: ClientStatus;
  /** `true` when the athlete counts toward "active clients". */
  readonly countsAsActive: boolean;
  /** `true` when the athlete belongs on the money-chasing list. */
  readonly isReceivable: boolean;
  /** Dot colour token for the roster. Never gold — gold is a fill, not ink. */
  readonly tone: 'positive' | 'neutral' | 'warning' | 'muted';
}

export const CLIENT_STATUSES = [
  {
    id: 'active',
    label: 'Active',
    hint: 'Training and current on money.',
    domainStatus: 'Active',
    countsAsActive: true,
    isReceivable: false,
    tone: 'positive',
    invented: false,
  },
  {
    id: 'trial',
    label: 'Trial',
    hint: 'First sessions, not yet committed to a package.',
    domainStatus: 'Trial',
    countsAsActive: true,
    isReceivable: false,
    tone: 'neutral',
    invented: false,
  },
  {
    id: 'paid-in-full',
    label: 'Paid In Full',
    hint: 'Package bought outright, sessions banked.',
    domainStatus: 'Paid In Full',
    countsAsActive: true,
    isReceivable: false,
    tone: 'positive',
    invented: false,
  },
  {
    id: 'owes-balance',
    label: 'Owes Balance',
    hint: 'Training against an unpaid balance. Drives the AR list.',
    domainStatus: 'Owes Balance',
    countsAsActive: true,
    isReceivable: true,
    tone: 'warning',
    invented: false,
  },
  {
    id: 'inactive',
    label: 'Inactive',
    hint: 'Off the mat. Kept for history and win-back.',
    domainStatus: 'Inactive',
    countsAsActive: false,
    isReceivable: false,
    tone: 'muted',
    invented: false,
  },
] as const satisfies readonly ClientStatusDef[];

export type ClientStatusOption = (typeof CLIENT_STATUSES)[number];
export type ClientStatusId = ClientStatusOption['id'];

/* ==========================================================================
 * 7. ALIASES — the drift, folded back in
 *
 * Keys are the raw workbook strings, NORMALISED: trimmed, collapsed inner
 * whitespace, lower-cased. Look up with `normalizeVocabKey()`, never with the
 * raw string. A key mapping to `null` is a deliberate "this cell records
 * nothing" — `-` and `n/a` are NOT the same as a zero or a default.
 *
 * Canonical labels and ids are pre-seeded into every map, so
 * `resolve*(x).id` works for a canonical value and a drifted one alike.
 * ======================================================================== */

/** Trim, collapse inner whitespace, lower-case. The only key function. */
export function normalizeVocabKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Strings that mean "nothing was recorded here". Not zero, not a default. */
export const BLANK_TOKENS: readonly string[] = [
  '',
  '-',
  '--',
  '—',
  'n/a',
  'na',
  'none',
  'tbd',
  '?',
];

/** `true` when a cell holds no information at all. */
export function isBlankToken(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return true;
  return BLANK_TOKENS.includes(normalizeVocabKey(raw));
}

type AliasMap<T extends string> = Readonly<Record<string, T | null>>;

function buildAliases<T extends string>(
  canonical: readonly {readonly id: T; readonly label: string}[],
  extra: Readonly<Record<string, T | null>>,
): AliasMap<T> {
  const out: Record<string, T | null> = {};
  for (const entry of canonical) {
    out[normalizeVocabKey(entry.id)] = entry.id;
    out[normalizeVocabKey(entry.label)] = entry.id;
  }
  for (const token of BLANK_TOKENS) out[token] = null;
  for (const [key, value] of Object.entries(extra)) {
    out[normalizeVocabKey(key)] = value;
  }
  return out;
}

export const PACKAGE_TYPE_ALIASES: AliasMap<PackageTypeId> = buildAliases(
  PACKAGE_TYPES,
  {
    'single': 'single-session',
    'single sesion': 'single-session',
    '1 session': 'single-session',
    'one session': 'single-session',
    '12 session package': '12-session-package',
    '12-session': '12-session-package',
    '20 session package': '20-session-package',
    '20-session': '20-session-package',
    'monthly': 'monthly-membership',
    'membership': 'monthly-membership',
    'strength': 'strength-package',
    'camp': 'camp-clinic',
    'clinic': 'camp-clinic',
    'camp / clinic': 'camp-clinic',
    'team': 'team-rate',
  },
);

export const PAYMENT_METHOD_ALIASES: AliasMap<PaymentMethodId> = buildAliases(
  PAYMENT_METHODS,
  {
    // 'CASH' and 'Cash' are the same money. Case is not a category.
    'cash ': 'cash',
    'cash (in hand)': 'cash',
    'zell': 'zelle',
    'apple': 'apple-pay',
    'applepay': 'apple-pay',
    'cashapp': 'cash-app',
    'cash app ': 'cash-app',
    'credit': 'card',
    'credit card': 'card',
    'debit': 'card',
    'cheque': 'check',
  },
);

export const TRAINING_TYPE_ALIASES: AliasMap<TrainingTypeId> = buildAliases(
  TRAINING_TYPES,
  {
    // Case-only drift.
    'strength': 'strength-conditioning',
    'strength and conditioning': 'strength-conditioning',
    's&c': 'strength-conditioning',
    'lift': 'strength-conditioning',
    // Real values with no home on his Lists sheet → new canonical entries.
    'drill': 'drill',
    'drilling': 'drill',
    'tournament': 'tournament',
    'tourney': 'tournament',
    'comp': 'tournament',
    // Free-text partner sessions. The partner's name lives in the raw string,
    // which the importer preserves verbatim on the row.
    '1-on-1 w grey oshiro (partner)': 'partner',
    '1 on 1': '1-on-1',
    '1on1': '1-on-1',
    'private': '1-on-1',
    'partner session': 'partner',
    'group': 'group-session',
    'open mat': 'group-session',
    'practice': 'club-practice',
    'club': 'club-practice',
    'camp': 'camp-clinic',
    'clinic': 'camp-clinic',
    'consult': 'consultation',
  },
);

export const INCOME_STREAM_ALIASES: AliasMap<IncomeStreamId> = buildAliases(
  INCOME_STREAMS,
  {
    'personal training': 'personal-training',
    'pt': 'personal-training',
    'deep waters': 'deep-waters',
    'deep waters rtc': 'deep-waters',
    'dw': 'deep-waters',
    'future champions': 'future-champions',
    'future champions / camps': 'future-champions',
    'champ club': 'future-champions',
    'camps': 'future-champions',
    'cbu': 'cbu-scholarship-stipend',
    'cbu stipend': 'cbu-scholarship-stipend',
    'cbu scholarship stipend': 'cbu-scholarship-stipend',
    'merch': 'merch-deep-waters-singlets',
    'singlets': 'merch-deep-waters-singlets',
    'merch / deep waters singlets': 'merch-deep-waters-singlets',
  },
);

export const EXPENSE_CATEGORY_ALIASES: AliasMap<ExpenseCategoryId> =
  buildAliases(EXPENSE_CATEGORIES, {
    'coach': 'coach-pay',
    'coaches': 'coach-pay',
    'payroll': 'coach-pay',
    'rent': 'facility-rent',
    'facility': 'facility-rent',
    'gear': 'equipment',
    'food': 'food-drinks',
    'drinks': 'food-drinks',
    'food / drinks': 'food-drinks',
    'merch': 'merchandise',
    'entry fees': 'tournament-fees',
    'tournament': 'tournament-fees',
    'saas': 'software',
    'subscriptions': 'software',
  });

export const CLIENT_STATUS_ALIASES: AliasMap<ClientStatusId> = buildAliases(
  CLIENT_STATUSES,
  {
    'paid in full': 'paid-in-full',
    'pif': 'paid-in-full',
    'owes': 'owes-balance',
    'owes balance': 'owes-balance',
    'balance': 'owes-balance',
    'past due': 'owes-balance',
    'new': 'trial',
    'trialing': 'trial',
    'churned': 'inactive',
    'former': 'inactive',
  },
);

/**
 * Every alias map in one object, keyed by the vocabulary it belongs to. Handy
 * for the vocabulary admin screen; prefer the typed `resolve*` helpers in code.
 */
export const ALIASES = {
  packageType: PACKAGE_TYPE_ALIASES,
  paymentMethod: PAYMENT_METHOD_ALIASES,
  trainingType: TRAINING_TYPE_ALIASES,
  incomeStream: INCOME_STREAM_ALIASES,
  expenseCategory: EXPENSE_CATEGORY_ALIASES,
  clientStatus: CLIENT_STATUS_ALIASES,
} as const;

export type VocabularyName = keyof typeof ALIASES;

/* ==========================================================================
 * 8. RESOLVERS
 *
 * Every resolver returns the same envelope so an importer can count outcomes
 * without special-casing each vocabulary:
 *
 *   'exact'   — the cell already held a canonical label or id.
 *   'alias'   — a known variant; folded onto the canonical id.
 *   'blank'   — the cell recorded nothing. `id` is null. NOT a default.
 *   'unknown' — a real value nobody has mapped. `id` is null, `raw` is kept.
 *               Surface these; never drop the row and never guess.
 * ======================================================================== */

export type ResolutionMatch = 'exact' | 'alias' | 'blank' | 'unknown';

export interface Resolution<T extends string> {
  /** Canonical id, or `null` for a blank or unmapped cell. */
  id: T | null;
  /** The raw cell contents, verbatim, always. */
  raw: string;
  match: ResolutionMatch;
}

function resolveWith<T extends string>(
  map: AliasMap<T>,
  canonicalLabels: ReadonlySet<string>,
  raw: string | null | undefined,
): Resolution<T> {
  const original = raw ?? '';
  const key = normalizeVocabKey(original);
  if (isBlankToken(original)) return {id: null, raw: original, match: 'blank'};
  if (!(key in map)) return {id: null, raw: original, match: 'unknown'};
  const id = map[key];
  if (id === null) return {id: null, raw: original, match: 'blank'};
  return {
    id,
    raw: original,
    match: canonicalLabels.has(key) ? 'exact' : 'alias',
  };
}

const labelSet = (
  entries: readonly {readonly id: string; readonly label: string}[],
): ReadonlySet<string> =>
  new Set(
    entries.flatMap((e) => [normalizeVocabKey(e.id), normalizeVocabKey(e.label)]),
  );

const PACKAGE_LABELS = labelSet(PACKAGE_TYPES);
const PAYMENT_LABELS = labelSet(PAYMENT_METHODS);
const TRAINING_LABELS = labelSet(TRAINING_TYPES);
const INCOME_LABELS = labelSet(INCOME_STREAMS);
const EXPENSE_LABELS = labelSet(EXPENSE_CATEGORIES);
const STATUS_LABELS = labelSet(CLIENT_STATUSES);

export const resolvePackageType = (raw: string | null | undefined) =>
  resolveWith(PACKAGE_TYPE_ALIASES, PACKAGE_LABELS, raw);

export const resolvePaymentMethod = (raw: string | null | undefined) =>
  resolveWith(PAYMENT_METHOD_ALIASES, PAYMENT_LABELS, raw);

export const resolveTrainingType = (raw: string | null | undefined) =>
  resolveWith(TRAINING_TYPE_ALIASES, TRAINING_LABELS, raw);

export const resolveIncomeStream = (raw: string | null | undefined) =>
  resolveWith(INCOME_STREAM_ALIASES, INCOME_LABELS, raw);

export const resolveExpenseCategory = (raw: string | null | undefined) =>
  resolveWith(EXPENSE_CATEGORY_ALIASES, EXPENSE_LABELS, raw);

export const resolveClientStatus = (raw: string | null | undefined) =>
  resolveWith(CLIENT_STATUS_ALIASES, STATUS_LABELS, raw);

/* ==========================================================================
 * 9. LOOKUPS
 * ======================================================================== */

function indexBy<T extends {readonly id: string}>(
  entries: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(entries.map((e) => [e.id, e]));
}

const PACKAGE_BY_ID = indexBy(PACKAGE_TYPES);
const PAYMENT_BY_ID = indexBy(PAYMENT_METHODS);
const TRAINING_BY_ID = indexBy(TRAINING_TYPES);
const INCOME_BY_ID = indexBy(INCOME_STREAMS);
const EXPENSE_BY_ID = indexBy(EXPENSE_CATEGORIES);
const STATUS_BY_ID = indexBy(CLIENT_STATUSES);

export const getPackageType = (id: PackageTypeId | null): PackageType | null =>
  id ? (PACKAGE_BY_ID.get(id) ?? null) : null;

export const getPaymentMethod = (
  id: PaymentMethodId | null,
): PaymentMethodOption | null => (id ? (PAYMENT_BY_ID.get(id) ?? null) : null);

export const getTrainingType = (
  id: TrainingTypeId | null,
): TrainingType | null => (id ? (TRAINING_BY_ID.get(id) ?? null) : null);

export const getIncomeStream = (
  id: IncomeStreamId | null,
): IncomeStream | null => (id ? (INCOME_BY_ID.get(id) ?? null) : null);

export const getExpenseCategory = (
  id: ExpenseCategoryId | null,
): ExpenseCategory | null => (id ? (EXPENSE_BY_ID.get(id) ?? null) : null);

export const getClientStatus = (
  id: ClientStatusId | null,
): ClientStatusOption | null => (id ? (STATUS_BY_ID.get(id) ?? null) : null);

/**
 * His label for an id, or the raw string when nothing resolved. Use this
 * everywhere a vocabulary value is rendered so an unmapped historical value
 * still prints as he typed it rather than disappearing.
 */
export function labelFor<T extends string>(
  entries: readonly {readonly id: string; readonly label: string}[],
  resolution: Resolution<T>,
): string {
  if (resolution.id) {
    const hit = entries.find((e) => e.id === resolution.id);
    if (hit) return hit.label;
  }
  return resolution.raw;
}

/** Everything added here that is not on his `Lists` sheet, for the admin UI. */
export const INVENTED_VOCABULARY: readonly {
  vocabulary: VocabularyName;
  id: string;
  label: string;
  reason: string;
}[] = [
  {
    vocabulary: 'trainingType',
    id: 'partner',
    label: 'Partner Session',
    reason:
      'His book contains "1-on-1 w Grey Oshiro (partner)". A two-athlete session is not a 1-on-1 and is priced as a shared rate.',
  },
  {
    vocabulary: 'trainingType',
    id: 'drill',
    label: 'Drill',
    reason:
      'His book contains "DRILL". A drilling block is not a "Small Group" and not "Club Practice".',
  },
  {
    vocabulary: 'trainingType',
    id: 'tournament',
    label: 'Tournament',
    reason:
      'His book contains "TOURNAMENT". Cornering at an event is coaching time, not mat instruction.',
  },
  {
    vocabulary: 'incomeStream',
    id: 'cbu-scholarship-stipend',
    label: 'CBU SCHOLARSHIP STIPEND',
    reason: 'On his Dashboard, missing from the Lists sheet.',
  },
  {
    vocabulary: 'incomeStream',
    id: 'merch-deep-waters-singlets',
    label: 'MERCH / DEEP WATERS SINGLETS',
    reason: 'On his Dashboard, missing from the Lists sheet.',
  },
];
