/**
 * ============================================================================
 * SESSION MODEL — the shape of one logged session, and the single write seam
 * ============================================================================
 *
 * Jesse's book has one row per session with these columns: Date, Package Type,
 * Training Type, Sessions Used, Amount Paid, Payment Method, Amount Owed,
 * Notes. This file is that row, typed, plus the pure functions that move it
 * between his vocabulary (`~/lib/ops/vocabulary`), the calendar's
 * `CalendarEvent`, and the form.
 *
 * ---------------------------------------------------------------------------
 * WHY SO FEW STRINGS
 * ---------------------------------------------------------------------------
 * Every free-text column in the workbook has already fractured: 'STRENGTH' vs
 * 'Strength & Conditioning', 'DRILL', 'TOURNAMENT', '1-on-1 w Grey Oshiro
 * (partner)', 'CASH' vs 'Cash' vs '-'. So the draft below holds IDS, not
 * prose. The only `string` a coach can type into is `notes`, and even that has
 * a chip row in front of it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NEVER REWRITTEN
 * ---------------------------------------------------------------------------
 * `rawTrainingType` / `rawPackageType` / `rawPaymentMethod` carry his exact
 * cell contents through every edit. When a canonical id was reached by an
 * alias, the form prints the raw underneath the chips — the history is shown,
 * never silently corrected.
 *
 * ---------------------------------------------------------------------------
 * MONEY AND TIME
 * ---------------------------------------------------------------------------
 * Money is integer cents. Dates are civil strings; `startMinutes` is minutes
 * past local midnight, and `null` means HE NEVER RECORDED A TIME — which is
 * true of 27 of the 45 rows in his book. `null` renders as "time not recorded"
 * and never as "12:00 AM". Nothing here constructs a `Date`.
 */

import type {
  CalendarEvent,
  IsoDate,
  IsoDateTime,
  SessionKind,
} from '~/lib/ops/types';
import {addDays, weekdayOfIso} from '~/lib/ops/types';
import type {
  BookedSession,
  BusyBlock,
  SlotDecision,
} from '~/lib/ops/availability';
import {checkSlot, createAvailabilityContext} from '~/lib/ops/availability';
import type {
  IncomeStreamId,
  PackageTypeId,
  PaymentMethodId,
  TrainingTypeId,
} from '~/lib/ops/vocabulary';
import {
  getIncomeStream,
  getPackageType,
  getPaymentMethod,
  getTrainingType,
} from '~/lib/ops/vocabulary';
import {MONTH_SHORT, WEEKDAY_SHORT, formatMinutes, toDateTime} from './layout';

/* ==========================================================================
 * 1. THE ROW
 * ======================================================================== */

/* --------------------------------------------------------------------------
 * SETTLEMENT — how the lesson was paid for
 *
 * The five ways money can (or cannot) move against a logged lesson. This is a
 * SEPARATE axis from `paymentMethodId`: the method says "Zelle", the settlement
 * says "the money is already in his account and Shopify was never involved".
 * Two of the five record no money at all and they do not mean the same thing —
 * a prepaid draw spends something the family already bought, a comp spends
 * nothing and is a gift. Neither is "unpaid".
 * ------------------------------------------------------------------------ */

export type SettlementId =
  | 'outside'
  | 'invoice'
  | 'card'
  | 'prepaid'
  | 'comped';

export interface SettlementOption {
  readonly id: SettlementId;
  readonly label: string;
  /** The one line printed under the chip. States the CONSEQUENCE, not the name. */
  readonly consequence: string;
}

export const SETTLEMENTS: readonly SettlementOption[] = [
  {
    id: 'outside',
    label: 'Settled outside Shopify',
    consequence:
      'Records the amount against this lesson. No Shopify charge is created.',
  },
  {
    id: 'invoice',
    label: 'Send a payable invoice',
    consequence:
      'Creates a Shopify draft order for this client and emails them a payment link.',
  },
  {
    id: 'card',
    label: 'Charge a saved card',
    consequence:
      'Unavailable — no stored payment methods exist and the recurring-billing app is not installed.',
  },
  {
    id: 'prepaid',
    label: 'Use a prepaid session',
    consequence: 'Draws one session from their prepaid balance. Nothing is charged.',
  },
  {
    id: 'comped',
    label: 'No charge',
    consequence:
      'Records the lesson at $0 and marks it COMPED — which is not the same as unpaid.',
  },
] as const;

export const DEFAULT_SETTLEMENT: SettlementId = 'outside';

/**
 * Why a settlement cannot be chosen right now, or `null` when it can be.
 *
 * Returned as a sentence rather than a boolean, because a disabled control that
 * does not say why is indistinguishable from a broken one. `card` is disabled
 * unconditionally and permanently until two pieces of infrastructure exist;
 * `prepaid` is disabled per client and comes back the moment they buy a block.
 */
