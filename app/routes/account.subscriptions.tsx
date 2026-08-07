/**
 * /account/subscriptions — the customer's own plans, and the button that ends
 * them.
 *
 * WHY THIS LIVES HERE AND NOT BEHIND A LINK TO SHOPIFY
 * The Customer Account API scope that lets a shopper cancel their own contract
 * (`write_own_subscription_contracts`, exposed to headless apps as
 * `customer_write_subscription_contracts`) is documented as available only to
 * Hydrogen and headless storefronts. So the cancel path has to be on our
 * domain. That is also what the law wants: California's Automatic Renewal Law
 * (Bus & Prof Code 17600 et seq., as amended by AB 2863, effective July 2025)
 * requires cancellation to be completable ONLINE, at will, without extra
 * steps — no phone call, no email, no retention gauntlet. Federal ROSCA
 * applies too; the FTC's click-to-cancel rule was vacated in July 2025 but
 * ROSCA itself was not.
 *
 * This is researched fact, not legal advice. A California attorney should
 * review this flow before launch.
 *
 * HONESTY
 * Nothing on this screen is simulated. If Customer Accounts is not configured,
 * or the subscription scopes have not been granted to the headless app, the
 * page says exactly what is missing and who unblocks it, and renders NO cancel
 * button — a button that cannot cancel is worse than no button, because the
 * customer walks away believing they are no longer being charged.
 *
 * DATES
 * Every date is formatted on the server, in Jesse's timezone, into a plain
 * string. No `new Date()` ever runs in a component: the server is UTC and the
 * browser is Pacific, and React would throw a hydration mismatch.
 *
 * MONEY
 * All figures come from Shopify as MoneyV2 decimal strings. The only
 * arithmetic is summing a contract's own line amounts into a subtotal, done in
 * integer minor units and labelled a SUBTOTAL — the Customer Account API
 * exposes no contract total, and tax is applied at billing, so this page never
 * claims to know the exact amount that will be charged.
 * (Unrelated to `~/lib/ops` cents and to `~/lib/offerings` dollars. Neither is
 * imported here, and no number crosses between them.)
 */

