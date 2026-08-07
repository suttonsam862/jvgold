import {Money} from '@shopify/hydrogen';

/**
 * Price display. Tabular figures so columns of prices line up, and the
 * struck-through compare-at price recedes to steel.
 *
 * `suffix` carries the cadence ('/mo') when the price on screen is a
 * subscription rate rather than a one-off. `compareLabel` names what the
 * struck-through figure is, for screen readers, because `<s>` alone is
 * announced inconsistently — on a subscription that figure is the ONE-OFF
 * price, not a sale price, and the two must not be confused.
 *
 * Every value here is a Shopify MoneyV2 rendered by `<Money>`. This component
 * does no arithmetic, and must not start: a price the app computed can
 * disagree with the price checkout charges.
 *
 * @param {{
 *   price?: MoneyV2 | null;
 *   compareAtPrice?: MoneyV2 | null;
 *   className?: string;
 *   suffix?: string;
 *   compareLabel?: string;
 *   label?: string;
 * }}
 */
export function ProductPrice({
  price,
  compareAtPrice,
  className = '',
  suffix = '',
  compareLabel = 'Regular price',
  label = 'Price',
}) {
  const amount = price ? (
    <span className="inline-flex items-baseline">
      <Money as="span" data={price} />
      {suffix ? (
        <span className="ml-0.5 text-[0.6em] tracking-normal opacity-80">
          {suffix}
        </span>
      ) : null}
    </span>
  ) : null;

  return (
    <div
      aria-label={label}
      className={`tabular ${className}`.trim()}
      role="group"
    >
      {compareAtPrice ? (
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {amount}
          <s className="text-[0.85em] text-steel">
            <span className="sr-only">{compareLabel} </span>
            <Money as="span" data={compareAtPrice} />
          </s>
        </span>
      ) : (
        (amount ?? <span>&nbsp;</span>)
      )}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').MoneyV2} MoneyV2 */
