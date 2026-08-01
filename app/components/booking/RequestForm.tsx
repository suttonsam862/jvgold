import {useRef, useState} from 'react';
import {
  EMPTY_DETAILS,
  GRADE_OPTIONS,
  formatMoney,
  validateDetails,
} from '~/lib/offerings';
import type {AthleteDetails, DetailErrors, Quote} from '~/lib/offerings';

interface RequestFormProps {
  quote: Quote;
  requireDepositTerms: boolean;
  depositTerms: string;
  onSubmit: (details: AthleteDetails) => void;
  onBack: () => void;
}

type FieldName = keyof AthleteDetails;

const FOCUS_ORDER: FieldName[] = [
  'athleteName',
  'age',
  'grade',
  'email',
  'phone',
  'notes',
  'acceptsDepositTerms',
];

export function RequestForm({
  quote,
  requireDepositTerms,
  depositTerms,
  onSubmit,
  onBack,
}: RequestFormProps) {
  const [details, setDetails] = useState<AthleteDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const setField = <K extends FieldName>(name: K, value: AthleteDetails[K]) => {
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
    const found = validateDetails(details, requireDepositTerms);
    setErrors(found);
    const invalid = FOCUS_ORDER.filter((f) => found[f]);
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
            {FOCUS_ORDER.filter((f) => errors[f]).map((f) => (
              <li key={f} className="text-xs leading-relaxed text-stone/75">
                {errors[f]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
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
          hint="Weight class, goals, injuries, partner's name, team headcount — optional."
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

      {/* The money, restated where the thumb is — the desktop rail is a long
          way from the submit button on a phone. */}
      <dl className="flex flex-col gap-2 border-t bk-hairline pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">
            {quote.dueLabel}
          </dt>
          <dd className="display bk-money shrink-0 text-xl text-stone">
            {formatMoney(quote.dueNow)}
            {quote.cadence === 'monthly' ? (
              <span className="text-sm text-stone/50"> / month</span>
            ) : null}
          </dd>
        </div>
        {quote.cadence === 'deposit' && quote.balance !== null ? (
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
          {quote.cadence === 'monthly'
            ? ' per month'
            : quote.cadence === 'deposit'
              ? ' deposit'
              : ''}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-stone/45">
        Nothing is charged here. Jesse reviews every request personally and
        confirms — with a payment link — within 24 hours.
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
