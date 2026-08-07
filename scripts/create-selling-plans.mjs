#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI: its report IS stdout. */
/**
 * ============================================================================
 * JV GOLD — SELLING PLAN GROUPS
 * ============================================================================
 *
 * Creates (and re-creates, idempotently) the Shopify selling plans that back
 * the subscription price matrix in `app/lib/offerings.ts`:
 *
 *     one-off  full price        (the ABSENCE of a selling plan)
 *     3 months −10%              minCycles 3, then renews
 *     6 months −15%              minCycles 6, then renews
 *     12 months −20%             minCycles 12, then renews   ← default in the UI
 *
 * One selling plan group per subscribable offering, three plans in each.
 *
 * ---------------------------------------------------------------------------
 * DO NOT RUN THIS AGAINST THE STORE YET
 * ---------------------------------------------------------------------------
 * As of this writing the products are still DRAFT and Shopify Payments is
 * unverified. Selling plans attached to draft products are premature: nothing
 * can be bought, and the group would then have to be reconciled by hand. The
 * script therefore DEFAULTS TO --dry-run, and `--apply` additionally refuses to
 * touch a product whose status is not ACTIVE unless you pass `--allow-draft`.
 *
 * Work the human checklist in `docs/SUBSCRIPTIONS.md` first.
 *
 * ---------------------------------------------------------------------------
 * *** SELLING PLAN GROUPS ARE DELETED 48 HOURS AFTER THE APP THAT CREATED ***
 * *** THEM IS UNINSTALLED. Shopify documents this on SellingPlanGroup and  ***
 * *** on SellingPlan. Whichever app's Admin token runs this script OWNS the ***
 * *** price matrix — uninstall it and the whole matrix disappears two days  ***
 * *** later, taking the discounts with it. Pick the owning app on purpose.  ***
 * ---------------------------------------------------------------------------
 *
 * Run:
 *   node scripts/create-selling-plans.mjs                 # dry run (default)
 *   node scripts/create-selling-plans.mjs --only private  # one offering
 *   node scripts/create-selling-plans.mjs --apply         # actually mutate
 *   node scripts/create-selling-plans.mjs --apply --prune # + delete stray plans
 *   node scripts/create-selling-plans.mjs --help
 *
 * ---------------------------------------------------------------------------
 * THE RULES THIS SCRIPT OBEYS
 * ---------------------------------------------------------------------------
 *
 * 1. THE MATRIX IS NOT RETYPED HERE.
 *    Every rate, every percentage, every cycle count is imported from
 *    `app/lib/offerings.ts` (Node 22 strips the types). If this file contained
 *    its own copy of the numbers, the store and the site would eventually
 *    disagree and a family would be charged something other than the figure
 *    they were shown. The only things hand-written below are the product
 *    HANDLES, and they are checked against docs/DATA-MODEL.md §2.1.
 *
 * 2. IDEMPOTENT, MATCHED ON merchantCode.
 *    `sellingPlanGroups` only ever returns the groups belonging to the app
 *    whose token is calling, so a merchantCode collision with another app is
 *    impossible. Within our own groups the merchantCode is the primary key; a
 *    plan inside a group is matched on its option value ("12 months"). Re-runs
 *    update in place. Nothing is ever duplicated.
 *
 * 3. NOTHING DESTRUCTIVE BY DEFAULT.
 *    Plans in one of our groups that we do not recognise are REPORTED, not
 *    deleted, unless `--prune` is passed. Deleting a selling plan orphans the
 *    buyers on it.
 *
 * 4. THE TOKEN IS NEVER PRINTED.
 *    Not in the report, not in an error, not in a debug dump. The report says
 *    "present" or "missing" and nothing else.
 *
 * 5. NO FAKED WORK.
 *    A dry run says DRY RUN on every line it prints. If credentials are absent
 *    it says so and resolves nothing, rather than inventing product IDs.
 *
 * ---------------------------------------------------------------------------
 * WHY PERCENTAGE AND NOT A FIXED PRICE
 * ---------------------------------------------------------------------------
 * `pricingPolicies: [{fixed: {adjustmentType: PERCENTAGE, …}}]` discounts
 * whatever the variant costs, so the plans keep working when Jesse raises a
 * rate — no second migration, no chance of a stale hard-coded price sitting in
 * Shopify while `offerings.ts` says something else.
 *
 * The cost of that choice: a percentage plan attached to a PRODUCT applies to
 * EVERY variant of it. `private-1-on-1` has a 90-minute variant at $280 that
 * the client's matrix never priced; under these plans it would sell at $224 on
 * the twelve-month term. The dry run prints every variant it would touch and
 * flags the ones the matrix does not name, so that is a decision Jesse makes
 * with his eyes open rather than a side effect he discovers in a report.
 *
 * SUB-DOLLAR RATES: the six-month Dedicated Workout rate is $127.50 and must
 * stay $127.50. `verifyMatrix()` below proves, before any network call, that
 * Shopify's percentage arithmetic (price × (1 − pct/100)) lands on an exact
 * cent for every rate in the matrix and agrees to the penny with
 * `termPricing()` in `offerings.ts` — and that rate × cycles is exactly the
 * committed total, so the monthly figure on screen times the months is the
 * money that actually moves. If a future rate broke that, the script refuses
 * to run instead of rounding someone's money away quietly.
 *
 * ---------------------------------------------------------------------------
 * COMPLIANCE NOTE (factual research, NOT legal advice — a California attorney
 * should review this before launch)
 * ---------------------------------------------------------------------------
 * `minCycles` and never `maxCycles`: the client chose auto-renew, so the
 * commitment is a MINIMUM that keeps renewing, not a term that stops.
 *
 * Recording `minCycles` on the plan does NOT by itself satisfy — or violate —
 * California's Automatic Renewal Law (Bus & Prof Code 17600 et seq., amended
 * by AB 2863, effective July 2025) or federal ROSCA. Those obligations live in
 * the buying flow and the subscription app:
 *   - separate, initially-UNCHECKED consent to the auto-renewal
 *     (`renewalTerms().consentLabel` in offerings.ts),
 *   - clear and conspicuous disclosure of amount, frequency, minimum term and
 *     how to cancel, in visual proximity to that consent,
 *   - cancellation completable ONLINE, at will, without extra steps,
 *   - a pre-renewal notice 15–45 days out for the twelve-month term.
 * Shopify enforces `minCycles` as a BILLING minimum; how an early cancellation
 * is handled is the subscription app's behaviour and Jesse's published terms.
 * Whatever that behaviour is, the online cancel path must still exist.
 */

