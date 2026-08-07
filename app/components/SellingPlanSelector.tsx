/**
 * Subscription purchase options on a product page.
 *
 * ─── THE ONE RULE IN THIS FILE ───────────────────────────────────────────
 * Every dollar figure rendered here comes from Shopify, as a `MoneyV2`, and is
 * printed with `<Money>`. Nothing in this file multiplies, discounts, divides
 * or rounds money. The discounted rate is whatever `sellingPlanAllocation
 * .priceAdjustments` says it is, because that is the number checkout will
 * charge — a locally recomputed "20% off" would eventually disagree with the
 * receipt, and the customer would be shown a price they are not charged.
 *
 * `~/lib/offerings` is imported for LABELS ONLY (`TERMS[*].label`,
 * `.shortLabel`, `.cancelCopy`). Its money is WHOLE DOLLARS as plain numbers
 * and must never meet a Shopify `MoneyV2` — no number crosses that boundary
 * here, and `formatMoney` is deliberately not imported.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * VISUAL LANGUAGE — the term chips on /train and the option chips in
 * `ProductForm`: hairline bordered rectangles, uppercase display type at wide
 * tracking, selected state is a solid onyx fill (not gold — brand gold is
 * 1.87:1 on stone and is never a text colour). Nothing here is round.
 *
 * COMPLIANCE — California's Automatic Renewal Law (Bus & Prof Code 17600 et
 * seq., as amended by AB 2863, effective July 2025) and federal ROSCA. Jesse
 * sells from Riverside to California families, so both apply:
 *   - Preselecting the twelve-month PLAN is lawful and intended. Pre-checking
 *     CONSENT is not: `consented` starts false on every render and on every
 *     plan change, and it is one separate affirmative action tied specifically
 *     to the auto-renewal — not a general terms box, not fine print under the
 *     submit button.
 *   - The disclosures sit in visual proximity to that consent, set off in
 *     larger contrasting type rather than body copy.
 *   - Cancellation is completable online at /account/subscriptions.
 * This is researched fact, not legal advice. A California attorney should
 * review this flow before launch.
 *
 * WHAT SHOPIFY WILL NOT TELL US: the Storefront API's
 * `SellingPlanRecurringBillingPolicy` exposes only `interval` and
 * `intervalCount`. There is no `minCycles`. So the minimum commitment — which
 * the ARL requires us to disclose — can only come from the selling plan's own
 * merchant-authored `description`. A renewing plan with an empty description
 * is therefore genuinely unsellable, and this file renders an explicit
 * disabled state naming what is missing rather than guessing at a term or
 * quietly omitting the disclosure. See `blockedReason`.
 */

