/**
 * ============================================================================
 * CLIENT INTAKE — THE ROW, ITS VALIDATION, AND WHERE EACH FIELD IS ALLOWED TO GO
 * ============================================================================
 *
 * Everything on /private/clients/new that is not markup: the draft shape, the
 * two validators that have to run on both sides of the wire, the paperwork
 * checklist, and — the important part — the split that decides which fields may
 * be written to Shopify and which may not.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE ONLY FOUR FREE-TEXT IDENTITY FIELDS
 * ---------------------------------------------------------------------------
 * Level, status, package and income stream are CHIP GROUPS, out of the
 * controlled vocabulary. His previous system let all four be typed, and they
 * fractured — 'STRENGTH' beside 'Strength & Conditioning', 'CASH' beside
 * 'Cash', 'GAGE KOTARO' beside 'Kade Kean'. A roster of spellings is not a
 * roster. Only the four values that genuinely cannot come from a list — the
 * athlete's name, the guardian's name, an email and a phone — are typed.
 *
 * The paperwork block adds five more text fields, and they are text for the
 * same reason: a USAW card number, an insurance policy number and an insurance
 * company's name are identifiers issued by somebody else. There is no honest
 * list to pick them from, and inventing one would put made-up insurers in front
 * of a coach filling in a real form.
 *
 * ---------------------------------------------------------------------------
 * THE DATA RULE — READ THIS BEFORE ADDING A FIELD
 * ---------------------------------------------------------------------------
 * The roster includes minors. Date of birth, insurance policy number and waiver
 * status go to SUPABASE ONLY, into a table with row-level security, and never
 * into a Shopify customer metafield.
 *
 * That is not a preference. A metafield created with `PUBLIC_READ` access is
 * queryable through the Storefront API using the public token — and that token
 * ships inside the browser bundle of this very site. One wrongly-scoped
 * definition would make a child's date of birth and insurance policy number
 * readable by anyone who views source. `SHOPIFY_SAFE_FIELDS` below is the list
 * that may cross; `SUPABASE_ONLY_FIELDS` is the list that may not, and it is
 * exported so the split is a thing you can point at rather than a habit.
 */

import type {ClientLevel, ClientStatus} from '~/lib/ops/types';
import type {IncomeStreamId, PackageTypeId} from '~/lib/ops/vocabulary';
import {LEVELS} from './filterModel';

/* ==========================================================================
 * 1. THE DRAFT
 * ======================================================================== */

/** Waiver state. Two chips, never a bare checkbox — "unset" is not a value. */
export type WaiverState = 'signed' | 'unsigned';

export interface IntakeDraft {
  /* --- identity: the only free text that genuinely must be ------------- */
  name: string;
  guardian: string;
  email: string;
  phone: string;

  /* --- selectable: every one of these is a chip group ------------------ */
  level: ClientLevel;
  status: ClientStatus;
  packageTypeId: PackageTypeId | null;
  incomeStreamId: IncomeStreamId;

  /* --- the paperwork a youth club has to keep on file ------------------ */
  /** `YYYY-MM-DD`, or `''` when it has not been collected. Supabase only. */
  dateOfBirth: string;
  usawCardNumber: string;
  insuranceProvider: string;
  /** Supabase only. Never a metafield. */
  insurancePolicyNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  /** Supabase only. Never a metafield. */
  waiver: WaiverState;
}

export const EMPTY_INTAKE: IntakeDraft = {
  name: '',
  guardian: '',
  email: '',
  phone: '',
  level: 'Youth',
  status: 'Trial',
  packageTypeId: null,
  incomeStreamId: 'personal-training',
  dateOfBirth: '',
  usawCardNumber: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  waiver: 'unsigned',
};

/** Levels whose athletes are minors by default, so a guardian is required. */
const MINOR_LEVELS: readonly ClientLevel[] = ['Youth', 'HS'];

export function isMinorLevel(level: ClientLevel): boolean {
  return MINOR_LEVELS.includes(level);
}

/* ==========================================================================
 * 2. THE SPLIT — what Shopify is allowed to hold
 * ======================================================================== */

/**
 * Fields that may be written to the Shopify customer record. Name and contact
 * details are exactly what a commerce system is for: an invoice has to reach a
 * human being.
 */
export const SHOPIFY_SAFE_FIELDS = [
  'name',
  'guardian',
  'email',
  'phone',
] as const satisfies readonly (keyof IntakeDraft)[];

/**
 * Fields that must NEVER leave Supabase — not as a metafield, not as a note,
 * not as a tag. These are a child's identity and medical-adjacent paperwork,
 * and Shopify has no storage for them that is private by construction.
 *
 * This list is documentation. `ShopifySafeDraft` below is the ENFORCEMENT.
 */
