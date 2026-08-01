import {useId} from 'react';
import {useOptimisticCart} from '@shopify/hydrogen';
import {Link} from 'react-router';
import {useAside} from '~/components/Aside';
import {CartLineItem} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
/**
 * Returns a map of all line items and their children.
 * @param {CartLine[]} lines
 * @return {import("/Users/samsutton/JVGold/hydrogen/app/components/CartMain").LineItemChildrenMap}
 */
function getLineItemChildrenMap(lines) {
  const children = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const lineChildren = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(lineChildren)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 *
 * The page layout reads like a receipt: the lines run down the left in a
 * hairline-ruled column, the totals sit in a sticky panel on the right.
 * The aside layout stacks the same pieces into the drawer with the lines
 * scrolling and the totals pinned to the bottom.
 * @param {CartMainProps}
 */
export function CartMain({layout, cart: originalCart}) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);
  const linesId = useId();

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const isPage = layout === 'page';
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);

  return (
    <section
      className={
        isPage ? '' : 'flex max-h-[calc(100dvh-7.5rem)] min-h-0 flex-col'
      }
      aria-label={isPage ? 'Cart page' : 'Cart drawer'}
    >
      <CartEmpty hidden={linesCount} layout={layout} />

      {linesCount ? (
        <div
          className={
            isPage
              ? 'grid items-start gap-14 lg:grid-cols-[1.55fr_1fr] lg:gap-20'
              : 'flex min-h-0 flex-1 flex-col'
          }
        >
          <div className={isPage ? '' : 'min-h-0 flex-1 overflow-y-auto pr-1'}>
            <p id={linesId} className="sr-only">
              Line items
            </p>
            <ul aria-labelledby={linesId} className="border-t rule">
              {(cart?.lines?.nodes ?? []).map((line) => {
                // we do not render non-parent lines at the root of the cart
                if (
                  'parentRelationship' in line &&
                  line.parentRelationship?.parent
                ) {
                  return null;
                }
                return (
                  <CartLineItem
                    key={line.id}
                    line={line}
                    layout={layout}
                    childrenMap={childrenMap}
                  />
                );
              })}
            </ul>
          </div>
          {cartHasItems && <CartSummary cart={cart} layout={layout} />}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{
 *   hidden: boolean;
 *   layout?: CartMainProps['layout'];
 * }}
 */
function CartEmpty({hidden = false, layout}) {
  const {close} = useAside();
  const isPage = layout === 'page';

  return (
    <div hidden={hidden} className={isPage ? 'max-w-lg' : 'pt-2'}>
      <p className="tag text-gold-deep">NOTHING IN THE BAG</p>
      <p
        className={`display mt-5 ${
          isPage ? 'text-[clamp(1.9rem,4vw,3.2rem)]' : 'text-xl'
        }`}
      >
        Empty, for now.
      </p>
      <p className="mt-5 text-sm leading-relaxed text-onyx/70">
        Everything in the shop is cut in small runs and built to survive a
        season in the room. Start with the full collection.
      </p>
      <Link
        to="/collections"
        onClick={close}
        prefetch="viewport"
        className="mt-8 inline-block border border-onyx px-7 py-4 font-display text-[0.7rem] font-bold uppercase tracking-[0.18em] transition-colors duration-500 hover:bg-onyx hover:text-stone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Browse the shop
      </Link>
    </div>
  );
}

/** @typedef {'page' | 'aside'} CartLayout */
/**
 * @typedef {{
 *   cart: CartApiQueryFragment | null;
 *   layout: CartLayout;
 * }} CartMainProps
 */
/** @typedef {{[parentId: string]: CartLine[]}} LineItemChildrenMap */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('~/components/CartLineItem').CartLine} CartLine */
