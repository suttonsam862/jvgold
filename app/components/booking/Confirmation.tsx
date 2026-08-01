import {useEffect, useRef} from 'react';
import {formatMoney} from '~/lib/offerings';
import type {AthleteDetails, Offering, Quote} from '~/lib/offerings';

interface ConfirmationProps {
  offering: Offering;
  quote: Quote;
  details: AthleteDetails;
  reference: string;
  onBookAnother: () => void;
}

export function Confirmation({
  offering,
  quote,
  details,
  reference,
  onBookAnother,
}: ConfirmationProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the confirmation so screen readers land on the outcome.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="bk-step-enter grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <div>
        <p className="tag text-gold">REQUEST RECEIVED — {reference}</p>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-[clamp(2rem,4.5vw,3.4rem)] text-stone outline-none"
        >
          Jesse has it.
        </h3>
        <p className="mt-6 max-w-lg leading-relaxed text-stone/70">
          Every request is read personally — no queue, no auto-scheduler. You&rsquo;ll
          hear back at <span className="text-stone">{details.email}</span> within
          24 hours with confirmation and a payment link. Nothing has been charged.
        </p>

        <ol className="mt-10 flex flex-col gap-5">
          {[
            'Jesse confirms the time and sends a payment link.',
            quote.cadence === 'deposit'
              ? 'Your deposit reserves the bed; the balance is invoiced later.'
              : quote.cadence === 'monthly'
                ? 'Billing starts on the day of your first session, monthly after that.'
                : 'Payment is settled before the session starts.',
            'Show up ten minutes early, shoes and water bottle in hand.',
          ].map((line, i) => (
            <li key={line} className="flex gap-4">
              <span className="display bk-money text-gold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm leading-relaxed text-stone/70">{line}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onBookAnother}
          className="display mt-12 border border-stone/40 px-6 py-4 text-[0.72rem] tracking-[0.16em] text-stone transition-colors hover:border-gold hover:text-gold"
        >
          Book Another Session
        </button>
      </div>

      <div className="border bk-hairline p-7">
        <p className="tag text-gold">THE RECEIPT</p>
        <p className="display mt-4 text-2xl text-stone">{offering.name}</p>

        <dl className="mt-6 flex flex-col gap-3 border-t bk-hairline pt-5">
          {quote.schedule.map((line) => (
            <div key={line.label + line.value} className="flex gap-4">
              <dt className="w-24 shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                {line.label}
              </dt>
              <dd className="text-sm leading-snug text-stone/80">{line.value}</dd>
            </div>
          ))}
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
              Athlete
            </dt>
            <dd className="text-sm leading-snug text-stone/80">
              {details.athleteName} · {details.age} · {details.grade}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
              Contact
            </dt>
            <dd className="text-sm leading-snug text-stone/80">
              {details.email}
              <br />
              {details.phone}
            </dd>
          </div>
          {details.notes.trim() ? (
            <div className="flex gap-4">
              <dt className="w-24 shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                Notes
              </dt>
              <dd className="text-sm leading-snug text-stone/70">
                {details.notes}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 border-t bk-hairline pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">
              {quote.dueLabel}
            </span>
            <span className="bk-amount display bk-money text-3xl text-stone">
              {formatMoney(quote.dueNow)}
              {quote.cadence === 'monthly' ? (
                <span className="ml-1 text-sm text-stone/50">/mo</span>
              ) : null}
            </span>
          </div>
          {quote.cadence === 'deposit' && quote.balance !== null ? (
            <div className="mt-4 flex flex-col gap-2 border-t bk-hairline pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/45">
                  Balance{quote.balanceDueDate ? ` due ${quote.balanceDueDate}` : ''}
                </span>
                <span className="bk-money shrink-0 text-sm text-stone/80">
                  {formatMoney(quote.balance)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                  {quote.totalLabel}
                </span>
                <span className="bk-money shrink-0 text-xs text-stone/60">
                  {formatMoney(quote.total)}
                </span>
              </div>
            </div>
          ) : quote.balanceLabel ? (
            <p className="mt-3 text-xs leading-relaxed text-stone/55">
              {quote.balanceLabel}
              {quote.cadence === 'monthly'
                ? '. Recurring every month, not a one-time total.'
                : ''}
            </p>
          ) : null}
          <p className="mt-4 text-[0.65rem] leading-relaxed text-stone/40">
            24-hour cancellation policy. {quote.terms}
          </p>
        </div>
      </div>
    </div>
  );
}