export const SUPABASE_ONLY_FIELDS = [
  'dateOfBirth',
  'insuranceProvider',
  'insurancePolicyNumber',
  'waiver',
  'usawCardNumber',
  'emergencyContactName',
  'emergencyContactPhone',
] as const satisfies readonly (keyof IntakeDraft)[];

/**
 * The ONLY shape the Shopify half of intake is given.
 *
 * Derived from `SHOPIFY_SAFE_FIELDS`, so the function that talks to the Admin
 * API cannot read a date of birth or an insurance policy number — those keys do
 * not exist on its argument. This is the rule expressed as a type rather than
 * as a comment somebody has to remember: adding a protected field to the
 * Shopify payload stops compiling instead of quietly shipping.
 */
export type ShopifySafeDraft = Pick<
  IntakeDraft,
  (typeof SHOPIFY_SAFE_FIELDS)[number]
>;

/** Narrow a draft to what Shopify is allowed to see. The one-way door. */
export function shopifySafeDraft(draft: IntakeDraft): ShopifySafeDraft {
  return {
    name: draft.name,
    guardian: draft.guardian,
    email: draft.email,
    phone: draft.phone,
  };
}

/* ==========================================================================
 * 3. VALIDATION
 *
 * The same functions run in the browser (for the inline errors) and in the
 * action (because a client-side check is a courtesy, not a gate). Both sides
 * importing this file is what keeps the two answers identical.
 * ======================================================================== */

export type IntakeField = keyof IntakeDraft;
export type IntakeErrors = Partial<Record<IntakeField, string>>;

/**
 * Deliberately permissive. It rejects the shapes that cannot be an address —
 * no `@`, no dot after it, whitespace inside — and accepts everything else,
 * because the only real test of an email is whether mail arrives. A stricter
 * pattern would reject valid addresses and a coach would have no way past it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Digits only. US numbers are 10, or 11 with the country code. */
export function phoneDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

export function isValidPhone(value: string): boolean {
  const digits = phoneDigits(value);
  if (digits.length === 11) return digits.startsWith('1');
  return digits.length === 10;
}

