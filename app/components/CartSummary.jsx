import {CartForm, Money} from '@shopify/hydrogen';
import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';

const FIELD =
  'min-w-0 flex-1 border-b rule bg-transparent py-2 text-sm text-onyx ' +
  'placeholder:text-steel focus:border-gold focus:outline-none';

const INLINE_ACTION =
  'shrink-0 font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] ' +
  'text-onyx underline underline-offset-4 transition-colors duration-300 ' +
  'hover:text-gold-deep disabled:cursor-not-allowed disabled:opacity-40 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

/**
 * The totals panel. On the cart page it becomes a sticky column beside the
 * lines; in the drawer it pins to the bottom of the panel.
 * @param {CartSummaryProps}
 */
export function CartSummary({cart, layout}) {
  const isPage = layout === 'page';
  const summaryId = useId();
  const discountsHeadingId = useId();
  const discountCodeInputId = useId();
  const giftCardHeadingId = useId();
  const giftCardInputId = useId();

  return (
    <div
      aria-labelledby={summaryId}
      className={
        isPage
          ? 'w-full border-t rule pt-8 lg:sticky lg:top-28 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12'
          : 'shrink-0 border-t rule pt-5'
      }
    >
      <h2 id={summaryId} className="tag text-gold-deep">
        THE TOTAL
      </h2>

      <dl className="mt-6 flex items-baseline justify-between gap-6 border-b rule pb-5">
        <dt className="text-[0.7rem] uppercase tracking-[0.18em] text-steel">
          Subtotal
        </dt>
        <dd className="tabular display text-[1.35rem] text-onyx">
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money as="span" data={cart?.cost?.subtotalAmount} />
          ) : (
            '—'
          )}
        </dd>
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-steel">
        Shipping and taxes are calculated at checkout.
      </p>

      <CartDiscounts
        discountCodes={cart?.discountCodes}
        discountsHeadingId={discountsHeadingId}
        discountCodeInputId={discountCodeInputId}
      />
      <CartGiftCard
        giftCardCodes={cart?.appliedGiftCards}
        giftCardHeadingId={giftCardHeadingId}
        giftCardInputId={giftCardInputId}
      />
      <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} />
    </div>
  );
}

/**
 * @param {{checkoutUrl?: string}}
 */
function CartCheckoutActions({checkoutUrl}) {
  if (!checkoutUrl) return null;

  return (
    <a
      href={checkoutUrl}
      target="_self"
      className="mt-9 block w-full bg-gold px-6 py-[1.15rem] text-center font-display text-[0.75rem] font-bold uppercase tracking-[0.16em] text-onyx-deep transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-onyx hover:text-stone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      Continue to checkout
    </a>
  );
}

/**
 * @param {{
 *   discountCodes?: CartApiQueryFragment['discountCodes'];
 *   discountsHeadingId: string;
 *   discountCodeInputId: string;
 * }}
 */
function CartDiscounts({
  discountCodes,
  discountsHeadingId,
  discountCodeInputId,
}) {
  const codes =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <section aria-label="Discounts" className="mt-8">
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length} className="mb-4">
        <div>
          <dt
            id={discountsHeadingId}
            className="text-[0.68rem] uppercase tracking-[0.18em] text-steel"
          >
            Discount
          </dt>
          <UpdateDiscountForm>
            <dd
              className="mt-2 flex items-center justify-between gap-4"
              role="group"
              aria-labelledby={discountsHeadingId}
            >
              <code className="tabular truncate text-sm text-gold-deep">
                {codes?.join(', ')}
              </code>
              <button
                type="submit"
                aria-label="Remove discount"
                className={INLINE_ACTION}
              >
                Remove
              </button>
            </dd>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateDiscountForm discountCodes={codes}>
        <div className="flex items-end gap-4">
          <label htmlFor={discountCodeInputId} className="sr-only">
            Discount code
          </label>
          <input
            id={discountCodeInputId}
            type="text"
            name="discountCode"
            placeholder="Discount code"
            className={FIELD}
          />
          <button
            type="submit"
            aria-label="Apply discount code"
            className={INLINE_ACTION}
          >
            Apply
          </button>
        </div>
      </UpdateDiscountForm>
    </section>
  );
}

/**
 * @param {{
 *   discountCodes?: string[];
 *   children: React.ReactNode;
 * }}
 */