import {readFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  OFFERINGS,
  TERMS,
  TERM_ORDER,
  PRE_RENEWAL_NOTICE_DAYS,
  termPricing,
  formatMoney,
  roundMoney,
} from '../app/lib/offerings.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Product handles, from docs/DATA-MODEL.md §2.1. The hub matches products on
 * `handle`, not on title, so these are the contract. A subscribable offering
 * with no handle here is a hard error, not a silent skip — see resolveTargets().
 */
const PRODUCT_HANDLES = {
  private: 'private-1-on-1',
  partner: 'partner-session',
  workout: 'dedicated-workout',
  package: 'monthly-private-package',
  // clinic and camp are deliberately absent: neither is `subscribable` in
  // offerings.ts. Camp is a host booking sold to clubs by the day; the clinic
  // has its own bundle discount and no term rates in the client's matrix.
};

/** The one option every group exposes. Plan option values are term labels. */
const GROUP_OPTION = 'Commitment';

/** `jvgold-private-terms` — the idempotency key. Stable forever; do not edit. */
function merchantCodeFor(offeringId) {
  return `jvgold-${offeringId}-terms`;
}

const ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-04';

/**
 * Credential env names, in the order they are tried. The Admin API is NOT the
 * Storefront API: `PRIVATE_STOREFRONT_API_TOKEN` will not work here and is
 * never read.
 */
/**
 * The scopes the mutations below actually require. Reported by Shopify's own
 * schema validator against `sellingPlanGroupCreate` / `Update` / `AddProducts`
 * — not a guess. `write_own_subscription_contracts` and `write_purchase_options`
 * are PROTECTED: they are requested in the Partner Dashboard and granted per
 * app, which is why this cannot be a throwaway custom-app token.
 */
const REQUIRED_SCOPES = [
  'read_products',
  'write_products',
  'write_purchase_options',
  'write_own_subscription_contracts',
];

const DOMAIN_KEYS = ['SHOPIFY_ADMIN_SHOP_DOMAIN', 'SHOP_DOMAIN', 'PUBLIC_STORE_DOMAIN'];
const TOKEN_KEYS = [
  'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_TOKEN',
];

/* ------------------------------------------------------------------ */
/* Args                                                                */
/* ------------------------------------------------------------------ */

const HELP = `
JV Gold — create the Shopify selling plans behind the subscription matrix.

  node scripts/create-selling-plans.mjs [options]

  --dry-run          Print what would happen and change nothing. THE DEFAULT.
  --apply            Actually create/update the selling plan groups.
  --only <id>        Restrict to one offering: ${Object.keys(PRODUCT_HANDLES).join(', ')}
  --allow-draft      With --apply, permit attaching plans to DRAFT products.
  --prune            With --apply, delete plans in our groups that we do not
                     recognise. Off by default — deleting a plan orphans the
                     buyers on it.
  --help             This.

Credentials are read from .env (never printed):
  domain  ${DOMAIN_KEYS.join(' | ')}
  token   ${TOKEN_KEYS.join(' | ')}
  scopes  ${REQUIRED_SCOPES.join(', ')}

The products must be ACTIVE and a subscription-capable gateway must be live
before --apply is appropriate. See docs/SUBSCRIPTIONS.md.
`.trim();