export function settlementBlockedReason(
  id: SettlementId,
  prepaidRemaining: number,
  hasClient: boolean,
): string | null {
  if (id === 'card') {
    return 'No stored payment methods exist on this store and the recurring-billing app is not installed. There is nothing to charge.';
  }
  if (id === 'prepaid') {
    if (!hasClient) return 'Choose the athlete first — the balance is theirs.';
    if (prepaidRemaining <= 0) {
      return 'No prepaid sessions left in their bank. Sell a package first.';
    }
  }
  return null;
}

/** One session as the form holds it. Ids everywhere; one free-text field. */
export interface SessionDraft {
  /** Calendar event id when editing an existing row. `null` when creating. */
  id: string | null;
  /** Roster id. Never a typed name — the picker cannot invent one. */
  clientId: string | null;
  trainingTypeId: TrainingTypeId | null;
  packageTypeId: PackageTypeId | null;
  paymentMethodId: PaymentMethodId | null;
  incomeStreamId: IncomeStreamId;
  /** How this lesson was settled. Drives which money controls are even shown. */
  settlement: SettlementId;
  /** His "Sessions Used" column. Stepper, default 1. */
  sessionsUsed: number;
  /** Integer cents. */
  paidCents: number;
  /** Integer cents. */
  owedCents: number;
  date: IsoDate;
  /** Minutes past midnight, or `null` for "time not recorded". */
  startMinutes: number | null;
  durationMinutes: number;
  /** The only free text on the form. */
  notes: string;

  /* --- provenance, carried through every edit, never rewritten --------- */
  rawTrainingType: string;
  rawPackageType: string;
  rawPaymentMethod: string;
}

/** Where a row currently lives. There is no server yet and the UI says so. */
export type SessionStorage = 'book' | 'device';

/**
 * The vocabulary a `CalendarEvent` has no columns for, kept alongside the
 * calendar by event id. Reading his book produces these; saving the form
 * replaces them.
 */
export interface SessionLog {
  clientId: string | null;
  trainingTypeId: TrainingTypeId | null;
  packageTypeId: PackageTypeId | null;
  paymentMethodId: PaymentMethodId | null;
  incomeStreamId: IncomeStreamId;
  settlement: SettlementId;
  sessionsUsed: number;
  paidCents: number;
  owedCents: number;
  /**
   * Billable length in whole minutes. Kept here rather than read back off the
   * block because an untimed row is stored as an all-day block, and an all-day
   * block cannot carry "90 minutes in the garage".
   */
  durationMinutes: number;
  /** `false` when his row carried no clock. Drives "time not recorded". */
  startRecorded: boolean;
  rawTrainingType: string;
  rawPackageType: string;
  rawPaymentMethod: string;
  storage: SessionStorage;
}

/** One person on his real roster. Behind auth; never on a public route. */
export interface RosterClient {
  id: string;
  name: string;
  /** Two letters for the picker tile. Precomputed so render stays cheap. */
  initials: string;
  /** His `Client Status` vocabulary value. */
  status: string;
  /** Club affiliation as his "Family" column records it, verbatim. */
  clubLabel: string | null;
  lastSessionAt: IsoDate | null;
  sessionCount: number;
  /** Sessions banked and not yet burned. 0 gates the prepaid settlement. */
  prepaidRemaining: number;
  /**
   * `null` until this athlete's payer has been matched to a Shopify customer.
   * Null is what makes "Send a payable invoice" impossible, and the form says
   * so and links to the client screen rather than failing at submit time.
   */
  shopifyCustomerId: string | null;
}

/** What choosing a client fills in, derived from that client's own history. */
export interface ClientPrefill {
  trainingTypeId: TrainingTypeId | null;
  packageTypeId: PackageTypeId | null;
  paymentMethodId: PaymentMethodId | null;
  incomeStreamId: IncomeStreamId;
  /** How their last logged lesson was settled. Usually how the next one is. */
  settlement: SettlementId;
  paidCents: number;
  durationMinutes: number;
  startMinutes: number | null;
  sessionsUsed: number;
  /** "Usually 1-on-1 · $200 · Zelle" — shown on the picker tile. */
  summary: string;
}

/** A tappable time on the slot row, built from `~/lib/offerings`. */
export interface SlotOption {
  id: string;
  label: string;
  minutes: number;
  band: string;
}

