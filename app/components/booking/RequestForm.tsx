import {useRef, useState} from 'react';
import {RenewalDisclosure} from './RenewalDisclosure';
import {
  AGE_RANGE_OPTIONS,
  DATE_FLEXIBILITY_OPTIONS,
  EMPTY_DETAILS,
  GRADE_OPTIONS,
  SKILL_RANGE_OPTIONS,
  formatMoney,
  rateCopy,
  validateDetails,
} from '~/lib/offerings';
import type {DetailErrors, Quote, RequestDetails} from '~/lib/offerings';

interface RequestFormProps {
  quote: Quote;
  /** Camp bookings are made by a host, not a parent — different fields. */
  host?: boolean;
  requireDepositTerms: boolean;
  depositTerms: string;
  onSubmit: (details: RequestDetails) => void;
  onBack: () => void;
}

type FieldName = keyof RequestDetails;

const ATHLETE_ORDER: FieldName[] = [
  'athleteName',
  'age',
  'grade',
  'email',
  'phone',
  'notes',
  'acceptsDepositTerms',
  'acceptsAutoRenewal',
];

const HOST_ORDER: FieldName[] = [
  'contactName',
  'organisation',
  'venue',
  'athleteCount',
  'ageRange',
  'skillRange',
  'dateFlexibility',
  'email',
  'phone',
  'notes',
  'acceptsDepositTerms',
  // A camp is never sold on a term, so this can never fire on a host booking.
  // It is listed only so the error summary stays in visual order if it ever is.
  'acceptsAutoRenewal',
];