function parseArgs(argv) {
  const args = {
    apply: false,
    allowDraft: false,
    prune: false,
    help: false,
    only: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply' || arg === '--no-dry-run') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--allow-draft') args.allowDraft = true;
    else if (arg === '--prune') args.prune = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--only') args.only = argv[++i];
    else throw new Error(`Unknown argument: ${arg}\n\n${HELP}`);
  }
  if (args.only && !PRODUCT_HANDLES[args.only]) {
    throw new Error(
      `--only ${args.only} is not a subscribable offering. Choose one of: ` +
        Object.keys(PRODUCT_HANDLES).join(', '),
    );
  }
  return args;
}

/* ------------------------------------------------------------------ */
/* .env                                                                */
/* ------------------------------------------------------------------ */

/**
 * Minimal .env reader — no dependency, and it never overrides a value already
 * exported in the real environment. Values are returned, never logged.
 */
function readDotEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pick(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return {key, value: value.trim()};
    }
  }
  return null;
}

/**
 * Resolves the Admin credentials. Returns `{domain, token, tokenSource}` or a
 * `reason` explaining precisely what is missing and who unblocks it — never a
 * token, never a fragment of one.
 */
function loadCredentials() {
  const env = {...readDotEnv(resolve(PROJECT, '.env')), ...process.env};

  const domain = pick(env, DOMAIN_KEYS);
  const token = pick(env, TOKEN_KEYS);

  if (!domain) {
    return {reason: `No shop domain. Set one of ${DOMAIN_KEYS.join(', ')} in .env.`};
  }
  if (domain.value.includes('mock.shop')) {
    return {
      reason:
        `${domain.key} is still mock.shop. Selling plans are an Admin API ` +
        'concept and mock.shop has no Admin API. Run `npx shopify hydrogen ' +
        'link` and `npx shopify hydrogen env pull` first.',
    };
  }
  if (!token) {
    return {
      reason:
        `No Admin API access token. Set one of ${TOKEN_KEYS.join(', ')} in .env. ` +
        `This is an ADMIN token from an app holding ${REQUIRED_SCOPES.join(', ')} ` +
        '— NOT a Storefront API token. The subscription scopes are PROTECTED ' +
        'and must be requested through the Partner Dashboard. ' +
        'See docs/SUBSCRIPTIONS.md.',
    };
  }

  return {
    domain: domain.value.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    domainSource: domain.key,
    token: token.value,
    tokenSource: token.key,
  };
}

/* ------------------------------------------------------------------ */
/* Admin GraphQL                                                       */
/* ------------------------------------------------------------------ */

function makeClient({domain, token}) {
  const endpoint = `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  return async function graphql(query, variables = {}, attempt = 0) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The only place the token is ever used. Never logged.
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({query, variables}),
    });

    if (response.status === 429 && attempt < 3) {
      const wait = Number(response.headers.get('Retry-After') || 2) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return graphql(query, variables, attempt + 1);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Admin API ${response.status} ${response.statusText}. ` +
          `Endpoint ${endpoint}. Body: ${body.slice(0, 600)}`,
      );
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(
        'Admin API returned errors:\n' +
          payload.errors
            .map((e) => `  - ${e.message}${e.extensions?.code ? ` (${e.extensions.code})` : ''}`)
            .join('\n'),
      );
    }
    return payload.data;
  };
}

/** Throws on `userErrors`, which GraphQL reports with a 200. */
function assertNoUserErrors(label, result) {
  const errors = result?.userErrors ?? [];
  if (errors.length === 0) return;
  throw new Error(
    `${label} failed:\n` +
      errors
        .map((e) => `  - ${(e.field || []).join('.') || '(no field)'}: ${e.message}`)
        .join('\n'),
  );
}

/* ------------------------------------------------------------------ */
/* Queries and mutations                                               */
/* ------------------------------------------------------------------ */

const SHOP_QUERY = `#graphql
  query JvgoldSubscriptionEligibility {
    shop {
      name
      myshopifyDomain
      currencyCode
      features {
        eligibleForSubscriptions
        sellsSubscriptions
        legacySubscriptionGatewayEnabled
        paypalExpressSubscriptionGatewayStatus
      }
    }
  }
`;

const PRODUCT_QUERY = `#graphql
  query JvgoldProductByHandle($handle: String!) {
    productByIdentifier(identifier: {handle: $handle}) {
      id
      handle
      title
      status
      variants(first: 100) {
        nodes { id title price }
      }
    }
  }
`;