/** Everything the form needs that has to be derived from his history. */
export interface CalendarFormData {
  clients: RosterClient[];
  prefills: Record<string, ClientPrefill>;
  /** Recurring payment amounts, in cents, ascending. */
  amountChips: number[];
  slots: SlotOption[];
  bands: {id: string; label: string}[];
  /** Locations and contexts that actually occur in his notes. */
  noteChips: string[];
  durationChips: number[];
  /** Everything `checkSlot` needs to rule on a time. Built in the loader. */
  availability: AvailabilityData;
  /** True when the Admin API credentials for invoicing are actually present. */
  invoicingConfigured: boolean;
  /** One line saying what is missing when `invoicingConfigured` is false. */
  invoicingDetail: string;
}

/* ==========================================================================
 * 1b. AVAILABILITY — one engine decides whether a time is loggable
 *
 * `~/lib/ops/availability` is the single source of truth for "is this slot
 * bookable", and this screen asks it rather than re-deriving an answer. Two
 * things make the coach's question different from a customer's:
 *
 *   - HE MAY LOG A LESSON HE ALREADY TAUGHT, at an hour he does not publish.
 *     So staff logging passes `ignoreRules` (his published windows are a rate
 *     card, not physics) together with `allowPast` + `ignorePolicy` (minimum
 *     notice and the 60-day horizon are customer-booking policy).
 *   - WHAT SURVIVES that is exactly the set of things that are still true: an
 *     end before its start, an hour already sold, an hour his own calendar has
 *     spoken for. Those still block, and they are the whole point of asking.
 *
 * PRIVACY. Busy blocks arrive with no title, description or attendee — the
 * `BusyBlock` type has no room for one — so the ruling on an imported private
 * event can only ever be the word "unavailable". `slotWording` below hard-codes
 * that for `reason === 'busy'` so a future edit to the detail strings cannot
 * leak an event title onto this screen either.
 * ======================================================================== */

/** The serialisable slice of an availability context the loader ships down. */
export interface AvailabilityData {
  /** Wall clock "now", fixed by the loader so SSR and hydration agree. */
  now: IsoDateTime;
  /** JV Gold's own timed bookings. */
  sessions: BookedSession[];
  /** Opaque busy ranges. No titles, by construction. */
  busy: BusyBlock[];
  /** False while Google Calendar is not connected — weakens "open" to "no known conflict". */
  googleConnected: boolean;
}

/**
 * Build the availability inputs from a list of calendar blocks.
 *
 * The loader calls this so the first render is server-computed and
 * deterministic; the shell calls it again on its LIVE event list, so a lesson
 * logged a minute ago in this browser is a conflict for the next one. Two
 * callers, one derivation — otherwise the ruling would go stale the moment
 * anything was added without a reload.
 *
 * WHAT IS DELIBERATELY EXCLUDED:
 *   - ALL-DAY blocks. An untimed row is a DAY, not an hour, and an all-day
 *     block spans midnight to midnight — including one would mark the whole
 *     day taken and stop him logging a lesson he genuinely taught that
 *     afternoon.
 *   - Every descriptive field on a Google event. `BusyBlock` has no title,
 *     description, location or attendee, so an imported private entry can only
 *     ever be answered with the word "unavailable". The privacy rule is the
 *     shape of the type rather than a string somebody has to remember.
 */
export function availabilityFromEvents(
  events: readonly CalendarEvent[],
  googleConnected: boolean,
  now: IsoDateTime,
): AvailabilityData {
  const sessions: BookedSession[] = [];
  const busy: BusyBlock[] = [];

  for (const event of events) {
    if (event.allDay) continue;
    if (event.source === 'google') {
      busy.push({
        id: event.id,
        start: event.start,
        end: event.end,
        allDay: false,
        // 'google', never 'manual' — 'manual' would print "Jesse has blocked
        // this time off" for something that is only an entry on his calendar.
        source: 'google',
      });
      continue;
    }
    sessions.push({
      id: event.id,
      start: event.start,
      end: event.end,
      status: 'completed',
    });
  }

  return {now, sessions, busy, googleConnected};
}

/**
 * Rule on the draft's chosen time.
 *
 * Returns `null` when there is no clock to rule on — 27 of the 45 rows in his
 * book carry none, and an untimed row is a day, not an hour. A day cannot
 * collide with anything, so there is no question to answer.
 */
export function checkDraftSlot(
  draft: SessionDraft,
  data: AvailabilityData,
): SlotDecision | null {
  if (draft.startMinutes == null) return null;

  const start = toDateTime(draft.date, draft.startMinutes);
  const end = toDateTime(
    draft.date,
    draft.startMinutes + Math.max(1, draft.durationMinutes),
  );

  const ctx = createAvailabilityContext({
    now: data.now,
    // Rules are ignored below, so deriving them would be wasted work.
    rules: [],
    sessions: data.sessions,
    busy: data.busy,
    googleConnected: data.googleConnected,
  });

  return checkSlot(start, end, ctx, {
    ignoreRules: true,
    ignorePolicy: true,
    allowPast: true,
    // Editing in place must not collide with the row being edited.
    exceptSessionId: draft.id,
  });
}