import {useCallback, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router';
import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
// Labels only. See the header note — no money crosses this import.
import {TERMS} from '~/lib/offerings';

/* ------------------------------------------------------------------ */
/* The shapes we read off the loader                                   */
/* ------------------------------------------------------------------ */

export interface SellingPlanNode {
  id: string;
  name: string;
  description?: string | null;
  recurringDeliveries?: boolean | null;
  options?: Array<{name?: string | null; value?: string | null}> | null;
  billingPolicy?: {
    __typename?: string;
    interval?: string | null;
    intervalCount?: number | null;
  } | null;
}

export interface SellingPlanGroupNode {
  appName?: string | null;
  name?: string | null;
  sellingPlans?: {nodes?: SellingPlanNode[] | null} | null;
}

export interface SellingPlanAllocationNode {
  checkoutChargeAmount?: MoneyV2 | null;
  remainingBalanceChargeAmount?: MoneyV2 | null;
  sellingPlan?: {id?: string | null} | null;
  priceAdjustments?: Array<{
    compareAtPrice?: MoneyV2 | null;
    perDeliveryPrice?: MoneyV2 | null;
    price?: MoneyV2 | null;
  }> | null;
}

interface VariantLike {
  id?: string | null;
  price?: MoneyV2 | null;
  compareAtPrice?: MoneyV2 | null;
  sellingPlanAllocations?: {
    nodes?: SellingPlanAllocationNode[] | null;
  } | null;
}

interface ProductLike {
  requiresSellingPlan?: boolean | null;
  sellingPlanGroups?: {nodes?: SellingPlanGroupNode[] | null} | null;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** The search param a selection writes, so a choice is shareable. */
export const SELLING_PLAN_PARAM = 'selling_plan';

/**
 * The value that means "no plan, buy it once". A real plan id is a gid, so
 * this can never collide with one.
 */
export const ONE_TIME_VALUE = 'none';

/**
 * The cancel sentence, taken verbatim from the pricing engine so the promise
 * made on the product page and the promise made on /train are the same string.
 */
const CANCEL_COPY = TERMS.m12.cancelCopy;

/** Words that identify the twelve-month plan, so it can be preselected. */
const TWELVE_MONTH_ALIASES = [
  TERMS.m12.label, // '12 months'
  TERMS.m12.shortLabel, // '12 mo'
  '12 month',
  '12month',
  '1 year',
  'one year',
  'annual',
  'annually',
  'yearly',
];

/* ------------------------------------------------------------------ */
/* Small pure helpers                                                  */
/* ------------------------------------------------------------------ */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `every month`, `every 2 months` — built from Shopify's billing policy. */
function frequencyLabel(plan: SellingPlanNode): string | null {
  const policy = plan.billingPolicy;
  if (!policy?.interval) return null;
  const unit = policy.interval.toLowerCase();
  const count = policy.intervalCount ?? 1;
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}

/**
 * Does this plan actually create a recurring charge? Read off the billing
 * policy, not off the plan's name — a name is copy, a billing policy is what
 * Shopify will do.
 */
function planRenews(plan: SellingPlanNode): boolean {
  return Boolean(plan.billingPolicy?.interval);
}

function moneyAmount(money?: MoneyV2 | null): number | null {
  if (!money?.amount) return null;
  const parsed = Number(money.amount);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameMoney(a?: MoneyV2 | null, b?: MoneyV2 | null): boolean {
  if (!a || !b) return false;
  return (
    a.currencyCode === b.currencyCode && Number(a.amount) === Number(b.amount)
  );
}

/**
 * The short strings that NAME a plan — its title and its option values
 * ('Delivery every' / '12 Months'). Deliberately excludes `description`: that
 * is prose, and prose about a three-month plan can easily mention twelve
 * months without being one.
 */
function planNameText(plan: SellingPlanNode): string[] {
  const parts: string[] = [plan.name];
  for (const option of plan.options ?? []) {
    if (option?.value) parts.push(option.value);
  }
  return parts.filter(Boolean).map((part) => normalize(String(part)));
}

function looksLikeTwelveMonths(nameText: string[]): boolean {
  return TWELVE_MONTH_ALIASES.some((alias) => {
    const needle = normalize(alias);
    return nameText.some((text) => text.includes(needle));
  });
}

/* ------------------------------------------------------------------ */
/* The resolved option a chip renders                                  */
/* ------------------------------------------------------------------ */

export interface PurchaseOption {
  /** A selling plan gid, or `ONE_TIME_VALUE`. */
  id: string;
  isOneTime: boolean;
  /** Chip label. The merchant's plan name, or 'One-time'. */
  label: string;
  /**
   * The merchant-authored terms for this plan. On a renewing plan this is the
   * ONLY place the minimum commitment can come from — see the file header.
   */
  description: string | null;
  /** What is charged per delivery. Straight from Shopify. Never computed. */
  price: MoneyV2 | null;
  /** A second adjustment, when the plan steps its price after N orders. */
  laterPrice: MoneyV2 | null;
  /** Due at checkout, when it differs from `price` (prepaid / deferred plans). */
  checkoutChargeAmount: MoneyV2 | null;
  /** Owed later on a deferred plan. Null when there is no balance. */
  remainingBalanceChargeAmount: MoneyV2 | null;
  renews: boolean;
  /** `every month`. Null on a one-time purchase. */
  frequency: string | null;
  /** Non-null when this option cannot be sold, and says exactly why. */
  blockedReason: string | null;
  /** Which app authored the plan group ('Recurpay'), for the ops footnote. */
  appName: string | null;
  /** Normalised name + option values, used only to preselect twelve months. */
  matchText: string[];
}

export interface SellingPlanState {
  /** False today — no plans exist yet. The UI must render nothing when false. */
  hasPlans: boolean;
  options: PurchaseOption[];
  selected: PurchaseOption | null;
  /** The value to put on the cart line. Undefined for a one-time purchase. */
  sellingPlanId: string | undefined;
  choose: (id: string) => void;
  /** Price to lead the page with — the plan's rate, or the variant's. */
  displayPrice: MoneyV2 | null;
  /** Struck through beside it: the one-off rate for the same single delivery. */
  displayCompareAtPrice: MoneyV2 | null;
  /** `/mo` when the selection recurs. */
  priceSuffix: string;
  consented: boolean;
  setConsented: (value: boolean) => void;
  /** True when the selection renews and therefore needs affirmative consent. */
  requiresConsent: boolean;
  /** True when the selection cannot be sold at all. */
  blocked: boolean;
  blockedReason: string | null;
  /** False when the buyer still owes us an action, or the plan is unsellable. */
  canPurchase: boolean;
  /** Why `canPurchase` is false. Null when it is true. */
  purchaseBlockedReason: string | null;
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

/**
 * Resolves the purchase options for the selected variant and keeps the choice
 * in the URL.
 *
 * Hydration-safe by construction: the default selection is a pure function of
 * loader data and the search params, so the server render and the browser
 * agree. Nothing here reads `window`, and no effect writes the param on mount.
 */
export function useSellingPlans(
  product: ProductLike | null | undefined,
  selectedVariant: VariantLike | null | undefined,
): SellingPlanState {
  const [searchParams, setSearchParams] = useSearchParams();
  /**
   * The plan id consent was given FOR, rather than a bare boolean — changing
   * the plan therefore withdraws consent automatically, with no effect and no
   * chance of a stale tick surviving a change of terms.
   */
  const [consentFor, setConsentFor] = useState<string | null>(null);

  const options = useMemo(
    () => buildOptions(product, selectedVariant),
    [product, selectedVariant],
  );

  const requestedId = searchParams.get(SELLING_PLAN_PARAM);
  const selected = useMemo(
    () => resolveSelected(options, requestedId),
    [options, requestedId],
  );

  const choose = useCallback(
    (id: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(SELLING_PLAN_PARAM, id);
          return next;
        },
        {replace: true, preventScrollReset: true},
      );
    },
    [setSearchParams],
  );

  const setConsented = useCallback(
    (value: boolean) => {
      setConsentFor(value && selected ? selected.id : null);
    },
    [selected],
  );

  const hasPlans = options.some((option) => !option.isOneTime);
  const requiresConsent = Boolean(selected?.renews);
  const consented = Boolean(selected && consentFor === selected.id);
  const blocked = Boolean(selected?.blockedReason);

  let purchaseBlockedReason: string | null = null;
  if (selected?.blockedReason) {
    purchaseBlockedReason = selected.blockedReason;
  } else if (requiresConsent && !consented) {
    purchaseBlockedReason =
      'Confirm you agree to the automatic renewal before adding this to your cart.';
  }

  const variantPrice = selectedVariant?.price ?? null;
  const showsPlanPrice = Boolean(
    selected && !selected.isOneTime && selected.price,
  );

  return {
    hasPlans,
    options,
    selected,
    sellingPlanId:
      selected && !selected.isOneTime && !selected.blockedReason
        ? selected.id
        : undefined,
    choose,
    displayPrice: showsPlanPrice ? selected!.price : variantPrice,
    // Compare the plan's per-delivery rate against the variant's own one-off
    // price. Deliberately NOT the allocation's `compareAtPrice`, which is the
    // list price for the whole run of deliveries — striking that through
    // beside a single month's rate would misstate the saving by an order of
    // magnitude.
    displayCompareAtPrice: showsPlanPrice
      ? sameMoney(selected!.price, variantPrice)
        ? null
        : variantPrice
      : (selectedVariant?.compareAtPrice ?? null),
    priceSuffix: selected?.renews ? '/mo' : '',
    consented,
    setConsented,
    requiresConsent,
    blocked,
    blockedReason: selected?.blockedReason ?? null,
    canPurchase: purchaseBlockedReason === null,
    purchaseBlockedReason,
  };
}

function buildOptions(
  product: ProductLike | null | undefined,
  selectedVariant: VariantLike | null | undefined,
): PurchaseOption[] {
  const groups = product?.sellingPlanGroups?.nodes ?? [];
  const allocations = selectedVariant?.sellingPlanAllocations?.nodes ?? [];

  const byPlanId = new Map<string, SellingPlanAllocationNode>();
  for (const allocation of allocations) {
    const id = allocation?.sellingPlan?.id;
    if (id) byPlanId.set(id, allocation);
  }

  const plans: PurchaseOption[] = [];
  for (const group of groups) {
    for (const plan of group?.sellingPlans?.nodes ?? []) {
      if (!plan?.id) continue;
      // A plan the merchant has not made available for THIS variant has no
      // allocation, and therefore no price we are allowed to state. Drop it
      // rather than render a chip that cannot quote a figure.
      const allocation = byPlanId.get(plan.id);
      if (!allocation) continue;

      const adjustments = allocation.priceAdjustments ?? [];
      const first = adjustments[0];
      const second = adjustments[1];
      const price = first?.perDeliveryPrice ?? first?.price ?? null;
      const laterPrice = second?.perDeliveryPrice ?? second?.price ?? null;

      const renews = planRenews(plan);
      const description = plan.description?.trim() || null;

      plans.push({
        id: plan.id,
        isOneTime: false,
        label: plan.name || 'Subscribe',
        description,
        price,
        laterPrice:
          laterPrice && !sameMoney(laterPrice, price) ? laterPrice : null,
        checkoutChargeAmount:
          allocation.checkoutChargeAmount &&
          !sameMoney(allocation.checkoutChargeAmount, price)
            ? allocation.checkoutChargeAmount
            : null,
        remainingBalanceChargeAmount:
          (moneyAmount(allocation.remainingBalanceChargeAmount) ?? 0) > 0
            ? (allocation.remainingBalanceChargeAmount ?? null)
            : null,
        renews,
        frequency: frequencyLabel(plan),
        appName: group?.appName ?? null,
        matchText: planNameText(plan),
        // See the file header: the Storefront API has no `minCycles`, so a
        // renewing plan whose merchant-authored description is empty cannot
        // disclose its minimum term, and must not be sold.
        blockedReason:
          renews && !description
            ? 'This plan is missing its renewal terms in Shopify. Its selling plan description must state the recurring amount, the minimum term and how to cancel before it can be sold. Jesse or whoever manages the store unblocks this in Shopify admin → Products → Purchase options.'
            : null,
      });
    }
  }

  if (plans.length === 0) return [];

  // Only offer a one-time chip when the product can genuinely be bought once.
  const oneTimeAllowed = product?.requiresSellingPlan !== true;
  if (!oneTimeAllowed) return plans;

  const oneTime: PurchaseOption = {
    id: ONE_TIME_VALUE,
    isOneTime: true,
    label: TERMS.once.label, // 'One-off'
    description: TERMS.once.blurb,
    price: selectedVariant?.price ?? null,
    laterPrice: null,
    checkoutChargeAmount: null,
    remainingBalanceChargeAmount: null,
    renews: false,
    frequency: null,
    appName: null,
    matchText: [],
    blockedReason: null,
  };

  return [oneTime, ...plans];
}

/**
 * The URL wins; otherwise the twelve-month plan; otherwise the deepest
 * discount; otherwise the first plan.
 *
 * The "deepest discount" fallback RANKS Shopify's own figures — it never
 * derives one. Under the client's matrix the deepest discount is the twelve
 * month plan, so the fallback lands on the same chip as the name match.
 */
function resolveSelected(
  options: PurchaseOption[],
  requestedId: string | null,
): PurchaseOption | null {
  if (options.length === 0) return null;

  if (requestedId) {
    const requested = options.find((option) => option.id === requestedId);
    if (requested) return requested;
    // An unknown or stale id falls through to the default rather than
    // stranding the buyer on nothing.
  }

  const plans = options.filter((option) => !option.isOneTime);
  if (plans.length === 0) return options[0];

  const twelve = plans.find((option) =>
    looksLikeTwelveMonths(option.matchText),
  );
  if (twelve) return twelve;

  let best = plans[0];
  let bestAmount = moneyAmount(best.price);
  for (const plan of plans.slice(1)) {
    const amount = moneyAmount(plan.price);
    if (amount !== null && (bestAmount === null || amount < bestAmount)) {
      best = plan;
      bestAmount = amount;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* The control                                                         */
/* ------------------------------------------------------------------ */

const CHIP_BASE =
  'relative flex min-w-[8.5rem] flex-1 flex-col items-start gap-1 border px-4 py-3 text-left ' +
  'font-display text-[0.7rem] font-semibold uppercase tracking-[0.14em] ' +
  'transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

function chipClass(selected: boolean): string {
  return [
    CHIP_BASE,
    selected
      ? 'border-onyx bg-onyx text-stone'
      : 'border-onyx/20 text-onyx hover:border-onyx',
  ].join(' ');
}

/**
 * The chips, the disclosures and the consent control.
 *
 * Renders nothing at all when the product has no selling plans — no empty
 * heading, no disabled chip, no dead control. That is the state today: no
 * plans exist in Shopify yet, so a product page must look exactly as it did
 * before this component was added.
 */
export function SellingPlanSelector({state}: {state: SellingPlanState}) {
  const {options, selected, choose, requiresConsent, consented, setConsented} =
    state;

  if (!state.hasPlans || options.length === 0 || !selected) return null;

  const disclosureId = 'selling-plan-terms';

  return (
    <div className="mb-10 border-t rule pt-6">
      <h2 className="tag mb-4 text-steel">HOW OFTEN</h2>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Purchase options"
      >
        {options.map((option) => {
          const isSelected = option.id === selected.id;
          return (
            <button
              type="button"
              key={option.id}
              className={chipClass(isSelected)}
              aria-pressed={isSelected}
              onClick={() => {
                if (!isSelected) choose(option.id);
              }}
            >
              <span>{option.label}</span>
              {option.price ? (
                <span className="tabular text-[0.8rem] font-normal normal-case tracking-normal">
                  <Money as="span" data={option.price} />
                  {option.renews ? (
                    <span className="opacity-70">/mo</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected.blockedReason ? (
        <p
          className="mt-5 border-l-2 border-gold-deep py-1 pl-4 text-sm leading-relaxed text-onyx"
          role="status"
        >
          {selected.blockedReason}
        </p>
      ) : null}

      {selected.renews && !selected.blockedReason ? (
        <>
          {/*
            Clear and conspicuous, set off from body copy: a two-pixel onyx
            frame, a tinted ground, and type a step larger than the paragraph
            below the Add to cart button. Sits immediately above the consent
            control it belongs to.
          */}
          <div
            id={disclosureId}
            className="mt-6 border-2 border-onyx bg-onyx/[0.04] p-5"
          >
            <p className="font-display text-[0.72rem] font-bold uppercase tracking-[0.16em] text-onyx">
              This plan renews automatically until you cancel
            </p>
            <ul className="mt-3 space-y-2 text-[0.95rem] leading-relaxed text-onyx">
              {selected.price ? (
                <li className="tabular">
                  <Money as="span" data={selected.price} />
                  {selected.frequency ? ` ${selected.frequency}` : ''}, charged
                  automatically.
                  {selected.laterPrice ? (
                    <>
                      {' '}
                      Then <Money as="span" data={selected.laterPrice} />{' '}
                      {selected.frequency ?? ''} after that.
                    </>
                  ) : null}
                </li>
              ) : null}
              {selected.checkoutChargeAmount ? (
                <li className="tabular">
                  Due today:{' '}
                  <Money as="span" data={selected.checkoutChargeAmount} />
                  {selected.remainingBalanceChargeAmount ? (
                    <>
                      {' '}
                      · Balance{' '}
                      <Money
                        as="span"
                        data={selected.remainingBalanceChargeAmount}
                      />
                      .
                    </>
                  ) : null}
                </li>
              ) : null}
              {/*
                The minimum commitment, verbatim from the selling plan's own
                description in Shopify. We never paraphrase it and never infer
                it — the Storefront API does not expose `minCycles`, and a plan
                without this text is blocked above rather than guessed at.
              */}
              {selected.description ? <li>{selected.description}</li> : null}
              <li>{CANCEL_COPY}</li>
            </ul>
            <p className="mt-4">
              <Link
                to="/account/subscriptions"
                prefetch="intent"
                className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-onyx underline decoration-gold decoration-2 underline-offset-4"
              >
                Manage or cancel in your account
              </Link>
            </p>
            {/*
              PRE_RENEWAL_NOTICE_WIRED in ~/lib/offerings is false, so nothing
              here promises a renewal reminder. California requires one 15–45
              days before a twelve-month term renews; promising it before the
              send is wired would be both a lie and the exact failure the
              notice exists to prevent.
            */}
          </div>

          {/*
            ONE separate affirmative action, tied specifically to the
            auto-renewal. Initially unchecked, always — `consentFor` resets to
            null whenever the plan changes. Preselecting the twelve-month plan
            is lawful; pre-checking this is not.
          */}
          <div className="mt-5 flex items-start gap-3">
            <input
              id="selling-plan-consent"
              name="sellingPlanConsent"
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.currentTarget.checked)}
              aria-describedby={disclosureId}
              className="mt-1 h-[1.15rem] w-[1.15rem] shrink-0 accent-[color:var(--onyx)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            />
            <label
              htmlFor="selling-plan-consent"
              className="text-[0.95rem] leading-relaxed text-onyx"
            >
              I agree to a recurring charge{' '}
              {selected.frequency ? `${selected.frequency} ` : ''}that continues
              automatically until I cancel.
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
