import {RenewalDisclosure} from './RenewalDisclosure';
import {formatMoney, renewalTerms, termsFor} from '~/lib/offerings';
import type {
  Offering,
  SubscriptionTerm,
  TermPricing,
} from '~/lib/offerings';

interface TermSelectorProps {
  offering: Offering;
  term: SubscriptionTerm;
  /**
   * Prices one term for THIS offering. Callers must pass an engine helper —
   * `sessionPricing(offering, t)`, `tierPricing(tier, t, sessions)` — never a
   * closure that does its own arithmetic. Whatever the receipt is built from is
   * what the chips must be built from, or the picker and the receipt disagree.
   */
  pricing: (term: SubscriptionTerm) => TermPricing;
  onChange: (term: SubscriptionTerm) => void;
  /** Names what the rates describe when it isn't obvious (a package tier). */
  basis?: string | null;
}

/**
 * The commitment chips. Twelve months is preselected and visually primary
 * because that is the client's default, and the saving against the one-off rate
 * is stated in figures rather than implied by a percentage.
 *
 * PRESELECTING A PLAN IS LAWFUL. Pre-checking CONSENT is not — that is a
 * separate, initially-unchecked control on the details step. See
 * `RenewalDisclosure` and `RequestForm`.
 */
export function TermSelector({
  offering,
  term,
  pricing,
  onChange,
  basis = null,
}: TermSelectorProps) {
  const definitions = termsFor(offering);
  if (definitions.length < 2) return null;

  const active = pricing(term);
  const renewal = active.renews ? renewalTerms(active) : null;

  return (
    <section aria-labelledby="bk-term-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p id="bk-term-heading" className="tag text-gold">
            CHOOSE YOUR COMMITMENT
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone/60">
            {offering.baseCadence === 'monthly'
              ? 'The same package, month after month — the longer the commitment, the lower the monthly rate.'
              : 'One session a month at a standing rate, or pay the one-off price a session at a time. The longer the commitment, the lower the monthly rate.'}
          </p>
        </div>
        {basis ? (
          <p className="text-[0.6rem] uppercase leading-relaxed tracking-[0.16em] text-stone/40">
            {basis}
          </p>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Length of commitment"
        className="bk-terms"
      >
        {definitions.map((definition) => {
          const price = pricing(definition.id);
          const selected = definition.id === term;
          const saves = price.savings > 0;

          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onChange(definition.id)}
              aria-pressed={selected}
              aria-label={
                saves
                  ? `${price.label} — ${price.rateLabel}, ${formatMoney(
                      price.savings,
                    )} less than the one-off rate over ${price.months} months`
                  : `${price.label} — ${price.rateLabel}`
              }
              className="bk-term"
            >
              {saves && definition.id === 'm12' ? (
                <span aria-hidden="true" className="bk-term-flag">
                  BEST VALUE
                </span>
              ) : null}
              <span aria-hidden="true" className="bk-term-name">
                {price.label}
              </span>
              <span
                aria-hidden="true"
                className="display bk-money bk-term-rate"
              >
                {price.rateLabel}
              </span>
              <span aria-hidden="true" className="bk-money bk-term-note">
                {saves
                  ? `Save ${formatMoney(price.savings)}`
                  : price.renews
                    ? 'No minimum'
                    : 'Full price'}
              </span>
            </button>
          );
        })}
      </div>

      {/* The saving, in plain figures, against the price of not committing. */}
      <p
        role="status"
        className="bk-term-summary bk-money text-sm leading-relaxed"
      >
        {active.savings > 0 ? (
          <>
            <span className="text-gold">{active.discountLabel}</span> —{' '}
            {formatMoney(active.rate)} a month instead of{' '}
            {formatMoney(active.listRate)}, {formatMoney(active.commitmentTotal)}{' '}
            across the {active.months}-month minimum. That is{' '}
            <span className="text-stone">{formatMoney(active.savings)}</span> less
            than paying the one-off rate every month.
          </>
        ) : active.renews ? (
          <>
            {formatMoney(active.rate)} a month, no minimum term. A longer
            commitment lowers this rate by up to 20%.
          </>
        ) : (
          <>
            {formatMoney(active.rate)} for the single session. Nothing recurring,
            nothing to cancel.
          </>
        )}
      </p>

      {renewal ? <RenewalDisclosure renewal={renewal} /> : null}
    </section>
  );
}