/**
 * The sentence the form prints for a decision.
 *
 * `busy` is answered with one word on purpose: that block came from Jesse's
 * personal calendar and the hub must be able to say the hour is spoken for
 * without saying what for.
 */
export function slotWording(decision: SlotDecision): string {
  if (decision.reason === 'busy') {
    return 'Unavailable — something on your own calendar already holds this time.';
  }
  return decision.detail;
}

/** True when a decision must stop the coach submitting. */
export function slotBlocksSave(decision: SlotDecision | null): boolean {
  if (!decision) return false;
  return !decision.open;
}

/* ==========================================================================
 * 2. DEFAULTS AND DERIVATION
 * ======================================================================== */

/** His overwhelmingly common row: one 1-on-1, one session used, $200 cash. */
export const DEFAULT_DURATION_MINUTES = 60;

export function emptyDraft(date: IsoDate): SessionDraft {
  return {
    id: null,
    clientId: null,
    trainingTypeId: null,
    packageTypeId: null,
    paymentMethodId: null,
    incomeStreamId: 'personal-training',
    settlement: DEFAULT_SETTLEMENT,
    sessionsUsed: 1,
    paidCents: 0,
    owedCents: 0,
    date,
    startMinutes: null,
    durationMinutes: DEFAULT_DURATION_MINUTES,
    notes: '',
    rawTrainingType: '',
    rawPackageType: '',
    rawPaymentMethod: '',
  };
}

/**
 * Choosing a client pulls their usual package, rate, method and training type
 * out of their own history. The fastest correct entry is one where he changes
 * nothing, so this deliberately overwrites the vocabulary fields — but never
 * the date, the time or anything he has already typed into the notes.
 */
export function applyPrefill(
  draft: SessionDraft,
  clientId: string,
  prefill: ClientPrefill | undefined,
): SessionDraft {
  if (!prefill) return {...draft, clientId};
  return {
    ...draft,
    clientId,
    trainingTypeId: prefill.trainingTypeId,
    packageTypeId: prefill.packageTypeId,
    paymentMethodId: prefill.paymentMethodId,
    incomeStreamId: prefill.incomeStreamId,
    // Never prefilled as COMPED. A comp is a decision he makes each time, and
    // carrying one forward would quietly give away the next lesson too.
    settlement: prefill.settlement === 'comped' ? 'outside' : prefill.settlement,
    paidCents: prefill.paidCents,
    sessionsUsed: prefill.sessionsUsed,
    durationMinutes: prefill.durationMinutes,
    startMinutes: draft.startMinutes ?? prefill.startMinutes,
    // A new choice of client makes the old row's raws meaningless.
    rawTrainingType: '',
    rawPackageType: '',
    rawPaymentMethod: '',
  };
}

/**
 * Switch the settlement, and move the money fields with it.
 *
 * Each branch leaves the draft in the state that settlement actually describes,
 * so no combination of controls can record a lie — a comp cannot carry $200, a
 * prepaid draw cannot carry a payment method, and an unsent invoice cannot
 * claim money was collected.
 */
export function applySettlement(
  draft: SessionDraft,
  id: SettlementId,
  /** The rate this lesson is worth, in cents. Prefills the invoice amount. */
  rateCents: number | null,
): SessionDraft {
  switch (id) {
    case 'outside':
      return {...draft, settlement: id};
    case 'invoice':
      return {
        ...draft,
        settlement: id,
        // Nothing has been collected yet, so nothing is paid and the whole
        // amount sits in the owed column until the invoice is settled.
        paidCents: 0,
        owedCents: draft.owedCents > 0 ? draft.owedCents : (rateCents ?? draft.paidCents),
        paymentMethodId: null,
        rawPaymentMethod: '',
      };
    case 'prepaid':
      return {
        ...draft,
        settlement: id,
        paidCents: 0,
        owedCents: 0,
        paymentMethodId: null,
        rawPaymentMethod: '',
        sessionsUsed: Math.max(1, draft.sessionsUsed),
      };
    case 'comped':
      return {
        ...draft,
        settlement: id,
        paidCents: 0,
        owedCents: 0,
        paymentMethodId: null,
        rawPaymentMethod: '',
        // A comp burns nothing: the family did not buy this hour.
        sessionsUsed: 0,
      };
    case 'card':
    default:
      // Never reachable from the UI — the chip is rendered disabled — but if it
      // ever were, refusing the change is the only safe answer.
      return draft;
  }
}

/** The prepaid bank before and after this draft, for the balance line. */
export function prepaidAfter(draft: SessionDraft, remaining: number): number {
  if (draft.settlement !== 'prepaid') return remaining;
  return remaining - draft.sessionsUsed;
}

