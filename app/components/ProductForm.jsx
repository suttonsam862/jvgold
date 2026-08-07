import {Link, useNavigate} from 'react-router';
import {AddToCartButton} from './AddToCartButton';
import {SellingPlanSelector} from './SellingPlanSelector';
import {useAside} from './Aside';

const OPTION_BASE =
  'relative inline-flex min-w-[3rem] items-center justify-center border px-4 py-3 ' +
  'font-display text-[0.7rem] font-semibold uppercase tracking-[0.14em] ' +
  'transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

/**
 * @param {{selected: boolean; available: boolean}} state
 */
function optionClass({selected, available}) {
  return [
    OPTION_BASE,
    selected
      ? 'border-onyx bg-onyx text-stone'
      : 'border-onyx/20 text-onyx hover:border-onyx',
    available ? '' : 'opacity-35',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   sellingPlans?: SellingPlanState;
 * }}
 */
export function ProductForm({productOptions, selectedVariant, sellingPlans}) {
  const navigate = useNavigate();
  const {open} = useAside();

  // A product with no selling plans (every product today) yields a state whose
  // `hasPlans` is false: the selector renders nothing, no consent is required,
  // and the cart line carries no `sellingPlanId`. Plain one-off purchase, no
  // dead controls.
  const hasPlans = Boolean(sellingPlans?.hasPlans);
  const sellingPlanId = sellingPlans?.sellingPlanId;
  const purchaseBlockedReason = sellingPlans?.purchaseBlockedReason ?? null;
  const soldOut = !selectedVariant || !selectedVariant.availableForSale;
  const disabled = soldOut || purchaseBlockedReason !== null;

  return (
    <div>
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="mb-10 border-t rule pt-6" key={option.name}>
            <h2 className="tag mb-4 text-steel">{option.name.toUpperCase()}</h2>
            <div className="flex flex-wrap gap-2">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className={optionClass({selected, available})}
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      aria-current={selected ? 'true' : undefined}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={optionClass({selected, available})}
                      key={option.name + name}
                      aria-pressed={selected}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
          </div>
        );
      })}

      {sellingPlans ? <SellingPlanSelector state={sellingPlans} /> : null}

      {/*
        The reason the button is dead, stated next to the button rather than
        hidden on it — a disabled control cannot take focus, so it can never
        announce its own aria-describedby.
      */}
      {purchaseBlockedReason && !soldOut ? (
        <p
          role="status"
          className="mb-4 border-l-2 border-gold-deep py-1 pl-4 text-sm leading-relaxed text-onyx"
        >
          {purchaseBlockedReason}
        </p>
      ) : null}

      <div className="jv-atc">
        <AddToCartButton
          disabled={disabled}
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant && !disabled
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant,
                    // AddToCartButton forwards `lines` untouched to
                    // CartForm.ACTIONS.LinesAdd, so attaching the plan here is
                    // all that is needed. Undefined on a one-off purchase, and
                    // undefined is simply absent once the line is serialised.
                    ...(sellingPlanId ? {sellingPlanId} : {}),
                  },
                ]
              : []
          }
        >
          {soldOut
            ? 'Sold out'
            : hasPlans && sellingPlanId
              ? 'Subscribe'
              : 'Add to cart'}
        </AddToCartButton>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-steel">
        Ships from Riverside, California. Small runs — once a size is gone it
        does not come back.
      </p>
    </div>
  );
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({swatch, name}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <span
      aria-label={name}
      className="block h-5 w-5 overflow-hidden"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      )}
    </span>
  );
}

/** @typedef {import('./SellingPlanSelector').SellingPlanState} SellingPlanState */
/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
