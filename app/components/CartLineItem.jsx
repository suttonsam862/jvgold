import {CartForm, Image} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {Link} from 'react-router';
import {ProductPrice} from './ProductPrice';
import {useAside} from './Aside';

const STEP_BUTTON =
  'flex h-9 w-9 items-center justify-center text-base leading-none text-onyx ' +
  'transition-colors duration-300 hover:text-gold-deep disabled:cursor-not-allowed disabled:text-steel/50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold';

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * If the line is a parent line that has child components (like warranties or gift wrapping), they are
 * rendered nested below the parent line.
 * @param {{
 *   layout: CartLayout;
 *   line: CartLine;
 *   childrenMap: LineItemChildrenMap;
 * }}
 */
export function CartLineItem({layout, line, childrenMap}) {
  const {id, merchandise} = line;
  const {product, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const {close} = useAside();
  const lineItemChildren = childrenMap[id];
  const childrenLabelId = `cart-line-children-${id}`;

  const closeIfAside = () => {
    if (layout === 'aside') close();
  };

  return (
    <li key={id} className="border-b rule py-7">
      <div className="flex gap-5">
        {image && (
          <Link
            to={lineItemUrl}
            prefetch="intent"
            onClick={closeIfAside}
            tabIndex={-1}
            aria-hidden="true"
            className="block w-20 shrink-0 self-start overflow-hidden bg-stone-warm md:w-24"
          >
            <Image
              alt=""
              aspectRatio="1/1"
              data={image}
              height={200}
              loading="lazy"
              width={200}
              className="h-full w-full object-cover grayscale"
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-5">
            <Link
              prefetch="intent"
              to={lineItemUrl}
              onClick={closeIfAside}
              className="min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <h3 className="display text-[0.9rem] leading-tight transition-colors duration-500 hover:text-gold-deep">
                {product.title}
              </h3>
            </Link>
            <ProductPrice
              price={line?.cost?.totalAmount}
              className="shrink-0 text-sm text-gold-deep"
            />
          </div>

          {selectedOptions?.length ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {selectedOptions.map((option) => (
                <li
                  key={option.name}
                  className="text-[0.7rem] uppercase tracking-[0.14em] text-steel"
                >
                  {option.name}: {option.value}
                </li>
              ))}
            </ul>
          ) : null}

          <CartLineQuantity line={line} />
        </div>
      </div>

      {lineItemChildren ? (
        <div>
          <p id={childrenLabelId} className="sr-only">
            Line items with {product.title}
          </p>
          <ul
            aria-labelledby={childrenLabelId}
            className="mt-2 border-l rule pl-5 [&>li:last-child]:border-b-0 [&>li]:py-4"
          >
            {lineItemChildren.map((childLine) => (
              <CartLineItem
                childrenMap={childrenMap}
                key={childLine.id}
                line={childLine}
                layout={layout}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 * @param {{line: CartLine}}
 */
function CartLineQuantity({line}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center border border-onyx/15">
        <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
          <button
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || !!isOptimistic}
            name="decrease-quantity"
            value={prevQuantity}
            className={STEP_BUTTON}
          >
            <span aria-hidden="true">&#8722;</span>
          </button>
        </CartLineUpdateButton>
        <span className="tabular w-9 select-none text-center text-sm">
          {quantity}
        </span>
        <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
          <button
            aria-label="Increase quantity"
            name="increase-quantity"
            value={nextQuantity}
            disabled={!!isOptimistic}
            className={STEP_BUTTON}
          >
            <span aria-hidden="true">&#43;</span>
          </button>
        </CartLineUpdateButton>
      </div>
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 * @param {{
 *   lineIds: string[];
 *   disabled: boolean;
 * }}
 */
function CartLineRemoveButton({lineIds, disabled}) {
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <button
        disabled={disabled}
        type="submit"
        className="text-[0.7rem] uppercase tracking-[0.18em] text-steel underline underline-offset-4 transition-colors duration-300 hover:text-onyx disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Remove
      </button>
    </CartForm>
  );
}

/**
 * @param {{
 *   children: React.ReactNode;
 *   lines: CartLineUpdateInput[];
 * }}
 */
function CartLineUpdateButton({children, lines}) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @returns
 * @param {string[]} lineIds - line ids affected by the update
 */
function getUpdateKey(lineIds) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}

/** @typedef {OptimisticCartLine<CartApiQueryFragment>} CartLine */

/** @typedef {import('@shopify/hydrogen/storefront-api-types').CartLineUpdateInput} CartLineUpdateInput */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('~/components/CartMain').LineItemChildrenMap} LineItemChildrenMap */
/** @typedef {import('@shopify/hydrogen').OptimisticCartLine} OptimisticCartLine */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('storefrontapi.generated').CartLineFragment} CartLineFragment */