/**
 * Fall back off a settlement the newly chosen client cannot support.
 *
 * Switching from an athlete with ten banked sessions to one with none must not
 * leave "Use a prepaid session" selected against an empty bank — that would
 * record a draw from a balance that does not exist.
 */
export function normaliseSettlement(
  draft: SessionDraft,
  prepaidRemaining: number,
  rateCents: number | null,
): SessionDraft {
  if (draft.settlement !== 'prepaid') return draft;
  if (prepaidRemaining > 0) return draft;
  return applySettlement(draft, 'outside', rateCents);
}

/**
 * Picking a training type moves the duration and the rate with it, because in
 * his book those three always travel together. An amount he has already
 * changed by hand is left alone.
 */
export function applyTrainingType(
  draft: SessionDraft,
  id: TrainingTypeId,
): SessionDraft {
  const type = getTrainingType(id);
  if (!type) return {...draft, trainingTypeId: id};
  const previous = getTrainingType(draft.trainingTypeId);
  const paidWasDefault =
    draft.paidCents === 0 ||
    (previous?.defaultAmountCents != null &&
      draft.paidCents === previous.defaultAmountCents);
  return {
    ...draft,
    trainingTypeId: id,
    durationMinutes: type.defaultDurationMins,
    paidCents:
      paidWasDefault && type.defaultAmountCents != null
        ? type.defaultAmountCents
        : draft.paidCents,
    rawTrainingType: '',
  };
}

/** Picking a package moves the rate when the package publishes one. */
export function applyPackageType(
  draft: SessionDraft,
  id: PackageTypeId,
): SessionDraft {
  const pkg = getPackageType(id);
  return {
    ...draft,
    packageTypeId: id,
    paidCents:
      draft.paidCents === 0 && pkg?.defaultAmountCents != null
        ? pkg.defaultAmountCents
        : draft.paidCents,
    rawPackageType: '',
  };
}

/** The `SessionKind` a training type maps onto, for the calendar's tones. */
export function kindOfDraft(draft: SessionDraft): SessionKind {
  return getTrainingType(draft.trainingTypeId)?.sessionKind ?? 'group';
}

/* ==========================================================================
 * 3. LOCATION, WITHOUT A LOCATION FIELD
 *
 * His book has no location column — the venue is inside the note ('Garage
 * 9am', 'Riverside Submission 7:30am', 'JW NORTH IEWA TOURNAMENT'). The
 * importer already reads it back out with a keyword pass, so the form does the
 * same rather than adding a text field nobody would fill in consistently.
 * ======================================================================== */

const LOCATION_KEYWORDS: ReadonlyArray<{test: RegExp; location: string}> = [
  {test: /riv(erside)?\s*sub/i, location: 'Riverside Submission'},
  {test: /garage|@\s*home|home\b/i, location: 'Home Garage'},
  {test: /jw\s*north/i, location: 'JW North HS'},
  {test: /great\s*oak/i, location: 'Great Oak HS'},
  {test: /beach/i, location: 'Beach'},
  {test: /deep\s*waters/i, location: 'Deep Waters RTC'},
];

/** The venue his note names, or `null` when it names none. Never a guess. */
export function locationFromNotes(notes: string): string | null {
  for (const entry of LOCATION_KEYWORDS) {
    if (entry.test.test(notes)) return entry.location;
  }
  return null;
}

/* ==========================================================================
 * 4. NOTE CHIPS — typing is the fallback, not the default
 * ======================================================================== */

const NOTE_SEPARATOR = ' · ';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function noteHasChip(notes: string, label: string): boolean {
  return notes.toLowerCase().includes(label.toLowerCase());
}

/** Append the chip, or take it back out if it is already in the note. */
export function toggleNoteChip(notes: string, label: string): string {
  if (!noteHasChip(notes, label)) {
    return notes.trim() ? `${notes.trim()}${NOTE_SEPARATOR}${label}` : label;
  }
  const escaped = escapeRegExp(label);
  return notes
    .replace(new RegExp(`\\s*·\\s*${escaped}`, 'i'), '')
    .replace(new RegExp(`${escaped}\\s*·\\s*`, 'i'), '')
    .replace(new RegExp(escaped, 'i'), '')
    .trim();
}

/* ==========================================================================
 * 5. LABELS
 * ======================================================================== */

/** `'2026-06-05'` → `'Fri Jun 5'`. Pure string work — no `Date`, no `Intl`. */
export function chipDate(iso: IsoDate): string {
  const month = MONTH_SHORT[Number(iso.slice(5, 7)) - 1];
  const day = Number(iso.slice(8, 10));
  return `${WEEKDAY_SHORT[weekdayOfIso(iso)]} ${month} ${day}`;
}