function UpdateDiscountForm({discountCodes, children}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

/**
 * @param {{
 *   giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
 *   giftCardHeadingId: string;
 *   giftCardInputId: string;
 * }}
 */
function CartGiftCard({giftCardCodes, giftCardHeadingId, giftCardInputId}) {
  const giftCardCodeInput = useRef(null);
  const removeButtonRefs = useRef(new Map());
  const previousCardIdsRef = useRef([]);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});
  const [removedCardIndex, setRemovedCardIndex] = useState(null);

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      if (giftCardCodeInput.current !== null) {
        giftCardCodeInput.current.value = '';
      }
    }
  }, [giftCardAddFetcher.data]);

  useEffect(() => {
    const currentCardIds = giftCardCodes?.map((card) => card.id) || [];

    if (removedCardIndex !== null && giftCardCodes) {
      const focusTargetIndex = Math.min(
        removedCardIndex,
        giftCardCodes.length - 1,
      );
      const focusTargetCard = giftCardCodes[focusTargetIndex];
      const focusButton = focusTargetCard
        ? removeButtonRefs.current.get(focusTargetCard.id)
        : null;

      if (focusButton) {
        focusButton.focus();
      } else if (giftCardCodeInput.current) {
        giftCardCodeInput.current.focus();
      }

      setRemovedCardIndex(null);
    }

    previousCardIdsRef.current = currentCardIds;
  }, [giftCardCodes, removedCardIndex]);

  const handleRemoveClick = (cardId) => {
    const index = previousCardIdsRef.current.indexOf(cardId);
    if (index !== -1) {
      setRemovedCardIndex(index);
    }
  };

  return (
    <section aria-label="Gift cards" className="mt-6">
      {giftCardCodes && giftCardCodes.length > 0 && (
        <dl className="mb-4">
          <dt
            id={giftCardHeadingId}
            className="text-[0.68rem] uppercase tracking-[0.18em] text-steel"
          >
            Applied gift cards
          </dt>
          {giftCardCodes.map((giftCard) => (
            <dd key={giftCard.id} className="mt-2">
              <RemoveGiftCardForm
                giftCardId={giftCard.id}
                lastCharacters={giftCard.lastCharacters}
                onRemoveClick={() => handleRemoveClick(giftCard.id)}
                buttonRef={(el) => {
                  if (el) {
                    removeButtonRefs.current.set(giftCard.id, el);
                  } else {
                    removeButtonRefs.current.delete(giftCard.id);
                  }
                }}
              >
                <span className="tabular flex items-baseline gap-3 text-sm text-gold-deep">
                  <code>&#8226;&#8226;&#8226;{giftCard.lastCharacters}</code>
                  <Money as="span" data={giftCard.amountUsed} />
                </span>
              </RemoveGiftCardForm>
            </dd>
          ))}
        </dl>
      )}

      <AddGiftCardForm fetcherKey="gift-card-add">
        <div className="flex items-end gap-4">
          <label htmlFor={giftCardInputId} className="sr-only">
            Gift card code
          </label>
          <input
            id={giftCardInputId}
            type="text"
            name="giftCardCode"
            placeholder="Gift card code"
            ref={giftCardCodeInput}
            className={FIELD}
          />
          <button
            type="submit"
            disabled={giftCardAddFetcher.state !== 'idle'}
            aria-label="Apply gift card code"
            className={INLINE_ACTION}
          >
            Apply
          </button>
        </div>
      </AddGiftCardForm>
    </section>
  );
}

/**
 * @param {{
 *   fetcherKey?: string;
 *   children: React.ReactNode;
 * }}
 */
function AddGiftCardForm({fetcherKey, children}) {
  return (
    <CartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
    >
      {children}
    </CartForm>
  );
}

/**
 * @param {{
 *   giftCardId: string;
 *   lastCharacters: string;
 *   children: React.ReactNode;
 *   onRemoveClick?: () => void;
 *   buttonRef?: (el: HTMLButtonElement | null) => void;
 * }}
 */
function RemoveGiftCardForm({
  giftCardId,
  lastCharacters,
  children,
  onRemoveClick,
  buttonRef,
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
    >
      <span className="flex items-center justify-between gap-4">
        {children}
        <button
          type="submit"
          aria-label={`Remove gift card ending in ${lastCharacters}`}
          onClick={onRemoveClick}
          ref={buttonRef}
          className={INLINE_ACTION}
        >
          Remove
        </button>
      </span>
    </CartForm>
  );
}

/**
 * @typedef {{
 *   cart: OptimisticCart<CartApiQueryFragment | null>;
 *   layout: CartLayout;
 * }} CartSummaryProps
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('@shopify/hydrogen').OptimisticCart} OptimisticCart */
