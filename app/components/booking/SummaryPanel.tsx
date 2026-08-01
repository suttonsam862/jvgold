import {formatMoney} from '~/lib/offerings';
import type {Offering, Quote} from '~/lib/offerings';

interface SummaryPanelProps {
  offering: Offering | null;
  quote: Quote;
  primaryLabel: string;
  onPrimary: () => void;
  onChangeOffering: () => void;
  /** Hides the CTA when the form below already owns the submit button. */
  showPrimary?: boolean;
  pending?: boolean;
}

export function SummaryPanel({
  offering,
  quote,
  primaryLabel,
  onPrimary,
  onChangeOffering,
  showPrimary = true,
  pending = false,
}: SummaryPanelProps) {
  if (!offering) {
    return (
      <div className="border bk-hairline p-7">
        <p className="tag text-gold">YOUR BOOKING</p>
        <p className="mt-4 text-sm leading-relaxed text-stone/55">
          Choose a session type and the full price breakdown builds itself here —
          what you pay today, what you pay later, and exactly what is on the
          calendar.
        </p>
      </div>
    );
  }

  const charges = quote.lines.filter((l) => l.kind === 'charge');
  const notes = quote.lines.filter((l) => l.kind !== 'charge');
  const isDeposit = quote.cadence === 'deposit';
  const isMonthly = quote.cadence === 'monthly';

  return (
    <div className="border bk-hairline">
      <div className="flex items-start justify-between gap-4 border-b bk-hairline p-7 pb-5">
        <div>
          <p className="tag text-gold">YOUR BOOKING</p>
          <p className="display mt-3 text-xl text-stone">{offering.name}</p>
        </div>
        <button
          type="button"
          onClick={onChangeOffering}
          className="min-h-[44px] shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/50 underline decoration-stone/30 underline-offset-4 transition-colors hover:text-gold"
        >
          Change
        </button>
      </div>

      {quote.schedule.length > 0 ? (
        <dl className="flex flex-col gap-3 border-b bk-hairline p-7 py-5">
          {quote.schedule.map((line) => (
            <div key={line.label + line.value} className="flex gap-4">
              <dt className="w-24 shrink-0 text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                {line.label}
              </dt>
              <dd className="text-sm leading-snug text-stone/80">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {charges.length > 0 ? (
        <div className="flex flex-col gap-3 border-b bk-hairline p-7 py-5">
          {charges.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-stone/80">
                {line.label}
                {line.detail ? (
                  <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.14em] text-stone/40">
                    {line.detail}
                  </span>
                ) : null}
              </span>
              <span className="bk-money shrink-0 text-sm text-stone">
                {formatMoney(line.amount)}
                {isMonthly ? <span className="text-stone/45">/mo</span> : null}
              </span>
            </div>
          ))}
          {notes.map((line) => (
            <div
              key={line.label}
              className="flex items-baseline justify-between gap-4 text-stone/45"
            >
              <span className="text-xs">
                {line.label}
                {line.detail ? ` — ${line.detail}` : ''}
              </span>
              <span className="bk-money shrink-0 text-xs">
                {formatMoney(line.amount)}
              </span>
            </div>
          ))}
          {quote.savings ? (
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">
              You save {formatMoney(quote.savings)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="p-7">
        {/* Due now — the only figure allowed to be this loud. */}
        <div className="bk-total-slot flex items-end justify-between gap-4">
          <span className="max-w-[9rem] text-[0.6rem] uppercase leading-relaxed tracking-[0.2em] text-gold">
            {quote.dueLabel}
          </span>
          <span
            key={`${quote.dueLabel}-${quote.dueNow}`}
            className="bk-amount display bk-money text-[2.4rem] leading-none text-stone"
          >
            {formatMoney(quote.dueNow)}
            {isMonthly ? (
              <span className="ml-1 text-base text-stone/50">/mo</span>
            ) : null}
          </span>
        </div>

        {/* Then — the balance as its own ruled line, never buried in prose. */}
        {isDeposit && quote.balance !== null ? (
          <div className="mt-5 flex flex-col gap-3 border-t bk-hairline pt-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/45">
                Balance{quote.balanceDueDate ? ` due ${quote.balanceDueDate}` : ''}
              </span>
              <span className="bk-money shrink-0 text-base text-stone/80">
                {formatMoney(quote.balance)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                {quote.totalLabel}
              </span>
              <span className="bk-money shrink-0 text-sm text-stone/60">
                {formatMoney(quote.total)}
              </span>
            </div>
          </div>
        ) : null}

        {isMonthly && quote.balanceLabel ? (
          <p className="mt-5 border-t bk-hairline pt-5 text-xs leading-relaxed text-stone/55">
            {quote.balanceLabel}. This is a recurring monthly charge, not a
            one-time total.
          </p>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-stone/45">{quote.terms}</p>

        {showPrimary ? (
          <>
            <button
              type="button"
              onClick={onPrimary}
              disabled={!quote.complete || pending}
              className="display mt-6 min-h-[56px] w-full bg-gold px-6 py-4 text-[0.75rem] tracking-[0.16em] text-onyx-deep transition-colors hover:bg-stone disabled:cursor-not-allowed disabled:bg-stone/15 disabled:text-stone/40"
            >
              {primaryLabel}
            </button>
            <p
              className="mt-3 text-center text-[0.65rem] uppercase tracking-[0.16em] text-stone/45"
              role="status"
            >
              {quote.nextHint}
            </p>
          </>
        ) : null}

        <p className="mt-6 border-t bk-hairline pt-5 text-[0.65rem] leading-relaxed text-stone/40">
          All figures are provisional and confirmed in writing before payment.
          24-hour cancellation policy. Reschedule free up to 24 hours before a
          session; inside 24 hours the session is charged in full.
        </p>
      </div>
    </div>
  );
}