/** `'1:30'` for 90 minutes; `'45m'` under an hour. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The title the calendar block carries. Derived — he never types one. */
export function titleForDraft(draft: SessionDraft, clientName: string): string {
  const type =
    getTrainingType(draft.trainingTypeId)?.label ??
    (draft.rawTrainingType || 'Session');
  return `${clientName} · ${type}`;
}

/**
 * The live one-liner above the form's footer. It is the receipt: if this reads
 * correctly he can submit without checking a single control.
 */
export function summaryOfDraft(
  draft: SessionDraft,
  clientName: string | null,
): string {
  const parts: string[] = [];
  parts.push(clientName ?? 'No client yet');
  const type = getTrainingType(draft.trainingTypeId);
  if (type) parts.push(type.label);
  parts.push(chipDate(draft.date));
  parts.push(
    draft.startMinutes == null
      ? 'time not recorded'
      : formatMinutes(draft.startMinutes),
  );
  parts.push(settlementSummary(draft));
  if (draft.owedCents > 0 && draft.settlement !== 'invoice') {
    parts.push(`${centsLabel(draft.owedCents)} owed`);
  }
  return parts.join(' · ');
}

/**
 * The money clause of the receipt line.
 *
 * COMPED and prepaid each get their own words. Both record $0, and if both
 * printed "unpaid" the receipt would be telling him a gift and a debt are the
 * same event — which is the exact confusion this selector exists to end.
 */
export function settlementSummary(draft: SessionDraft): string {
  const method = getPaymentMethod(draft.paymentMethodId);
  switch (draft.settlement) {
    case 'comped':
      return 'COMPED — no charge';
    case 'prepaid':
      return draft.sessionsUsed === 1
        ? 'prepaid session'
        : `${draft.sessionsUsed} prepaid sessions`;
    case 'invoice':
      return draft.owedCents > 0
        ? `${centsLabel(draft.owedCents)} invoiced`
        : 'invoice — no amount yet';
    case 'card':
      return 'saved card (unavailable)';
    case 'outside':
    default:
      return draft.paidCents > 0
        ? `${centsLabel(draft.paidCents)}${method ? ` ${method.label}` : ''}`
        : 'unpaid';
  }
}

/**
 * `$200`. A local formatter is deliberate: `formatMoney` lives in ops/types
 * and this file must stay importable without pulling the domain in for one
 * label. Integer cents in, string out, no float ever.
 */
export function centsLabel(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  let grouped = '';
  const digits = String(whole);
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ',';
    grouped += digits[i];
  }
  const tail = rest === 0 ? '' : `.${String(rest).padStart(2, '0')}`;
  return `${negative ? '-' : ''}$${grouped}${tail}`;
}

/** Dollars typed into a numeric field → integer cents. String math only. */
export function centsFromInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const [whole, fraction = ''] = cleaned.split('.');
  const dollars = Number(whole || '0');
  const pennies = Number(`${fraction}00`.slice(0, 2));
  if (!Number.isFinite(dollars) || !Number.isFinite(pennies)) return 0;
  return dollars * 100 + pennies;
}

