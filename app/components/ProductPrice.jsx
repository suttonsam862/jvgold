import {Money} from '@shopify/hydrogen';

/**
 * Price display. Tabular figures so columns of prices line up, and the
 * struck-through compare-at price recedes to steel.
 * @param {{
 *   price?: MoneyV2;
 *   compareAtPrice?: MoneyV2 | null;
 *   className?: string;
 * }}
 */
export function ProductPrice({price, compareAtPrice, className = ''}) {
  return (
    <div
      aria-label="Price"
      className={`tabular ${className}`.trim()}
      role="group"
    >
      {compareAtPrice ? (
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {price ? <Money as="span" data={price} /> : null}
          <s className="text-[0.85em] text-steel">
            <Money as="span" data={compareAtPrice} />
          </s>
        </span>
      ) : price ? (
        <Money as="span" data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').MoneyV2} MoneyV2 */