const GROUPS_QUERY = `#graphql
  query JvgoldSellingPlanGroups($cursor: String) {
    sellingPlanGroups(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        merchantCode
        options
        position
        productsCount { count }
        sellingPlans(first: 20) {
          nodes {
            id
            name
            options
            position
            category
            billingPolicy {
              ... on SellingPlanRecurringBillingPolicy {
                interval
                intervalCount
                minCycles
                maxCycles
              }
            }
            pricingPolicies {
              ... on SellingPlanFixedPricingPolicy {
                adjustmentType
                adjustmentValue {
                  ... on SellingPlanPricingPolicyPercentageValue { percentage }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const GROUP_APPLIES_QUERY = `#graphql
  query JvgoldGroupAppliesToProduct($id: ID!, $productId: ID!) {
    sellingPlanGroup(id: $id) {
      id
      appliesToProduct(productId: $productId)
    }
  }
`;

const GROUP_CREATE = `#graphql
  mutation JvgoldSellingPlanGroupCreate(
    $input: SellingPlanGroupInput!
    $resources: SellingPlanGroupResourceInput
  ) {
    sellingPlanGroupCreate(input: $input, resources: $resources) {
      sellingPlanGroup { id merchantCode sellingPlans(first: 20) { nodes { id name options } } }
      userErrors { field message }
    }
  }
`;

const GROUP_UPDATE = `#graphql
  mutation JvgoldSellingPlanGroupUpdate($id: ID!, $input: SellingPlanGroupInput!) {
    sellingPlanGroupUpdate(id: $id, input: $input) {
      sellingPlanGroup { id merchantCode sellingPlans(first: 20) { nodes { id name options } } }
      deletedSellingPlanIds
      userErrors { field message }
    }
  }
`;

const GROUP_ADD_PRODUCTS = `#graphql
  mutation JvgoldSellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
    sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
      sellingPlanGroup { id merchantCode productsCount { count } }
      userErrors { field message }
    }
  }