import {useState} from 'react';
import {
  data as routerData,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

export const meta = () => [{title: 'Subscriptions'}];

/* ------------------------------------------------------------------ */
/* GraphQL                                                             */
/* ------------------------------------------------------------------ */

const SUBSCRIPTION_CONTRACTS_QUERY = `#graphql
  query CustomerSubscriptionContracts($first: Int!) {
    customer {
      subscriptionContracts(first: $first) {
        nodes {
          id
          status
          createdAt
          nextBillingDate
          lastPaymentStatus
          currencyCode
          billingPolicy {
            interval
            intervalCount
            minCycles
            maxCycles
          }
          deliveryPrice {
            amount
            currencyCode
          }
          lines(first: 25) {
            nodes {
              id
              name
              title
              variantTitle
              quantity
              currentPrice {
                amount
                currencyCode
              }
              lineDiscountedPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
` as const;

const SUBSCRIPTION_CONTRACT_CANCEL_MUTATION = `#graphql
  mutation CustomerSubscriptionContractCancel($subscriptionContractId: ID!) {
    subscriptionContractCancel(subscriptionContractId: $subscriptionContractId) {
      contract {
        id
        status
      }
      userErrors {
        code
        field
        message
      }
    }
  }
` as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * A MoneyV2 as the Customer Account API returns it. `currencyCode` borrows the
 * Storefront enum so these values can be handed straight to `<Money>` — the two
 * APIs speak the same ISO codes.
 */
interface Money2 {
  amount: string;
  currencyCode: MoneyV2['currencyCode'];
}

interface ContractLineRaw {
  id: string;
  name?: string | null;
  title?: string | null;
  variantTitle?: string | null;
  quantity: number;
  currentPrice?: Money2 | null;
  lineDiscountedPrice?: Money2 | null;
}

interface ContractRaw {
  id: string;
  status: string;
  createdAt?: string | null;
  nextBillingDate?: string | null;
  lastPaymentStatus?: string | null;
  currencyCode: string;
  billingPolicy?: {
    interval?: string | null;
    intervalCount?: number | null;
    minCycles?: number | null;
    maxCycles?: number | null;
  } | null;
  deliveryPrice?: Money2 | null;
  lines?: {nodes?: ContractLineRaw[] | null} | null;
}

/** A contract, flattened and pre-formatted for a component that must not compute. */
interface Contract {
  id: string;
  status: string;
  statusLabel: string;
  /** Can the customer still stop future charges on this one? */
  cancellable: boolean;
  /** Is it still costing them money? */
  live: boolean;
  lines: Array<{
    id: string;
    title: string;
    variantTitle: string | null;
    quantity: number;
    price: Money2 | null;
  }>;
  deliveryPrice: Money2 | null;
  /** Sum of the contract's own line amounts plus delivery. Before tax. */
  subtotal: Money2 | null;
  /** `every month`, `every 2 months`. Null when Shopify gives no policy. */
  frequency: string | null;
  /** `12-month minimum` — from the contract's real minCycles. Null when none. */
  commitment: string | null;
  /** `Sat, Aug 15, 2026`, already formatted in Pacific time. */
  nextChargeLabel: string | null;
  startedLabel: string | null;
  lastPaymentFailed: boolean;
}

type LoaderData =
  | {state: 'ok'; contracts: Contract[]}
  | {
      state: 'unconfigured' | 'unavailable';
      missing: string[];
      detail: string | null;
    };

/* ------------------------------------------------------------------ */
/* Server-side formatting helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * Jesse coaches in Riverside and bills California families, so a renewal date
 * is stated in their wall-clock day, not the server's UTC one.
 */
const BILLING_TIME_ZONE = 'America/Los_Angeles';

/** `Sat, Aug 15, 2026`. Runs on the server only; the client gets the string. */
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

/** `every month`, `every 2 months`. */
function frequencyLabel(
  interval?: string | null,
  intervalCount?: number | null,
): string | null {
  if (!interval) return null;
  const unit = interval.toLowerCase();
  const count = intervalCount ?? 1;
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}

/**
 * Sums MoneyV2 decimal strings in integer minor units so 0.1 + 0.2 never
 * becomes 0.30000000000000004. Returns null if the parts disagree on currency
 * — better to show nothing than to add dollars to pesos.
 */
function sumMoney(parts: Array<Money2 | null | undefined>): Money2 | null {
  const present = parts.filter((part): part is Money2 => Boolean(part?.amount));
  if (present.length === 0) return null;
  const currencyCode = present[0].currencyCode;
  let minorUnits = 0;
  for (const part of present) {
    if (part.currencyCode !== currencyCode) return null;
    const value = Number(part.amount);
    if (!Number.isFinite(value)) return null;
    minorUnits += Math.round(value * 100);
  }
  return {amount: (minorUnits / 100).toFixed(2), currencyCode};
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Completed',
  FAILED: 'Payment failed',
  STALE: 'Inactive',
};

/** Only these can still generate a charge, so only these can be cancelled. */
const LIVE_STATUSES = new Set(['ACTIVE', 'PAUSED', 'FAILED']);

function toContract(raw: ContractRaw): Contract {
  const lines = (raw.lines?.nodes ?? []).map((line) => ({
    id: line.id,
    title: line.title || line.name || 'Plan',
    variantTitle: line.variantTitle || null,
    quantity: line.quantity,
    price: line.lineDiscountedPrice ?? line.currentPrice ?? null,
  }));

  const minCycles = raw.billingPolicy?.minCycles ?? null;
  const live = LIVE_STATUSES.has(raw.status);

  return {
    id: raw.id,
    status: raw.status,
    statusLabel: STATUS_LABELS[raw.status] ?? raw.status,
    cancellable: live,
    live,
    lines,
    deliveryPrice:
      raw.deliveryPrice && Number(raw.deliveryPrice.amount) > 0
        ? raw.deliveryPrice
        : null,
    subtotal: sumMoney([
      ...lines.map((line) => line.price),
      raw.deliveryPrice ?? null,
    ]),
    frequency: frequencyLabel(
      raw.billingPolicy?.interval,
      raw.billingPolicy?.intervalCount,
    ),
    commitment:
      minCycles && minCycles > 1
        ? `${minCycles}-charge minimum on this plan`
        : null,
    nextChargeLabel: formatDate(raw.nextBillingDate),
    startedLabel: formatDate(raw.createdAt),
    lastPaymentFailed: raw.lastPaymentStatus === 'FAILED',
  };
}

/**
 * What is missing, in words a person can act on. Customer Accounts needs the
 * two PUBLIC_ vars; subscription reads and cancels each need a scope granted
 * to the headless app in Shopify admin.
 */
function missingConfig(env: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (!env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID) {
    missing.push('PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID');
  }
  if (!env.PUBLIC_CUSTOMER_ACCOUNT_API_URL) {
    missing.push('PUBLIC_CUSTOMER_ACCOUNT_API_URL');
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

export async function loader({context}: LoaderFunctionArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();

  const missing = missingConfig(
    context.env as unknown as Record<string, unknown>,
  );
  if (missing.length > 0) {
    return routerData<LoaderData>(
      {state: 'unconfigured', missing, detail: null},
      {headers: {'Cache-Control': 'no-cache, no-store, must-revalidate'}},
    );
  }

  // A store that has not granted the subscription scopes answers with a
  // GraphQL error rather than an empty list, and an unknown field throws.
  // Neither is a reason to 500 the page — both are reasons to tell the truth.
  try {
    const {data, errors} = await customerAccount.query(
      SUBSCRIPTION_CONTRACTS_QUERY,
      {variables: {first: 50}},
    );

    if (errors?.length || !data?.customer) {
      return routerData<LoaderData>(
        {
          state: 'unavailable',
          missing: ['read_own_subscription_contracts'],
          detail: errors?.[0]?.message ?? null,
        },
        {headers: {'Cache-Control': 'no-cache, no-store, must-revalidate'}},
      );
    }

    const nodes = (data.customer.subscriptionContracts?.nodes ??
      []) as ContractRaw[];

    return routerData<LoaderData>(
      {state: 'ok', contracts: nodes.map(toContract)},
      {headers: {'Cache-Control': 'no-cache, no-store, must-revalidate'}},
    );
  } catch (error) {
    return routerData<LoaderData>(
      {
        state: 'unavailable',
        missing: ['read_own_subscription_contracts'],
        detail: error instanceof Error ? error.message : null,
      },
      {headers: {'Cache-Control': 'no-cache, no-store, must-revalidate'}},
    );
  }
}

/* ------------------------------------------------------------------ */
/* Action — the cancel itself                                          */
/* ------------------------------------------------------------------ */

interface ActionResult {
  contractId: string | null;
  ok: boolean;
  message: string;
}

export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
  const form = await request.formData();
  const contractId = form.get('contractId');

  if (typeof contractId !== 'string' || contractId.length === 0) {
    return routerData<ActionResult>(
      {contractId: null, ok: false, message: 'No subscription was named.'},
      {status: 400},
    );
  }

  // Never let a mutation bounce the customer into a login redirect mid-cancel.
  const isLoggedIn = await customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    return routerData<ActionResult>(
      {
        contractId,
        ok: false,
        message:
          'Your session expired. Sign in again and the cancel will go through.',
      },
      {status: 401},
    );
  }

  try {
    const {data, errors} = await customerAccount.mutate(
      SUBSCRIPTION_CONTRACT_CANCEL_MUTATION,
      {variables: {subscriptionContractId: contractId}},
    );

    if (errors?.length) {
      return routerData<ActionResult>(
        {
          contractId,
          ok: false,
          message: `Shopify refused the cancellation: ${errors[0].message}. Nothing was changed.`,
        },
        {status: 502},
      );
    }

    const payload = data?.subscriptionContractCancel;
    const userError = payload?.userErrors?.[0];
    if (userError) {
      return routerData<ActionResult>(
        {
          contractId,
          ok: false,
          message: `${userError.message} Nothing was changed.`,
        },
        {status: 400},
      );
    }

    if (!payload?.contract) {
      return routerData<ActionResult>(
        {
          contractId,
          ok: false,
          message:
            'Shopify returned no contract, so we cannot confirm the cancellation. Refresh this page before assuming it went through.',
        },
        {status: 502},
      );
    }

    return routerData<ActionResult>({
      contractId,
      ok: true,
      message:
        'Cancelled. You will not be charged again. Nothing else is required of you.',
    });
  } catch (error) {
    return routerData<ActionResult>(
      {
        contractId,
        ok: false,
        message:
          error instanceof Error
            ? `${error.message} Nothing was changed.`
            : 'The cancellation could not be completed. Nothing was changed.',
      },
      {status: 502},
    );
  }
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default function Subscriptions() {
  const data = useLoaderData() as LoaderData;
  const actionResult = useActionData() as ActionResult | undefined;

  if (data.state !== 'ok') {
    return <Blocked data={data} />;
  }

  const live = data.contracts.filter((contract) => contract.live);
  const ended = data.contracts.filter((contract) => !contract.live);

  return (
    <div>
      <h2 className="acct-section-title display">Subscriptions</h2>
      <p className="acct-lede">
        Every plan you have with JV GOLD. Cancel any of them here, right now,
        without talking to anyone.
      </p>

      {actionResult ? (
        <p
          className="acct-error"
          style={{marginTop: '2rem'}}
          role={actionResult.ok ? 'status' : 'alert'}
        >
          {actionResult.message}
        </p>
      ) : null}

      {live.length === 0 ? (
        <div className="acct-empty" style={{marginTop: '2.5rem'}}>
          <p className="acct-lede">
            You have no active subscriptions. Nothing is billing.
          </p>
          <p style={{marginTop: '1.5rem'}}>
            <Link to="/train" className="acct-link">
              See the training plans
            </Link>
          </p>
        </div>
      ) : (
        <ul
          style={{listStyle: 'none', margin: '2.5rem 0 0', padding: 0}}
          aria-label="Active subscriptions"
        >
          {live.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              result={
                actionResult?.contractId === contract.id
                  ? actionResult
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      {ended.length > 0 ? (
        <section style={{marginTop: '4rem'}}>
          <h3 className="tag" style={{color: 'var(--steel)'}}>
            No longer billing
          </h3>
          <ul style={{listStyle: 'none', margin: '1.5rem 0 0', padding: 0}}>
            {ended.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ContractCard({
  contract,
  result,
}: {
  contract: Contract;
  result?: ActionResult;
}) {
  const navigation = useNavigation();
  const [confirming, setConfirming] = useState(false);

  const submittingThis =
    navigation.state !== 'idle' &&
    navigation.formData?.get('contractId') === contract.id;

  const errorId = `cancel-error-${contract.id}`;

  return (
    <li
      style={{
        borderTop: '1px solid var(--acct-hair-strong, rgba(26,26,26,0.18))',
        padding: '1.75rem 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '0.75rem 1.25rem',
        }}
      >
        <h3 style={{fontSize: '1.125rem', fontWeight: 600, margin: 0}}>
          {contract.lines[0]?.title ?? 'Subscription'}
        </h3>
        <span className="acct-status">{contract.statusLabel}</span>
      </div>

      {contract.lines.length > 1 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '0.75rem 0 0',
            padding: 0,
            color: 'var(--steel)',
            fontSize: '0.875rem',
          }}
        >
          {contract.lines.slice(1).map((line) => (
            <li key={line.id}>
              {line.title}
              {line.variantTitle ? ` — ${line.variantTitle}` : ''} ×{' '}
              {line.quantity}
            </li>
          ))}
        </ul>
      ) : null}

      <dl
        style={{
          display: 'grid',
          gap: '0.35rem 2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, max-content))',
          margin: '1rem 0 0',
        }}
      >
        {contract.subtotal ? (
          <div>
            <dt className="acct-th">Amount</dt>
            <dd className="acct-row-total" style={{margin: 0}}>
              <Money as="span" data={contract.subtotal} />
              {contract.frequency ? ` ${contract.frequency}` : ''}
            </dd>
          </div>
        ) : null}

        {contract.nextChargeLabel && contract.live ? (
          <div>
            <dt className="acct-th">Next charge</dt>
            <dd className="acct-row-meta" style={{margin: 0}}>
              {contract.nextChargeLabel}
            </dd>
          </div>
        ) : null}

        {contract.startedLabel ? (
          <div>
            <dt className="acct-th">Started</dt>
            <dd className="acct-row-meta" style={{margin: 0}}>
              {contract.startedLabel}
            </dd>
          </div>
        ) : null}

        {contract.commitment ? (
          <div>
            <dt className="acct-th">Minimum</dt>
            <dd className="acct-row-meta" style={{margin: 0}}>
              {contract.commitment}
            </dd>
          </div>
        ) : null}
      </dl>

      {contract.subtotal ? (
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.8125rem',
            color: 'var(--steel)',
          }}
        >
          Subtotal before tax. Tax is calculated by Shopify at each billing.
        </p>
      ) : null}

      {contract.lastPaymentFailed ? (
        <p className="acct-error" style={{marginTop: '1rem'}}>
          The last payment on this plan failed. Update your payment method, or
          cancel below.
        </p>
      ) : null}

      {result && !result.ok ? (
        <p
          className="acct-error"
          id={errorId}
          role="alert"
          style={{marginTop: '1rem'}}
        >
          {result.message}
        </p>
      ) : null}

      {contract.cancellable ? (
        <div className="acct-actions" style={{marginTop: '1.5rem'}}>
          {confirming ? (
            <Form method="POST" replace>
              <input type="hidden" name="contractId" value={contract.id} />
              <p
                style={{
                  margin: '0 0 1rem',
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  maxWidth: '44ch',
                }}
              >
                Cancelling stops all future charges on this plan. It takes
                effect immediately and cannot be undone — you would have to
                start a new plan.
              </p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.75rem'}}>
                <button
                  type="submit"
                  className="acct-btn acct-btn-primary"
                  disabled={submittingThis}
                  aria-describedby={result && !result.ok ? errorId : undefined}
                >
                  {submittingThis ? 'Cancelling…' : 'Yes, cancel this plan'}
                </button>
                <button
                  type="button"
                  className="acct-btn acct-btn-quiet"
                  onClick={() => setConfirming(false)}
                  disabled={submittingThis}
                >
                  Keep it
                </button>
              </div>
            </Form>
          ) : (
            <button
              type="button"
              className="acct-btn"
              onClick={() => setConfirming(true)}
            >
              Cancel this plan
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The honest disabled state. Names the missing piece and who fixes it, and
 * shows no cancel control at all — because none of them would work.
 */
function Blocked({
  data,
}: {
  data: Extract<LoaderData, {state: 'unconfigured' | 'unavailable'}>;
}) {
  const unconfigured = data.state === 'unconfigured';

  return (
    <div>
      <h2 className="acct-section-title display">Subscriptions</h2>
      <p className="acct-lede">
        {unconfigured
          ? 'Subscriptions cannot be shown yet, because Customer Accounts is not connected to this storefront.'
          : 'Subscriptions cannot be shown yet, because this storefront has not been granted access to subscription contracts.'}
      </p>

      <div
        style={{
          marginTop: '2.5rem',
          border: '2px solid var(--onyx)',
          padding: '1.5rem',
          maxWidth: '46rem',
        }}
      >
        <p className="tag" style={{margin: 0}}>
          What is missing
        </p>
        <ul
          style={{
            margin: '1rem 0 0',
            paddingLeft: '1.1rem',
            lineHeight: 1.8,
            fontSize: '0.95rem',
          }}
        >
          {unconfigured ? (
            <>
              {data.missing.map((key) => (
                <li key={key}>
                  <code>{key}</code> is not set in the deployment environment.
                </li>
              ))}
              <li>
                Whoever manages the Shopify admin sets these up under Headless →
                Customer Account API, then redeploys.
              </li>
            </>
          ) : (
            <>
              <li>
                The headless app needs the{' '}
                <code>read_own_subscription_contracts</code> and{' '}
                <code>write_own_subscription_contracts</code> scopes (listed for
                headless apps as{' '}
                <code>customer_read_subscription_contracts</code> and{' '}
                <code>customer_write_subscription_contracts</code>). They are
                granted in Shopify admin → Headless → Customer Account API →
                permissions.
              </li>
              <li>
                A subscriptions app — Recurpay, or whichever the store settles
                on — must be installed, since it is what creates the contracts
                in the first place.
              </li>
              {data.detail ? (
                <li>
                  Shopify said: <em>{data.detail}</em>
                </li>
              ) : null}
            </>
          )}
        </ul>
      </div>

      {/*
        Deliberately no cancel button and no list of plans. Until the scope is
        granted there is nothing real to show and nothing this page could
        actually stop — and a customer who clicks a fake cancel walks away
        believing they are no longer being charged.
      */}
      {/*
        No support email is hard-coded here on purpose: the store has no
        published contact address in this codebase, and inventing one would
        send a family who needs their billing stopped into a void. Reply-to on
        their own order confirmation is an address that provably reaches the
        store. When a real contact route or address exists, name it here.
      */}
      <p style={{marginTop: '2rem', maxWidth: '46rem', lineHeight: 1.8}}>
        If you are being billed and need it stopped today, reply to your order
        confirmation email — it reaches the store directly. That is a stopgap,
        not the standard: cancellation belongs on this page, and it will be here
        as soon as the access above is granted.
      </p>

      <p style={{marginTop: '2rem'}}>
        <Link to="/account/orders" className="acct-link">
          Back to orders
        </Link>
      </p>
    </div>
  );
}