/** `'9515550147'` → `'(951) 555-0147'`. Pure string work, no `Intl`. */
export function formatPhone(value: string): string {
  const digits = phoneDigits(value);
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return value.trim();
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** `YYYY-MM-DD` and a real calendar date. No `Date` — string maths only. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

/**
 * Every blocking problem with the draft, keyed by field so each message can sit
 * beside its own control and be tied to it with `aria-describedby`.
 *
 * The PAPERWORK IS NOT VALIDATED AS REQUIRED. A missing USAW card must not stop
 * a coach adding an athlete he is standing next to — chasing that card is the
 * job, and a record that cannot be created is a record he keeps on paper
 * instead. Missing paperwork is surfaced as a visible gap; only the four
 * identity fields block.
 */
export function validateIntake(draft: IntakeDraft): IntakeErrors {
  const errors: IntakeErrors = {};

  if (!draft.name.trim()) {
    errors.name = 'Give the athlete’s name — this is the roster record.';
  }

  if (isMinorLevel(draft.level) && !draft.guardian.trim()) {
    errors.guardian =
      'A Youth or HS athlete needs a guardian on the record. They are who gets invoiced and who gets called.';
  }

  const email = draft.email.trim();
  if (!email) {
    errors.email =
      'An email is required — it is how this record is matched to Shopify and how invoices are sent.';
  } else if (!isValidEmail(email)) {
    errors.email = 'That is not a usable email address. Check for a missing @ or domain.';
  }

  const phone = draft.phone.trim();
  if (!phone) {
    errors.phone = 'A phone number is required.';
  } else if (!isValidPhone(phone)) {
    errors.phone =
      'That is not a usable phone number. Ten digits, or eleven starting with 1.';
  }

  const ice = draft.emergencyContactPhone.trim();
  if (ice && !isValidPhone(ice)) {
    errors.emergencyContactPhone =
      'That is not a usable phone number. Ten digits, or eleven starting with 1.';
  }

  const dob = draft.dateOfBirth.trim();
  if (dob && !isValidIsoDate(dob)) {
    errors.dateOfBirth = 'That is not a real calendar date.';
  }

  return errors;
}

export function hasErrors(errors: IntakeErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* ==========================================================================
 * 4. THE PAPERWORK CHECKLIST
 *
 * Chasing this is a real, recurring part of the admin, so it is rendered as a
 * running list of what is still missing rather than left as blank inputs a
 * coach has to notice. Same four gaps the roster's compliance facet counts, in
 * the same order, so the intake screen and the roster agree.
 * ======================================================================== */

export interface PaperworkItem {
  key: string;
  label: string;
  ok: boolean;
  /** What is on file, or what is missing and why it matters. */
  detail: string;
  /** True when the value is one Shopify must never be given. */
  supabaseOnly: boolean;
}

export function paperworkChecklist(draft: IntakeDraft): PaperworkItem[] {
  return [
    {
      key: 'usaw',
      label: 'USA Wrestling card',
      ok: Boolean(draft.usawCardNumber.trim()),
      detail: draft.usawCardNumber.trim() || 'Missing — required to compete',
      supabaseOnly: true,
    },
    {
      key: 'insurance',
      label: 'Insurance',
      ok: Boolean(
        draft.insuranceProvider.trim() && draft.insurancePolicyNumber.trim(),
      ),
      detail:
        draft.insuranceProvider.trim() && draft.insurancePolicyNumber.trim()
          ? `${draft.insuranceProvider.trim()} · policy on file`
          : draft.insuranceProvider.trim()
            ? 'Provider on file, policy number missing'
            : 'Missing — event registration asks for it',
      supabaseOnly: true,
    },
    {
      key: 'emergency',
      label: 'Emergency contact',
      ok: Boolean(
        draft.emergencyContactName.trim() && draft.emergencyContactPhone.trim(),
      ),
      detail:
        draft.emergencyContactName.trim() && draft.emergencyContactPhone.trim()
          ? `${draft.emergencyContactName.trim()} · ${formatPhone(draft.emergencyContactPhone)}`
          : 'Missing — nobody to call from the mat',
      supabaseOnly: true,
    },
    {
      key: 'waiver',
      label: 'Liability waiver',
      ok: draft.waiver === 'signed',
      detail:
        draft.waiver === 'signed' ? 'Signed' : 'Unsigned — blocks mat time',
      supabaseOnly: true,
    },
    {
      key: 'dob',
      label: 'Date of birth',
      ok: Boolean(draft.dateOfBirth.trim()),
      detail: draft.dateOfBirth.trim() || 'Missing — needed for age brackets',
      supabaseOnly: true,
    },
  ];
}

/* ==========================================================================
 * 5. FORM  <->  DRAFT
 * ======================================================================== */

const LEVEL_SET: readonly string[] = LEVELS;

const STATUS_SET: readonly string[] = [
  'Active',
  'Trial',
  'Paid In Full',
  'Owes Balance',
  'Inactive',
];

/** Read a posted form back into a draft. Unknown ids fall to the default. */
export function draftFromFormData(form: FormData): IntakeDraft {
  const text = (key: keyof IntakeDraft) => String(form.get(key) ?? '').trim();
  const level = String(form.get('level') ?? '');
  const status = String(form.get('status') ?? '');
  const pkg = String(form.get('packageTypeId') ?? '');
  const stream = String(form.get('incomeStreamId') ?? '');

  return {
    name: text('name'),
    guardian: text('guardian'),
    email: text('email').toLowerCase(),
    phone: text('phone'),
    level: LEVEL_SET.includes(level)
      ? (level as ClientLevel)
      : EMPTY_INTAKE.level,
    status: STATUS_SET.includes(status)
      ? (status as ClientStatus)
      : EMPTY_INTAKE.status,
    packageTypeId: pkg ? (pkg as PackageTypeId) : null,
    incomeStreamId: (stream || EMPTY_INTAKE.incomeStreamId) as IncomeStreamId,
    dateOfBirth: text('dateOfBirth'),
    usawCardNumber: text('usawCardNumber'),
    insuranceProvider: text('insuranceProvider'),
    insurancePolicyNumber: text('insurancePolicyNumber'),
    emergencyContactName: text('emergencyContactName'),
    emergencyContactPhone: text('emergencyContactPhone'),
    waiver: form.get('waiver') === 'signed' ? 'signed' : 'unsigned',
  };
}

/* ==========================================================================
 * 6. THE RESULT THE ACTION REPORTS BACK
 * ======================================================================== */

/** How the Shopify half of the save went. Never a silent success. */
export type ShopifyLinkState = 'matched' | 'created' | 'unavailable' | 'failed';

export interface IntakeResult {
  ok: boolean;
  /** Field-level problems, rendered beside their own controls. */
  errors: IntakeErrors;
  /** One sentence about the record as a whole. Printed verbatim. */
  message: string;
  shopify: {
    state: ShopifyLinkState;
    /** `gid://shopify/Customer/…` once linked. Null otherwise. */
    customerId: string | null;
    detail: string;
  };
  supabase: {
    stored: boolean;
    detail: string;
  };
}