`;

/* ------------------------------------------------------------------ */
/* The matrix, read out of offerings.ts                                */
/* ------------------------------------------------------------------ */

/** The terms that become selling plans. `once` is the ABSENCE of a plan. */
const PLAN_TERMS = TERM_ORDER.filter((id) => TERMS[id].renews);

/**
 * Every list rate an offering sells at, named. One entry for a single-date
 * offering; one per tier for the monthly package. Read from the offering — no
 * price is ever typed into this file.
 */
function listRatesFor(offering) {
  switch (offering.mode) {
    case 'single-date':
      return [{label: offering.name, listRate: offering.price}];
    case 'weekly-pattern':
      return offering.tiers.map((tier) => ({
        label: `${tier.name} tier`,
        listRate: tier.monthly,
      }));
    default:
      // A subscribable offering in a mode with no single monthly rate would
      // need a pricing decision from Jesse, not a guess from a script.
      throw new Error(
        `Offering "${offering.id}" is subscribable but its mode ` +
          `"${offering.mode}" has no monthly list rate this script knows how ` +
          'to price. Add the rule to listRatesFor() deliberately.',
      );
  }
}

/** What Shopify will charge: price × (1 − percentage/100). */
function shopifyPercentageRate(listRate, percentage) {
  return roundMoney(listRate * (1 - percentage / 100));
}

/** True when the raw product lands exactly on a cent, with no rounding. */
function landsOnExactCent(listRate, percentage) {
  const raw = listRate * (1 - percentage / 100) * 100;
  return Math.abs(raw - Math.round(raw)) < 1e-6;
}

/**
 * Proves the matrix before anything is created. Runs offline, in dry runs too.
 * Any problem here is a money bug, so the script stops rather than continuing.
 */
function verifyMatrix(targets) {
  const problems = [];

  for (const target of targets) {
    for (const {label, listRate} of target.rates) {
      for (const termId of PLAN_TERMS) {
        const def = TERMS[termId];
        const percentage = roundMoney(def.discountRate * 100);
        const pricing = termPricing(listRate, termId, {
          alwaysRecurring: target.offering.baseCadence === 'monthly',
        });
        const where = `${target.offering.name} · ${label} · ${def.label}`;

        if (!landsOnExactCent(listRate, percentage)) {
          problems.push(
            `${where}: ${formatMoney(listRate)} − ${percentage}% is not an ` +
              'exact number of cents. Shopify would round it and the receipt ' +
              'would stop matching the screen.',
          );
        }
        const shopifyRate = shopifyPercentageRate(listRate, percentage);
        if (shopifyRate !== pricing.rate) {
          problems.push(
            `${where}: Shopify would charge ${formatMoney(shopifyRate)} but ` +
              `offerings.ts shows ${formatMoney(pricing.rate)}.`,
          );
        }
        if (roundMoney(pricing.rate * pricing.cycles) !== pricing.commitmentTotal) {
          problems.push(
            `${where}: ${formatMoney(pricing.rate)} × ${pricing.cycles} is not ` +
              `the stated commitment ${formatMoney(pricing.commitmentTotal)}.`,
          );
        }
        if (def.minCycles == null) {
          problems.push(`${where}: renewing term has no minCycles.`);
        }
      }
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* Building the API input                                              */
/* ------------------------------------------------------------------ */

/**
 * One selling plan. Rate-free on purpose: the plan is a percentage, and a
 * dollar figure baked into a Shopify description would go stale the day a rate
 * moves — and would be plainly wrong on the package group, whose three tiers
 * share one set of plans. The concrete figures live in `offerings.ts`, which is
 * what the buyer actually reads on the site.
 */
function sellingPlanInput(termId) {
  const def = TERMS[termId];
  const percentage = roundMoney(def.discountRate * 100);

  return {
    name: `${def.label} — ${def.discountLabel}`,
    // Buyer-facing commitment copy. States the minimum AND that it continues.
    description:
      `${percentage}% off the monthly rate. Minimum ${def.cycles} monthly ` +
      'charges, then continues month to month until cancelled. ' +
      'Cancel online at any time.',
    options: [def.label],
    position: TERM_ORDER.indexOf(termId),
    category: 'SUBSCRIPTION',
    billingPolicy: {
      recurring: {
        interval: 'MONTH',
        intervalCount: 1,
        // minCycles, never maxCycles. The client chose auto-renew: the term is
        // a MINIMUM that keeps renewing, not a plan that stops on its own.
        minCycles: def.minCycles,
      },
    },
    deliveryPolicy: {
      recurring: {
        interval: 'MONTH',
        intervalCount: 1,
        // No anchor: training starts when it is booked, not on the 1st.
        preAnchorBehavior: 'ASAP',
      },
    },
    inventoryPolicy: {reserve: 'ON_SALE'},
    pricingPolicies: [
      {
        fixed: {
          adjustmentType: 'PERCENTAGE',
          adjustmentValue: {percentage},
        },
      },
    ],
  };
}

function groupInputFor(target, {plansToCreate, plansToUpdate, plansToDelete}) {
  const input = {
    name: 'Training plan',
    merchantCode: target.merchantCode,
    description:
      `JV Gold commitment terms for ${target.offering.name}. ` +
      `${PLAN_TERMS.map((id) => `${TERMS[id].label} ${TERMS[id].discountLabel}`).join(', ')}. ` +
      'All terms auto-renew until cancelled.',
    options: [GROUP_OPTION],
    position: target.position,
  };
  if (plansToCreate?.length) input.sellingPlansToCreate = plansToCreate;
  if (plansToUpdate?.length) input.sellingPlansToUpdate = plansToUpdate;
  if (plansToDelete?.length) input.sellingPlansToDelete = plansToDelete;
  return input;
}

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

function resolveTargets(only) {
  const subscribable = OFFERINGS.filter((o) => o.subscribable);

  const missing = subscribable
    .filter((o) => !PRODUCT_HANDLES[o.id])
    .map((o) => o.id);
  if (missing.length) {
    throw new Error(
      `These offerings are marked subscribable in offerings.ts but have no ` +
        `product handle in this script: ${missing.join(', ')}. Add the handle ` +
        '(and create the product — see docs/DATA-MODEL.md §2.1) deliberately. ' +
        'Refusing to guess.',
    );
  }

  const extra = Object.keys(PRODUCT_HANDLES).filter(
    (id) => !subscribable.some((o) => o.id === id),
  );
  if (extra.length) {
    throw new Error(
      `PRODUCT_HANDLES names ${extra.join(', ')}, which offerings.ts does not ` +
        'mark subscribable. Camp and clinic must never be given terms. Remove ' +
        'the handle, or set `subscribable` deliberately in offerings.ts.',
    );
  }

  return (
    subscribable
      // `position` is derived from the UNFILTERED list, so `--only package`
      // cannot quietly renumber the group and make a re-run non-idempotent.
      .map((offering, index) => ({
        offering,
        handle: PRODUCT_HANDLES[offering.id],
        merchantCode: merchantCodeFor(offering.id),
        position: index + 1,
        rates: listRatesFor(offering),
      }))
      .filter((target) => (only ? target.offering.id === only : true))
  );
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const pad = (text, width) => String(text).padEnd(width);
const padStart = (text, width) => String(text).padStart(width);

function printMatrix(targets) {
  console.log('\nTHE MATRIX (from app/lib/offerings.ts — nothing here is retyped)');
  console.log('='.repeat(78));

  for (const target of targets) {
    console.log(
      `\n${target.offering.name}  ·  product "${target.handle}"  ·  ` +
        `merchantCode "${target.merchantCode}"`,
    );
    const recurring = target.offering.baseCadence === 'monthly';

    for (const {label, listRate} of target.rates) {
      console.log(`  ${label} — one-off list rate ${formatMoney(listRate)}`);
      console.log(
        `    ${pad('term', 12)}${pad('off', 6)}${padStart('per month', 12)}` +
          `${padStart('cycles', 8)}${padStart('minimum', 14)}${padStart('saving', 12)}`,
      );
      for (const termId of PLAN_TERMS) {
        const pricing = termPricing(listRate, termId, {alwaysRecurring: recurring});
        console.log(
          `    ${pad(TERMS[termId].label, 12)}${pad(
            `${roundMoney(TERMS[termId].discountRate * 100)}%`,
            6,
          )}${padStart(formatMoney(pricing.rate), 12)}${padStart(
            `× ${pricing.cycles}`,
            8,
          )}${padStart(formatMoney(pricing.commitmentTotal), 14)}${padStart(
            formatMoney(pricing.savings),
            12,
          )}`,
        );
      }
    }
  }

  console.log(
    `\n  One-off = no selling plan at all. ${PLAN_TERMS.length} plans per group, ` +
      `${targets.length} groups, ${PLAN_TERMS.length * targets.length} plans total.`,
  );
  console.log(
    '  Every term auto-renews past its minimum (minCycles, never maxCycles).',
  );
  console.log(
    `  The 12-month term needs a pre-renewal notice ` +
      `${PRE_RENEWAL_NOTICE_DAYS.min}–${PRE_RENEWAL_NOTICE_DAYS.max} days before it ` +
      'renews (California ARL). That is not a selling-plan field — it is a job ' +
      'someone still has to wire. See docs/SUBSCRIPTIONS.md.',
  );
}

/** Flags variants the plans would silently discount that the matrix never priced. */
function printVariantExposure(target, product) {
  const named = new Set(target.rates.map((r) => roundMoney(r.listRate)));
  const variants = product.variants.nodes;
  const strays = variants.filter((v) => !named.has(roundMoney(Number(v.price))));

  console.log(
    `  variants: ${variants
      .map((v) => `${v.title} ${formatMoney(Number(v.price))}`)
      .join(' · ')}`,
  );

  if (strays.length === 0) return;

  console.log(
    '  ⚠ these variants are NOT in the client price matrix but WOULD inherit ' +
      'the plans (a percentage policy applies to every variant of the product):',
  );
  for (const variant of strays) {
    const list = roundMoney(Number(variant.price));
    const line = PLAN_TERMS.map((id) => {
      const pct = roundMoney(TERMS[id].discountRate * 100);
      return `${TERMS[id].shortLabel} ${formatMoney(shopifyPercentageRate(list, pct))}`;
    }).join(' · ');
    console.log(
      `      ${variant.title} ${formatMoney(list)} → ${line}   ← Jesse must price this`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Diffing an existing group                                           */
/* ------------------------------------------------------------------ */

/** A plan is matched on its option value: "3 months", "6 months", "12 months". */
function planKey(plan) {
  return (plan.options || [])[0] ?? plan.name;
}

function planMatches(existing, desired) {
  const billing = existing.billingPolicy || {};
  const policy = (existing.pricingPolicies || [])[0] || {};
  const percentage = policy.adjustmentValue?.percentage;

  return (
    existing.name === desired.name &&
    billing.interval === desired.billingPolicy.recurring.interval &&
    billing.intervalCount === desired.billingPolicy.recurring.intervalCount &&
    billing.minCycles === desired.billingPolicy.recurring.minCycles &&
    billing.maxCycles == null &&
    existing.category === desired.category &&
    policy.adjustmentType === 'PERCENTAGE' &&
    Number(percentage) === desired.pricingPolicies[0].fixed.adjustmentValue.percentage
  );
}

function diffGroup(existingGroup) {
  const desired = PLAN_TERMS.map((id) => ({term: id, input: sellingPlanInput(id)}));
  const existingPlans = existingGroup?.sellingPlans?.nodes ?? [];
  const byKey = new Map(existingPlans.map((plan) => [planKey(plan), plan]));

  const plansToCreate = [];
  const plansToUpdate = [];
  const unchanged = [];

  for (const {input} of desired) {
    const key = input.options[0];
    const existing = byKey.get(key);
    if (!existing) {
      plansToCreate.push(input);
    } else if (planMatches(existing, input)) {
      unchanged.push(key);
      byKey.delete(key);
    } else {
      plansToUpdate.push({id: existing.id, ...input});
      byKey.delete(key);
    }
  }

  // Anything still in byKey is a plan in OUR group that we do not recognise.
  const strays = [...byKey.values()];

  return {plansToCreate, plansToUpdate, unchanged, strays};
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function fetchAllGroups(graphql) {
  const groups = [];
  let cursor = null;
  do {
    const data = await graphql(GROUPS_QUERY, {cursor});
    groups.push(...data.sellingPlanGroups.nodes);
    cursor = data.sellingPlanGroups.pageInfo.hasNextPage
      ? data.sellingPlanGroups.pageInfo.endCursor
      : null;
  } while (cursor);
  return groups;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }

  const mode = args.apply ? 'APPLY' : 'DRY RUN';
  console.log('JV GOLD — SELLING PLAN GROUPS');
  console.log(`Mode: ${mode}${args.apply ? '' : ' (nothing will be changed)'}`);
  console.log(
    '\n*** Selling plan groups are DELETED 48 HOURS after the app that created',
  );
  console.log('*** them is uninstalled. Whichever app owns them owns the matrix.');

  const targets = resolveTargets(args.only);

  // 1. Prove the money before touching anything.
  const problems = verifyMatrix(targets);
  if (problems.length) {
    console.error('\nMATRIX VERIFICATION FAILED — refusing to create anything:');
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }
  console.log(
    `\n✓ Matrix verified: every term rate lands on an exact cent and agrees ` +
      'with termPricing() in offerings.ts to the penny.',
  );

  printMatrix(targets);

  // 2. Credentials.
  const credentials = loadCredentials();
  if (credentials.reason) {
    console.log('\nCREDENTIALS: missing.');
    console.log(`  ${credentials.reason}`);
    if (args.apply) {
      console.error('\n--apply cannot run without Admin API credentials.');
      return 1;
    }
    console.log(
      '\nDRY RUN — no store was contacted. Below is exactly what would be sent',
    );
    console.log('once credentials exist; product IDs are shown unresolved.');
    for (const target of targets) {
      const {plansToCreate} = diffGroup(null);
      console.log(`\n--- ${target.offering.name} — sellingPlanGroupCreate ---`);
      console.log(
        JSON.stringify(
          {
            input: groupInputFor(target, {plansToCreate}),
            resources: {
              productIds: [`<unresolved: product handle "${target.handle}">`],
            },
          },
          null,
          2,
        ),
      );
    }
    console.log('\nNothing was created. See docs/SUBSCRIPTIONS.md.');
    return 0;
  }

  console.log(
    `\nCREDENTIALS: shop domain from ${credentials.domainSource} ` +
      `(${credentials.domain}), Admin token from ${credentials.tokenSource} ` +
      '(present, not printed).',
  );

  const graphql = makeClient(credentials);

  // 3. Is this shop even allowed to sell subscriptions?
  const shopData = await graphql(SHOP_QUERY);
  const features = shopData.shop.features;
  console.log(
    `\nShop: ${shopData.shop.name} (${shopData.shop.myshopifyDomain}, ` +
      `${shopData.shop.currencyCode})`,
  );
  if (!features.eligibleForSubscriptions) {
    console.error(
      '\nSTOP: shop.features.eligibleForSubscriptions is FALSE.\n' +
        '\nThis store cannot sell subscriptions yet, so selling plans would be\n' +
        'created against a store that cannot charge them. A human has to:\n' +
        '  1. Activate a subscription-capable payment gateway — Shopify\n' +
        '     Payments, Stripe, Authorize.net, Adyen or PayPal Express.\n' +
        '     Local/manual payment methods CANNOT buy subscriptions.\n' +
        '  2. Install a subscription app (Recurpay), or create a Partner\n' +
        '     Dashboard app granted the protected subscription scopes.\n' +
        '\nNeither can be done from this script. See docs/SUBSCRIPTIONS.md.',
    );
    return 1;
  }
  console.log('✓ shop.features.eligibleForSubscriptions = true');
  if (features.sellsSubscriptions) {
    console.log('  (this shop has sold subscriptions before)');
  }

  // 4. Resolve products.
  const resolved = [];
  let blocked = false;
  console.log('\nPRODUCTS');
  for (const target of targets) {
    const data = await graphql(PRODUCT_QUERY, {handle: target.handle});
    const product = data.productByIdentifier;
    if (!product) {
      console.error(
        `  ✗ ${target.handle} — NOT FOUND. Create it first ` +
          '(docs/DATA-MODEL.md §2.1). The hub matches on handle, not title.',
      );
      blocked = true;
      continue;
    }
    console.log(`  ${product.status === 'ACTIVE' ? '✓' : '⚠'} ${product.handle} — ` +
      `${product.title} [${product.status}]`);
    printVariantExposure(target, product);

    if (product.status !== 'ACTIVE' && args.apply && !args.allowDraft) {
      console.error(
        `    ✗ ${product.handle} is ${product.status}. Attaching selling plans ` +
          'to a product nobody can buy is premature. Set it ACTIVE and publish ' +
          'it to the Headless channel, or pass --allow-draft if you mean it.',
      );
      blocked = true;
    }
    resolved.push({...target, product});
  }

  if (blocked) {
    console.error('\nRefusing to continue. Fix the products above first.');
    return 1;
  }

  // 5. Existing groups (only ever this app's own).
  const existingGroups = await fetchAllGroups(graphql);
  const byCode = new Map(existingGroups.map((g) => [g.merchantCode, g]));
  console.log(
    `\nEXISTING GROUPS owned by this app: ${existingGroups.length}` +
      (existingGroups.length
        ? ` (${existingGroups.map((g) => g.merchantCode).join(', ')})`
        : ''),
  );

  // 6. Plan the work, then do it (or describe it).
  let created = 0;
  let updated = 0;
  let untouched = 0;

  for (const target of resolved) {
    const existing = byCode.get(target.merchantCode) ?? null;
    const diff = diffGroup(existing);
    const label = `${target.offering.name} [${target.merchantCode}]`;
    console.log(`\n--- ${label} ---`);

    if (diff.strays.length) {
      console.log(
        `  ⚠ ${diff.strays.length} plan(s) in this group are not part of the ` +
          `matrix: ${diff.strays.map(planKey).join(', ')}`,
      );
      if (!args.prune) {
        console.log(
          '    Left alone. Deleting a selling plan orphans the buyers on it. ' +
            'Pass --prune only when you know nobody is subscribed to them.',
        );
      }
    }
    const plansToDelete = args.prune ? diff.strays.map((p) => p.id) : [];

    if (!existing) {
      const variables = {
        input: groupInputFor(target, {plansToCreate: diff.plansToCreate}),
        resources: {productIds: [target.product.id]},
      };
      console.log(`  CREATE group + ${diff.plansToCreate.length} plans`);
      if (!args.apply) {
        console.log('  DRY RUN — sellingPlanGroupCreate variables:');
        console.log(JSON.stringify(variables, null, 2));
        continue;
      }
      const data = await graphql(GROUP_CREATE, variables);
      assertNoUserErrors('sellingPlanGroupCreate', data.sellingPlanGroupCreate);
      console.log(`  ✓ created ${data.sellingPlanGroupCreate.sellingPlanGroup.id}`);
      created++;
      continue;
    }

    const needsPlanWork =
      diff.plansToCreate.length || diff.plansToUpdate.length || plansToDelete.length;

    // Is the product already attached to this group?
    const applies = await graphql(GROUP_APPLIES_QUERY, {
      id: existing.id,
      productId: target.product.id,
    });
    const attached = applies.sellingPlanGroup?.appliesToProduct === true;

    console.log(
      `  EXISTS ${existing.id} — ${diff.unchanged.length} unchanged, ` +
        `${diff.plansToUpdate.length} to update, ${diff.plansToCreate.length} to ` +
        `create, ${plansToDelete.length} to delete; product ` +
        `${attached ? 'already attached' : 'NOT attached'}`,
    );

    if (!needsPlanWork && attached) {
      console.log('  ✓ already correct — nothing to do');
      untouched++;
      continue;
    }

    const variables = {
      id: existing.id,
      input: groupInputFor(target, {
        plansToCreate: diff.plansToCreate,
        plansToUpdate: diff.plansToUpdate,
        plansToDelete,
      }),
    };

    if (!args.apply) {
      console.log('  DRY RUN — sellingPlanGroupUpdate variables:');
      console.log(JSON.stringify(variables, null, 2));
      if (!attached) {
        console.log('  DRY RUN — sellingPlanGroupAddProducts variables:');
        console.log(
          JSON.stringify({id: existing.id, productIds: [target.product.id]}, null, 2),
        );
      }
      continue;
    }

    const data = await graphql(GROUP_UPDATE, variables);
    assertNoUserErrors('sellingPlanGroupUpdate', data.sellingPlanGroupUpdate);
    console.log('  ✓ group updated');

    if (!attached) {
      const addData = await graphql(GROUP_ADD_PRODUCTS, {
        id: existing.id,
        productIds: [target.product.id],
      });
      assertNoUserErrors(
        'sellingPlanGroupAddProducts',
        addData.sellingPlanGroupAddProducts,
      );
      console.log('  ✓ product attached');
    }
    updated++;
  }

  console.log('\n' + '='.repeat(78));
  if (args.apply) {
    console.log(
      `DONE — ${created} group(s) created, ${updated} updated, ${untouched} ` +
        'already correct.',
    );
    console.log(
      'Remember: these groups die 48 hours after the owning app is uninstalled.',
    );
  } else {
    console.log('DRY RUN COMPLETE — the store was read, never written.');
    console.log('Re-run with --apply once docs/SUBSCRIPTIONS.md is fully ticked.');
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
/* eslint-enable no-console */
