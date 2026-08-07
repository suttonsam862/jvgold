# Subscriptions — the price matrix, the selling plans, and what is still blocked

The client's brief, in his words:

> "All prices displayed currently are the 1-off prices. We need to essentially
> build discounted ranges if users subscribe for up to a year… A year should be
> the auto selection… We need to set up a price matrix like that and incentivize
> using recurpay across the app."

This document covers the Shopify half of that: the selling plans that make the
discounted terms real at checkout, the script that creates them, and the
human-only work nobody can automate.

**Status: NOT LIVE. Nothing has been created in the store.** The products are
still `DRAFT` and Shopify Payments is unverified, so
`scripts/create-selling-plans.mjs` has been written, verified against Shopify's
schema and exercised in dry run only. Do not run it with `--apply` until the
checklist in [§3](#3-the-human-only-prerequisites) is fully ticked.

---

## ⚠️ Read this before you install, uninstall, or swap any app

> **SELLING PLAN GROUPS ARE DELETED 48 HOURS AFTER THE APP THAT CREATED THEM IS
> UNINSTALLED.** Shopify documents this on both `SellingPlanGroup` and
> `SellingPlan`. **Whichever app owns the plans owns the price matrix.** If
> Recurpay creates them and Recurpay is later uninstalled, every discounted term
> in this document disappears two days later, and with it every price the site
> advertises. `sellingPlanGroups` in the Admin API only ever returns the groups
> belonging to the app that is calling, so a second app cannot see, repair or
> inherit the first app's groups.

Pick the owning app deliberately, once, and write down which one it is. Changing
it later is a migration, not a setting.

---

## 1. The matrix

Terms and discounts confirmed by the client. **Twelve months is the default
selection.** Every term **auto-renews until cancelled**, so the commitment is a
*minimum*, not a stopping point.

| Term | Discount | Shopify `minCycles` | Renews after? |
| --- | --- | --- | --- |
| One-off | full price | — (no selling plan at all) | no |
| 3 months | −10% | 3 | yes, monthly |
| 6 months | −15% | 6 | yes, monthly |
| 12 months | −20% | 12 | yes, monthly |

### 1.1 The rates

Per-month rate, then the minimum commitment in full. Generated from
`app/lib/offerings.ts` — see [§2](#2-how-money-is-represented) before editing any
figure here by hand.

| Offering | One-off | 3 mo (−10%) | 6 mo (−15%) | 12 mo (−20%) |
| --- | --- | --- | --- | --- |
| Private 1-on-1 | $200 | $180 | $170 | $160 |
| Partner Session *(total, split by two families)* | $200 | $180 | $170 | $160 |
| Dedicated Workout | $150 | $135 | **$127.50** | $120 |
| Package · Two-Day | $1,400/mo | $1,260 | $1,190 | $1,120 |
| Package · Three-Day | $2,000/mo | $1,800 | $1,700 | $1,600 |
| Package · Gold Standard | $3,200/mo | $2,880 | $2,720 | $2,560 |

Committed totals (rate × cycles), which is what the buyer is actually agreeing to:

| Offering | 3 mo | 6 mo | 12 mo | 12-mo saving |
| --- | --- | --- | --- | --- |
| Private 1-on-1 | $540 | $1,020 | $1,920 | $480 |
| Partner Session | $540 | $1,020 | $1,920 | $480 |
| Dedicated Workout | $405 | $765 | $1,440 | $360 |
| Package · Two-Day | $3,780 | $7,140 | $13,440 | $3,360 |
| Package · Three-Day | $5,400 | $10,200 | $19,200 | $4,800 |
| Package · Gold Standard | $8,640 | $16,320 | $30,720 | $7,680 |

### 1.2 What is excluded, and why

- **Camp Booking** — excluded by the client. It is a host booking sold to clubs
  and schools at $1,500/day, not a consumer subscription. It must never be given
  a term. `subscribable: false` in `offerings.ts`, and the script hard-errors if
  someone adds a product handle for it.
- **Small-Group Clinic** — five fixed dates with their own 3-for-$200 bundle
  discount, and no term rates in the client's matrix. Not subscribable until
  Jesse prices one.

---

## 2. How money is represented

`app/lib/offerings.ts` holds money in **whole dollars** (`app/lib/ops/*` holds
integer **cents** and exports a different `formatMoney` — never let a number
cross between them).

**Dollars are allowed to carry cents.** The six-month Dedicated Workout rate is
$127.50 and nothing may round it away. The rules, all enforced in code:

1. Every derived rate goes through `roundMoney()`, so `$150 × 0.85` is `127.5`
   and never `127.49999999999999`.
2. **The per-cycle rate is rounded first, then multiplied.** The committed total
   is `rate × cycles` of the already-rounded rate — so the monthly figure on
   screen, times the months, is exactly the money that moves. Discounting the
   *total* and dividing back out would leave the "/mo" figure a cent adrift from
   the charge.
3. `formatMoney()` prints cents only when they exist, so whole-dollar rates keep
   reading as whole dollars: `$160`, not `$160.00`; `$127.50`, not `$127.5`.

### 2.1 Why the selling plans use PERCENTAGE, not a fixed price

`pricingPolicies: [{fixed: {adjustmentType: PERCENTAGE, adjustmentValue:
{percentage: 10 | 15 | 20}}}]`.

A percentage discounts whatever the variant costs, so the plans survive a rate
change with no migration and no stale price sitting in Shopify while
`offerings.ts` says something else.

Before it contacts the store — in dry runs too — the script proves, for every
rate × term in the matrix, that:

- `price × (1 − pct/100)` lands on an **exact cent** (no silent rounding);
- that figure equals `termPricing()` in `offerings.ts` **to the penny**;
- `rate × cycles` equals the stated committed total;
- every renewing term carries a `minCycles` and **no** `maxCycles`.

If any of those fail, the script refuses to create anything. A money bug is not
something to discover in a customer's bank statement.

### 2.2 The variant-inheritance catch — a decision Jesse still owes

A selling plan group attached to a **product** applies to **every variant of
it**. The product plan in `docs/DATA-MODEL.md` §2.1 gives `private-1-on-1` a
90-minute variant at **$280** — a rate the client's subscription matrix never
priced. Attached at product level, it would sell at **$224** on the twelve-month
term purely as a side effect of the percentage.

The dry run prints every variant it would touch and flags the ones the matrix
does not name, so this is a decision made with eyes open rather than a side
effect found later in a report. **Jesse must price the 90-minute private under
each term (or the plans must be attached per-variant instead of per-product)
before `--apply` is appropriate.**

---

## 3. The human-only prerequisites

None of this can be done from a script. Work top to bottom.

### 3.1 Decide who owns the plans, and give it the scopes

Pick **one**:

- **Install Recurpay** (the client's stated preference) and let it own the
  groups. Fastest path; it also brings the customer-facing manage/cancel portal,
  dunning and pre-renewal email that we would otherwise have to build. If you go
  this way, create the plans **in Recurpay's own UI or via its API**, not with
  this script — a group created by our token is invisible to Recurpay and vice
  versa. This script then becomes a spec and a verifier rather than the creator.
- **Create a Partner Dashboard app** (a custom app installed on
  `ya1bt7-hw.myshopify.com`) and let our own token own them. Then this script is
  the creator. Request the **protected** subscription scopes — Shopify reviews
  these; they are not self-serve:

  | Scope | Why |
  | --- | --- |
  | `read_products` | resolve products by handle, read existing groups |
  | `write_products` | attach groups to products |
  | `write_purchase_options` | create/update selling plan groups |
  | `write_own_subscription_contracts` | own the resulting subscription contracts |

  *(These are the scopes Shopify's own schema validator reports for
  `sellingPlanGroupCreate`, `sellingPlanGroupUpdate` and
  `sellingPlanGroupAddProducts`. They are not a guess.)*

Whichever you choose, re-read the 48-hour warning at the top of this file.

### 3.2 Activate a subscription-capable payment gateway

**Local and manual payment methods cannot buy subscriptions.** The gateway must
be one of:

- Shopify Payments *(currently **unverified** on this store — this is the live
  blocker)*
- Stripe
- Authorize.net
- Adyen
- PayPal Express

The script's first call checks `shop { features { eligibleForSubscriptions } }`
and stops with a readable message naming this step if it is false.

### 3.3 Make the products real

Per `docs/DATA-MODEL.md` §2.1 — the app matches on **handle**, not title:

| Offering | Handle | Currently |
| --- | --- | --- |
| Private 1-on-1 | `private-1-on-1` | DRAFT |
| Partner Session | `partner-session` | DRAFT |
| Dedicated Workout | `dedicated-workout` | DRAFT |
| Monthly Private Package | `monthly-private-package` | DRAFT |

For each: set status **ACTIVE**, and **publish to the Headless sales channel**
(a product that is not published to the channel the Hydrogen storefront reads
from will not appear on the site, plans or no plans). Services should not track
inventory (`inventoryPolicy: 'continue'`).

Until they are ACTIVE, `--apply` refuses to attach plans to them (override with
`--allow-draft`, which you should not need).

### 3.4 Let the storefront read selling plans

Add **`unauthenticated_read_selling_plans`** to the Storefront API access token
the Hydrogen app uses. Without it the Storefront API returns products with no
`sellingPlanGroups`, the term picker has nothing to attach a cart line to, and
the site silently falls back to one-off pricing — which is exactly the failure
mode where a customer is shown a discount and charged full price.

Cart lines then carry `sellingPlanId` on `cartLinesAdd`.

### 3.5 Put the Admin token in `.env`

One of, in the order the script tries them:

```
SHOPIFY_ADMIN_API_ACCESS_TOKEN=…
PRIVATE_ADMIN_API_ACCESS_TOKEN=…
PRIVATE_ADMIN_API_TOKEN=…
```

Shop domain comes from `SHOPIFY_ADMIN_SHOP_DOMAIN`, `SHOP_DOMAIN` or
`PUBLIC_STORE_DOMAIN` (in that order). This is an **Admin** token —
`PRIVATE_STOREFRONT_API_TOKEN` will not work and is never read. The script never
prints a token, in output or in an error.

`.env` is gitignored. Keep it that way.

---

## 4. Running the script

`scripts/create-selling-plans.mjs`. **Defaults to a dry run**, so nobody mutates
the store by accident.

```bash
node scripts/create-selling-plans.mjs                 # dry run (default)
node scripts/create-selling-plans.mjs --only private  # one offering
node scripts/create-selling-plans.mjs --apply         # actually mutate
node scripts/create-selling-plans.mjs --apply --prune # + delete stray plans
node scripts/create-selling-plans.mjs --help
```

| Flag | Effect |
| --- | --- |
| *(none)* / `--dry-run` | Verify the matrix, read the store, print every mutation it *would* send. Changes nothing. |
| `--apply` | Actually create/update. Refuses to run without credentials. |
| `--only <id>` | `private`, `partner`, `workout` or `package`. |
| `--allow-draft` | With `--apply`, permit attaching plans to a DRAFT product. |
| `--prune` | With `--apply`, delete plans in our groups that are not in the matrix. **Off by default — deleting a selling plan orphans the buyers on it.** |

A dry run works **without credentials**: it verifies the matrix, prints it, and
dumps the exact `sellingPlanGroupCreate` payloads with the product IDs shown as
unresolved. It says so plainly rather than inventing IDs. That is the useful
mode today.

### 4.1 What it creates

Four groups, three plans each, twelve plans total. **The one-off price is the
absence of a selling plan** — it is not a fourth plan.

| Offering | `merchantCode` (the idempotency key) | Product |
| --- | --- | --- |
| Private 1-on-1 | `jvgold-private-terms` | `private-1-on-1` |
| Partner Session | `jvgold-partner-terms` | `partner-session` |
| Dedicated Workout | `jvgold-workout-terms` | `dedicated-workout` |
| Monthly Private Package | `jvgold-package-terms` | `monthly-private-package` |

Each plan:

```jsonc
{
  "name": "12 months — 20% off",
  "options": ["12 months"],
  "category": "SUBSCRIPTION",
  "billingPolicy":  { "recurring": { "interval": "MONTH", "intervalCount": 1, "minCycles": 12 } },
  "deliveryPolicy": { "recurring": { "interval": "MONTH", "intervalCount": 1, "preAnchorBehavior": "ASAP" } },
  "inventoryPolicy": { "reserve": "ON_SALE" },
  "pricingPolicies": [
    { "fixed": { "adjustmentType": "PERCENTAGE", "adjustmentValue": { "percentage": 20 } } }
  ]
}
```

**`minCycles`, never `maxCycles`.** `maxCycles` would stop the plan at the end of
the term; the client chose auto-renew, so the term is a floor the plan renews
past. This is load-bearing — see [§5](#5-compliance).

The plan `description` deliberately carries **no dollar figure**: the policy is a
percentage, one set of plans serves all three package tiers, and a price baked
into Shopify would go stale the day a rate moves. The concrete figures live in
`offerings.ts`, which is what the buyer actually reads on the site.

### 4.2 Idempotency

Re-running updates in place; it never duplicates.

- Groups are matched on **`merchantCode`**. `sellingPlanGroups` only ever returns
  groups belonging to the calling app, so a collision with another app is
  impossible.
- Plans inside a group are matched on their **option value** (`"3 months"`,
  `"6 months"`, `"12 months"`) and updated only when something actually differs
  (name, interval, `minCycles`, category, or the percentage).
- Group `position` is derived from the unfiltered offering list, so `--only`
  cannot quietly renumber a group.
- A plan in one of our groups that is *not* in the matrix is **reported and left
  alone**. `--prune` deletes it. Use that only when you know nobody is
  subscribed to it.
- Products are attached with `sellingPlanGroupAddProducts` only when
  `appliesToProduct` says they are not already attached.

### 4.3 Where the numbers come from

The script imports `OFFERINGS`, `TERMS`, `TERM_ORDER` and `termPricing()`
straight from `app/lib/offerings.ts` (Node 22 strips the types). **No price,
percentage or cycle count is retyped in the script.** The only hand-written
values are the four product handles, and those are cross-checked: a subscribable
offering with no handle is a hard error, and a handle for an offering that is not
subscribable is also a hard error. Camp cannot be given a term by accident.

To change a rate or a discount, edit `offerings.ts` and re-run the script. Never
edit a price in the Shopify admin and expect the site to follow.

---

## 5. Compliance

**This section is researched fact, not legal advice. A California attorney should
review this flow before launch.** Jesse sells from Riverside to California
families, so California's Automatic Renewal Law (Bus & Prof Code 17600 et seq.,
as amended by **AB 2863, effective July 2025**) applies to every renewing plan
here. Federal **ROSCA** also applies — the FTC's click-to-cancel rule was vacated
in July 2025, but ROSCA was not.

Cheap now, expensive later.

### 5.1 Preselection vs consent

**Preselecting a plan is fine.** Keeping the twelve-month term as the default
selection, with its anchoring and its struck-through one-off price, is lawful and
intended.

**Pre-checking consent is not.** Consent to the auto-renewal must be **one
separate affirmative action**, rendered **initially UNCHECKED**, tied
specifically to the recurring charge. It must not be the general terms box, and
it must not be folded into the submit button's fine print.

`offerings.ts` supplies the copy: `renewalTerms(pricing).consentLabel`.

### 5.2 Clear and conspicuous disclosure

In **larger or contrasting, set-off type — not body copy** — in **visual
proximity to the consent control**, and again beside the billing details:

| Requirement | Source in `offerings.ts` |
| --- | --- |
| It continues until cancelled | `renewalTerms().headline` |
| The recurring amount and frequency | `renewalTerms().amountLine` |
| The minimum commitment and its full cost | `renewalTerms().commitmentLine` |
| How to cancel | `renewalTerms().cancelLine` |

All four are also available as `renewalTerms().bullets` for a boxed summary.

### 5.3 Cancellation

**Must be completable online, at will, without extra steps.** No phone call, no
email, no retention gauntlet.

Note the seam: Shopify records `minCycles` as a **billing** minimum, but how an
early cancellation is *handled* is the subscription app's behaviour plus Jesse's
published terms. Whatever that policy turns out to be, **the online cancel path
must still exist and must still work.** If the chosen app cannot do that, it is
the wrong app.

### 5.4 Pre-renewal notice — currently unwired

A twelve-month initial term additionally requires a reminder **15–45 days before
it renews**. `offerings.ts` models this:

- `PRE_RENEWAL_NOTICE_DAYS = {min: 15, max: 45}`
- `renewalScheduleFor(firstChargeIso, term)` computes the renewal date and the
  exact window the notice has to land in — pure civil-date arithmetic, no
  `new Date()`, so the server and the browser never disagree.
- **`PRE_RENEWAL_NOTICE_WIRED = false`.**

While that flag is false the schedule is an **ops obligation, not a customer
promise**. Do not render "we will email you before it renews" anywhere a buyer
can read it: telling a family a notice is coming when nothing sends it is both a
lie and the exact compliance failure the notice exists to prevent. Flip the flag
in the same change that wires the send.

This is not a selling-plan field. Shopify will not do it for you. Either the
subscription app sends it (Recurpay can) or we build it.

---

## 6. What is still blocked, and who unblocks it

| Blocked | Who unblocks it |
| --- | --- |
| Shopify Payments unverified → `eligibleForSubscriptions` false | Jesse — finish verification, or activate Stripe / Authorize.net / Adyen / PayPal Express |
| Products are DRAFT and unpublished to the Headless channel | Jesse / store admin |
| No Admin token with the protected subscription scopes | Partner Dashboard app review, or install Recurpay |
| Storefront token lacks `unauthenticated_read_selling_plans` | store admin |
| 90-minute private ($280) has no term pricing | Jesse — a pricing decision, not an engineering one |
| Pre-renewal notice not wired (`PRE_RENEWAL_NOTICE_WIRED = false`) | engineering, once the app that sends mail is chosen |
| Auto-renewal flow not reviewed by counsel | a California attorney, before launch |

Until every row above is cleared, `scripts/create-selling-plans.mjs` stays in dry
run and the site keeps quoting one-off prices honestly.