/** Integer cents → the text a numeric field shows. `20000` → `'200'`. */
export function inputFromCents(cents: number): string {
  if (cents === 0) return '';
  const whole = Math.floor(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  return rest === 0
    ? String(whole)
    : `${whole}.${String(rest).padStart(2, '0')}`;
}

/* ==========================================================================
 * 6. DRAFT ↔ EVENT
 * ======================================================================== */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Read an existing calendar block back into a draft the form can hold. */
export function draftFromEvent(
  event: CalendarEvent,
  log: SessionLog | null,
): SessionDraft {
  const date = event.start.slice(0, 10);
  const startMinutes = event.allDay
    ? null
    : Number(event.start.slice(11, 13)) * 60 + Number(event.start.slice(14, 16));
  const endMinutes =
    Number(event.end.slice(11, 13)) * 60 + Number(event.end.slice(14, 16));
  const spanDays = event.end.slice(0, 10) > date ? 1440 : 0;
  const duration =
    startMinutes == null
      ? DEFAULT_DURATION_MINUTES
      : Math.max(15, spanDays + endMinutes - startMinutes);

  if (log) {
    return {
      id: event.id,
      clientId: log.clientId,
      trainingTypeId: log.trainingTypeId,
      packageTypeId: log.packageTypeId,
      paymentMethodId: log.paymentMethodId,
      incomeStreamId: log.incomeStreamId,
      settlement: log.settlement,
      sessionsUsed: log.sessionsUsed,
      paidCents: log.paidCents,
      owedCents: log.owedCents,
      date,
      startMinutes,
      durationMinutes: log.durationMinutes || duration,
      notes: event.description ?? '',
      rawTrainingType: log.rawTrainingType,
      rawPackageType: log.rawPackageType,
      rawPaymentMethod: log.rawPaymentMethod,
    };
  }

  // No log: an unclaimed block (a Google event Jesse is turning into a
  // session). Everything the event does know is carried over; the rest stays
  // empty rather than being invented.
  return {
    ...emptyDraft(date),
    id: event.id,
    clientId: event.athleteIds[0] ?? null,
    trainingTypeId: trainingTypeForKind(event.kind),
    paidCents: event.amountCents ?? 0,
    startMinutes,
    durationMinutes: duration,
    notes: event.description ?? '',
  };
}

/** The narrowest honest training type for a `SessionKind`. */
function trainingTypeForKind(kind: SessionKind | null): TrainingTypeId | null {
  switch (kind) {
    case 'private':
      return '1-on-1';
    case 'partner':
      return 'partner';
    case 'workout':
      return 'strength-conditioning';
    case 'camp':
    case 'clinic':
      return 'camp-clinic';
    case 'group':
      return 'group-session';
    default:
      return null;
  }
}

function eventFromDraft(
  draft: SessionDraft,
  clientName: string,
  base: CalendarEvent | null,
  newId: string,
): CalendarEvent {
  const startMinutes = draft.startMinutes;
  const allDay = startMinutes == null;
  const start = allDay
    ? `${draft.date}T00:00:00`
    : `${draft.date}T${pad2(Math.floor(startMinutes / 60))}:${pad2(
        startMinutes % 60,
      )}:00`;
  const endTotal = (startMinutes ?? 0) + draft.durationMinutes;
  const endDayShift = Math.floor(endTotal / 1440);
  const withinEnd = endTotal - endDayShift * 1440;
  const end = allDay
    ? `${addDays(draft.date, 1)}T00:00:00`
    : `${
        endDayShift === 0 ? draft.date : addDays(draft.date, endDayShift)
      }T${pad2(Math.floor(withinEnd / 60))}:${pad2(withinEnd % 60)}:00`;

  return {
    ...(base ?? EMPTY_EVENT),
    id: base?.id ?? newId,
    // An edited Google block keeps its provenance — it is still a mirror of a
    // row on his phone, it has just been CLAIMED. Rewriting `source` here
    // would lose the only record of where it came from.
    source: base?.source ?? 'jvgold',
    title: titleForDraft(draft, clientName),
    start,
    end,
    allDay,
    location: locationFromNotes(draft.notes),
    description: draft.notes || null,
    sessionId: base?.sessionId ?? null,
    kind: kindOfDraft(draft),
    offeringId: getTrainingType(draft.trainingTypeId)?.offeringId ?? null,
    athleteIds: draft.clientId ? [draft.clientId] : [],
    // What the block is WORTH, which is not always what was collected: an
    // invoiced lesson has its value sitting in the owed column until it clears.
    amountCents:
      draft.settlement === 'invoice' ? draft.owedCents : draft.paidCents,
    // Editing a Google block claims it. It stops being a mirror of his phone
    // and becomes a JV Gold session, which is the only honest way to let it be
    // edited before two-way sync exists.
    readOnly: false,
    claimed: true,
  };
}

const EMPTY_EVENT: CalendarEvent = {
  id: '',
  source: 'jvgold',
  title: '',
  start: '',
  end: '',
  allDay: false,
  location: null,
  description: null,
  sessionId: null,
  kind: null,
  offeringId: null,
  athleteIds: [],
  amountCents: null,
  googleEventId: null,
  calendarId: null,
  colorId: null,
  recurrence: null,
  attendees: [],
  readOnly: false,
  claimed: true,
  syncedAt: null,
};

function logFromDraft(draft: SessionDraft): SessionLog {
  return {
    clientId: draft.clientId,
    trainingTypeId: draft.trainingTypeId,
    packageTypeId: draft.packageTypeId,
    paymentMethodId: draft.paymentMethodId,
    incomeStreamId: draft.incomeStreamId,
    settlement: draft.settlement,
    sessionsUsed: draft.sessionsUsed,
    paidCents: draft.paidCents,
    owedCents: draft.owedCents,
    durationMinutes: draft.durationMinutes,
    startRecorded: draft.startMinutes != null,
    rawTrainingType: draft.rawTrainingType,
    rawPackageType: draft.rawPackageType,
    rawPaymentMethod: draft.rawPaymentMethod,
    storage: 'device',
  };
}

/* ==========================================================================
 * 7. THE WRITE SEAM
 *
 * ONE function stands between the form and storage. Today it resolves against
 * the browser and reports `storage: 'device'`, which is what the UI prints —
 * nothing here pretends a server accepted anything.
 *
 * When Supabase lands, the body of `commitSession` becomes a `supabase.from(
 * 'sessions').upsert(...)` and returns `storage: 'book'`. Its signature, its
 * callers and every component below it stay exactly as they are.
 * ======================================================================== */

export interface SessionCommitInput {
  op: 'save' | 'delete';
  draft: SessionDraft;
  /** The block as it exists right now, or `null` when creating. */
  existing: CalendarEvent | null;
  /** Resolved from the roster by the caller — the model never guesses names. */
  clientName: string;
  /** Id to mint for a newly created block. */
  newId: string;
}

export interface SessionCommitResult {
  ok: boolean;
  /** The block to write into the calendar. `null` on a delete. */
  event: CalendarEvent | null;
  log: SessionLog | null;
  /** Id to remove. `null` on a save. */
  removedId: string | null;
  storage: SessionStorage;
  /** Printed verbatim by the sheet. Must stay true. */
  message: string;
}

export async function commitSession(
  input: SessionCommitInput,
): Promise<SessionCommitResult> {
  if (input.op === 'delete') {
    return {
      ok: true,
      event: null,
      log: null,
      removedId: input.existing?.id ?? input.draft.id,
      storage: 'device',
      message: 'Removed on this device only.',
    };
  }

  const event = eventFromDraft(
    input.draft,
    input.clientName,
    input.existing,
    input.newId,
  );
  return {
    ok: true,
    event,
    log: logFromDraft(input.draft),
    removedId: null,
    storage: 'device',
    message: 'Saved on this device.',
  };
}

/* ==========================================================================
 * 8. READ-BACK HELPERS FOR THE DETAIL VIEW
 * ======================================================================== */

export interface LogLine {
  label: string;
  value: string;
  /** His verbatim cell, when the canonical label is not what he typed. */
  raw: string | null;
  tabular?: boolean;
}

/** How a logged session was settled, in one phrase. */
export function settlementLine(log: SessionLog): string {
  switch (log.settlement) {
    case 'comped':
      return 'COMPED — no charge';
    case 'prepaid':
      return `Prepaid session${log.sessionsUsed === 1 ? '' : 's'} used`;
    case 'invoice':
      return 'Shopify invoice';
    case 'card':
      return 'Saved card (unavailable)';
    case 'outside':
    default:
      return 'Settled outside Shopify';
  }
}

/** The detail rows for a logged session, in his book's column order. */
export function logLines(log: SessionLog): LogLine[] {
  const training = getTrainingType(log.trainingTypeId);
  const pkg = getPackageType(log.packageTypeId);
  const method = getPaymentMethod(log.paymentMethodId);
  const stream = getIncomeStream(log.incomeStreamId);

  const drift = (canonical: string | undefined, raw: string): string | null => {
    if (!raw) return null;
    if (!canonical) return raw;
    return raw.trim().toLowerCase() === canonical.toLowerCase() ? null : raw;
  };

  return [
    {
      label: 'Package',
      value: pkg?.label ?? (log.rawPackageType || 'Not recorded'),
      raw: drift(pkg?.label, log.rawPackageType),
    },
    {
      label: 'Training',
      value: training?.label ?? (log.rawTrainingType || 'Not recorded'),
      raw: drift(training?.label, log.rawTrainingType),
    },
    {
      label: 'Length',
      value: durationLabel(log.durationMinutes),
      raw: null,
      tabular: true,
    },
    {
      label: 'Sessions used',
      value: String(log.sessionsUsed),
      raw: null,
      tabular: true,
    },
    {
      label: 'Settled',
      value: settlementLine(log),
      raw: null,
    },
    {
      label: 'Paid',
      // COMPED is a $0 the coach chose. "Unpaid" is a $0 he is still owed.
      // Printing the same word for both is what the settlement selector exists
      // to stop, so the read-back distinguishes them too.
      value:
        log.paidCents > 0
          ? centsLabel(log.paidCents)
          : log.settlement === 'comped'
            ? 'Comped — no charge'
            : log.settlement === 'prepaid'
              ? 'Drawn from prepaid balance'
              : log.settlement === 'invoice'
                ? 'Invoiced, not yet settled'
                : 'Unpaid',
      raw: null,
      tabular: log.paidCents > 0,
    },
    {
      label: 'Method',
      value: method?.label ?? (log.rawPaymentMethod || 'Not recorded'),
      raw: drift(method?.label, log.rawPaymentMethod),
    },
    {
      label: 'Owed',
      value: centsLabel(log.owedCents),
      raw: null,
      tabular: true,
    },
    {
      label: 'Stream',
      value: stream?.label ?? 'Not recorded',
      raw: null,
    },
  ];
}