export function RequestForm({
  quote,
  host = false,
  requireDepositTerms,
  depositTerms,
  onSubmit,
  onBack,
}: RequestFormProps) {
  const focusOrder = host ? HOST_ORDER : ATHLETE_ORDER;
  const rate = rateCopy(quote);
  // EMPTY_DETAILS seeds `acceptsAutoRenewal` false and nothing here may seed it
  // otherwise: preselecting the 12-month PLAN is lawful, pre-checking the
  // CONSENT to be charged for it is not.
  const [details, setDetails] = useState<RequestDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const setField = <K extends FieldName>(name: K, value: RequestDetails[K]) => {
    setDetails((prev) => ({...prev, [name]: value}));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = {...prev};
      delete next[name];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateDetails(details, {
      requireDepositTerms,
      host,
      // Blocks submission until the auto-renewal has been agreed to on its own.
      requireRenewalConsent: quote.requiresRenewalConsent,
    });
    setErrors(found);
    const invalid = focusOrder.filter((f) => found[f]);
    if (invalid.length > 0) {
      setShowSummary(true);
      fieldRefs.current[invalid[0]]?.focus();
      return;
    }
    setShowSummary(false);
    onSubmit(details);
  };

  const describedBy = (name: FieldName, hintId?: string) => {
    const ids = [errors[name] ? `${name}-error` : null, hintId ?? null].filter(
      Boolean,
    );
    return ids.length ? ids.join(' ') : undefined;
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {showSummary && Object.keys(errors).length > 0 ? (
        <div role="alert" className="border border-[#d9694f]/60 bg-[#d9694f]/10 p-5">
          <p className="display text-sm tracking-[0.06em] text-stone">
            {Object.keys(errors).length} thing
            {Object.keys(errors).length === 1 ? '' : 's'} to fix
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {focusOrder.filter((f) => errors[f]).map((f) => (
              <li key={f} className="text-xs leading-relaxed text-stone/75">
                {errors[f]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {host ? (
          <>
            <Field
              label="Your name"
              name="contactName"
              error={errors.contactName}
            >
              <input
                id="contactName"
                ref={(el) => {
                  fieldRefs.current.contactName = el;
                }}
                className="bk-field"
                type="text"
                autoComplete="name"
                placeholder="First and last"
                value={details.contactName}
                aria-invalid={errors.contactName ? true : undefined}
                aria-describedby={describedBy('contactName')}
                onChange={(e) => setField('contactName', e.target.value)}
              />
            </Field>

            <Field
              label="Club, school or organisation"
              name="organisation"
              error={errors.organisation}
            >
              <input
                id="organisation"
                ref={(el) => {
                  fieldRefs.current.organisation = el;
                }}
                className="bk-field"
                type="text"
                autoComplete="organization"
                placeholder="Who is hosting"
                value={details.organisation}
                aria-invalid={errors.organisation ? true : undefined}
                aria-describedby={describedBy('organisation')}
                onChange={(e) => setField('organisation', e.target.value)}
              />
            </Field>

            <Field
              label="Venue & city"
              name="venue"
              error={errors.venue}
              className="sm:col-span-2"
              hint="Where the mats are. Exact address comes later."
            >
              <input
                id="venue"
                ref={(el) => {
                  fieldRefs.current.venue = el;
                }}
                className="bk-field"
                type="text"
                placeholder="High school gym, Riverside CA"
                value={details.venue}
                aria-invalid={errors.venue ? true : undefined}
                aria-describedby={describedBy('venue', 'venue-hint')}
                onChange={(e) => setField('venue', e.target.value)}
              />
            </Field>

            <Field
              label="Expected athletes"
              name="athleteCount"
              error={errors.athleteCount}
              hint="An estimate is fine — the rate does not move with headcount."
            >
              <input
                id="athleteCount"
                ref={(el) => {
                  fieldRefs.current.athleteCount = el;
                }}
                className="bk-field tabular"
                type="text"
                inputMode="numeric"
                placeholder="60"
                value={details.athleteCount}
                aria-invalid={errors.athleteCount ? true : undefined}
                aria-describedby={describedBy('athleteCount', 'athleteCount-hint')}
                onChange={(e) => setField('athleteCount', e.target.value)}
              />
            </Field>

            <Field label="Age range" name="ageRange" error={errors.ageRange}>
              <select
                id="ageRange"
                ref={(el) => {
                  fieldRefs.current.ageRange = el;
                }}
                className="bk-field"
                value={details.ageRange}
                aria-invalid={errors.ageRange ? true : undefined}
                aria-describedby={describedBy('ageRange')}
                onChange={(e) => setField('ageRange', e.target.value)}
              >
                <option value="">Select…</option>
                {AGE_RANGE_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Skill range"
              name="skillRange"
              error={errors.skillRange}
            >
              <select
                id="skillRange"
                ref={(el) => {
                  fieldRefs.current.skillRange = el;
                }}
                className="bk-field"
                value={details.skillRange}
                aria-invalid={errors.skillRange ? true : undefined}
                aria-describedby={describedBy('skillRange')}
                onChange={(e) => setField('skillRange', e.target.value)}
              >
                <option value="">Select…</option>
                {SKILL_RANGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="How firm are the dates"
              name="dateFlexibility"
              error={errors.dateFlexibility}
              hint="The block you picked on the calendar, and how far it can move."
            >
              <select
                id="dateFlexibility"
                ref={(el) => {
                  fieldRefs.current.dateFlexibility = el;
                }}
                className="bk-field"
                value={details.dateFlexibility}
                aria-invalid={errors.dateFlexibility ? true : undefined}
                aria-describedby={describedBy(
                  'dateFlexibility',
                  'dateFlexibility-hint',
                )}
                onChange={(e) => setField('dateFlexibility', e.target.value)}
              >
                <option value="">Select…</option>
                {DATE_FLEXIBILITY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field
              label="Athlete name"
              name="athleteName"
              error={errors.athleteName}
              className="sm:col-span-2"
            >
              <input
                id="athleteName"
                ref={(el) => {
                  fieldRefs.current.athleteName = el;
                }}
                className="bk-field"
                type="text"
                autoComplete="name"
                placeholder="First and last"
                value={details.athleteName}
                aria-invalid={errors.athleteName ? true : undefined}
                aria-describedby={describedBy('athleteName')}
                onChange={(e) => setField('athleteName', e.target.value)}
              />
            </Field>

            <Field label="Age" name="age" error={errors.age}>
              <input
                id="age"
                ref={(el) => {
                  fieldRefs.current.age = el;
                }}
                className="bk-field tabular"
                type="text"
                inputMode="numeric"
                placeholder="14"
                value={details.age}
                aria-invalid={errors.age ? true : undefined}
                aria-describedby={describedBy('age')}
                onChange={(e) => setField('age', e.target.value)}
              />
            </Field>

            <Field label="Grade level" name="grade" error={errors.grade}>
              <select
                id="grade"
                ref={(el) => {
                  fieldRefs.current.grade = el;
                }}
                className="bk-field"
                value={details.grade}
                aria-invalid={errors.grade ? true : undefined}
                aria-describedby={describedBy('grade')}
                onChange={(e) => setField('grade', e.target.value)}
              >
                <option value="">Select…</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Email" name="email" error={errors.email}>
          <input
            id="email"
            ref={(el) => {
              fieldRefs.current.email = el;
            }}
            className="bk-field"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={details.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
            onChange={(e) => setField('email', e.target.value)}
          />
        </Field>

        <Field label="Phone" name="phone" error={errors.phone}>
          <input
            id="phone"
            ref={(el) => {
              fieldRefs.current.phone = el;
            }}
            className="bk-field tabular"
            type="tel"
            autoComplete="tel"
            placeholder="(951) 555-0134"
            value={details.phone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy('phone')}
            onChange={(e) => setField('phone', e.target.value)}
          />
        </Field>

        <Field
          label="Anything Jesse should know"
          name="notes"
          error={errors.notes}
          className="sm:col-span-2"
          hint={
            host
              ? 'Mat count, session times, what the room needs most, travel and lodging — optional.'
              : "Weight class, goals, injuries, partner's name, team headcount — optional."
          }
        >
          <textarea
            id="notes"
            ref={(el) => {
              fieldRefs.current.notes = el;
            }}
            className="bk-field min-h-[120px] resize-y"
            rows={4}
            maxLength={700}
            value={details.notes}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={describedBy('notes', 'notes-hint')}
            onChange={(e) => setField('notes', e.target.value)}
          />
          <p
            className={`bk-money mt-2 text-right text-[0.6rem] uppercase tracking-[0.16em] ${
              details.notes.length > 600 ? 'text-[#e08a72]' : 'text-stone/35'
            }`}
          >
            {details.notes.length} / 600
          </p>
        </Field>
      </div>

      {requireDepositTerms ? (
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone/70">
            <input
              id="acceptsDepositTerms"
              ref={(el) => {
                fieldRefs.current.acceptsDepositTerms = el;
              }}
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[#c8a25b]"
              checked={details.acceptsDepositTerms}
              aria-invalid={errors.acceptsDepositTerms ? true : undefined}
              aria-describedby={describedBy('acceptsDepositTerms')}
              onChange={(e) => setField('acceptsDepositTerms', e.target.checked)}
            />
            <span>{depositTerms}</span>
          </label>
          {errors.acceptsDepositTerms ? (
            <p
              id="acceptsDepositTerms-error"
              className="mt-2 text-xs text-[#e08a72]"
            >
              {errors.acceptsDepositTerms}
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
       * AUTO-RENEWAL CONSENT.
       *
       * One separate, initially-unchecked affirmative action tied specifically
       * to the recurring charge — not the general terms box, not folded into
       * the submit button's fine print, and never pre-ticked. The disclosures
       * sit immediately above it and again immediately above the billing
       * figures below. Only rendered when a renewing term is actually selected:
       * a one-off session must never be dressed up as a subscription.
       */}
      {quote.renewal ? (
        <div className="flex flex-col gap-4 border-t bk-hairline pt-7">
          <RenewalDisclosure renewal={quote.renewal} />
          <label
            className="bk-consent"
            data-checked={details.acceptsAutoRenewal}
            data-invalid={errors.acceptsAutoRenewal ? true : undefined}
          >
            <input
              id="acceptsAutoRenewal"
              ref={(el) => {
                fieldRefs.current.acceptsAutoRenewal = el;
              }}
              type="checkbox"
              checked={details.acceptsAutoRenewal}
              aria-invalid={errors.acceptsAutoRenewal ? true : undefined}
              aria-describedby={describedBy('acceptsAutoRenewal')}
              onChange={(e) => setField('acceptsAutoRenewal', e.target.checked)}
            />
            <span>{quote.renewal.consentLabel}</span>
          </label>
          {errors.acceptsAutoRenewal ? (
            <p
              id="acceptsAutoRenewal-error"
              className="text-xs leading-relaxed text-[#e08a72]"
            >
              {errors.acceptsAutoRenewal}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-stone/45">
            {quote.renewal.cancelLine} Cancelling stops every future charge; the
            months already paid for are yours to use.
          </p>
        </div>
      ) : null}

      {/* The money, restated where the thumb is — the desktop rail is a long
          way from the submit button on a phone. */}
      <dl className="flex flex-col gap-2 border-t bk-hairline pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">
            {quote.dueLabel}
          </dt>
          <dd className="display bk-money shrink-0 text-xl text-stone">
            {formatMoney(quote.dueNow)}
            {rate.isMonthly ? (
              <span className="text-sm text-stone/50"> / month</span>
            ) : null}
          </dd>
        </div>
        {quote.plan ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/45">
              Then
            </dt>
            <dd className="bk-money shrink-0 text-right text-xs leading-relaxed text-stone/75">
              {quote.plan.rateLabel} until cancelled
            </dd>
          </div>
        ) : null}
        {rate.isDeposit && quote.balance !== null ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/45">
                Balance{quote.balanceDueDate ? ` due ${quote.balanceDueDate}` : ''}
              </dt>
              <dd className="bk-money shrink-0 text-sm text-stone/75">
                {formatMoney(quote.balance)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                {quote.totalLabel}
              </dt>
              <dd className="bk-money shrink-0 text-xs text-stone/60">
                {formatMoney(quote.total)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="flex flex-col gap-4 border-t bk-hairline pt-7 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="tag self-start text-stone/55 transition-colors hover:text-gold"
        >
          BACK TO THE CALENDAR
        </button>
        <button
          type="submit"
          className="display min-h-[56px] bg-gold px-8 py-4 text-[0.75rem] tracking-[0.16em] text-onyx-deep transition-colors hover:bg-stone"
        >
          Send request · {formatMoney(quote.dueNow)}
          {rate.isMonthly ? ' per month' : rate.isDeposit ? ' deposit' : ''}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-stone/45">
        {rate.billingLine} Nothing is charged here.{' '}
        {host
          ? 'Jesse reviews every camp request personally and confirms the dates — with an agreement and a deposit link — within 24 hours.'
          : 'Jesse reviews every request personally and confirms — with a payment link — within 24 hours.'}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  className = '',
  children,
}: {
  label: string;
  name: FieldName;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="mb-2 block text-[0.6rem] uppercase tracking-[0.2em] text-stone/45"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="mt-2 text-xs text-stone/40">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="mt-2 text-xs text-[#e08a72]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
