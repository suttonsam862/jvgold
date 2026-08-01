# JV Gold — Operations Data Model

How the private management hub's domain model maps onto Shopify, what cannot
live in Shopify, and exactly what has to happen to go live.

**Files**

| File | Role |
| --- | --- |
| `app/lib/ops/types.ts` | The shared domain model. Every page imports from here. |
| `app/lib/ops/seed.ts` | A deterministic, de-identified seed dataset typed against it. |
| `app/lib/offerings.ts` | The six bookable offerings with their real prices. Source of truth for what gets sold. |
| `~/JVPrivateMGMT/deepwaters/supabase/schema.sql` | The **real, in-production** club schema this vocabulary mirrors. |

---

## 0. Current state — be honest about it

The Shopify connector is **disconnected** and the store is **not linked**.
Nothing in the hub reads live data. Every figure on every screen comes from
`app/lib/ops/seed.ts`.

That is deliberate, not a shortcut. The pages are built against the real shape,
so swapping in live queries later is a contained change: the loaders stop
importing the seed arrays and start returning the same `OpsDataset`. No page
component changes.

Two things in the model encode this state, and pages should surface them rather
than hide them:

- Every `shopifyProductId`, `shopifyVariantId` and `shopifyCustomerId` is
  `null`. That null *is* the "not synced" state.
- `OPS_DATASET.integrations` carries a one-line status per system
  (`disconnected` / `partial` / `connected`) meant to be printed verbatim.

---

## 1. Where the vocabulary comes from

The field names are not invented. They mirror the Deep Waters Supabase schema
that is already in production use, so the two systems can be reconciled row for
row. Supabase is snake_case; TypeScript is camelCase; nothing else differs.

| Supabase | `types.ts` | Notes |
| --- | --- | --- |
| `athletes.name` | `Client.name` | De-identified in the seed. |
| `athletes.guardian` | `Client.guardian` | Parent / primary contact. |
| `athletes.level` | `Client.level` | `Youth \| HS \| College \| Adult` — same four strings. |
| `athletes.status` | `Client.status` | `Active \| Trial \| Paid In Full \| Owes Balance \| Inactive` — same five, do not add a sixth without changing Supabase. |
| `athletes.family_group` | `Client.familyGroup` | The billing household. |
| `athletes.usaw_card_number` | `Client.compliance.usawCardNumber` | |
| `athletes.has_health_insurance` | `Client.compliance.hasHealthInsurance` | `null` means never asked, not "no". |
| `athletes.insurance_provider` / `_policy_number` | `Client.compliance.insuranceProvider` / `insurancePolicyNumber` | |
| `athletes.emergency_contact_name` / `_phone` | `Client.compliance.emergencyContactName` / `emergencyContactPhone` | |
| `athletes.waiver_signed` | `Client.compliance.waiverSigned` | |
| `athletes.sessions_purchased/_used/_remaining` | `Client.packages.purchased/used/remaining` | |
| `athletes.package`, `package_price` | `Client.packages.name`, `priceCents` | **Unit change**: numeric dollars → integer cents. |
| `athletes.rate` | `Client.rateCents` | Same unit change. |
| `athletes.source` | `Client.source` | Plus `'site'` for bookings taken through `/train`. |
| `athletes.shopify_customer_id` | `Client.shopifyCustomerId` | |
| `athletes.color` | `Client.colorIndex` | Roster avatar palette index. |
| `sessions.date` | `TrainingSession.start` | See the timestamp note below. |
| `sessions.mins` | `TrainingSession.minutes` | Also expressed as `end - start`. |
| `sessions.kind` | `TrainingSession.kind` | **Widened**: Supabase has `private \| group`; the hub needs `private \| partner \| clinic \| workout \| camp \| group` to match the six offerings. Supabase needs the same widening, or a mapping at the boundary. |
| `sessions.focus`, `notes` | `TrainingSession.focus`, `notes` | |
| `sessions.amount` | `TrainingSession.amountCents` | Unit change. |
| `sessions.paid`, `paid_date`, `method` | `TrainingSession.paid`, `paidDate`, `method` | |
| `session_athletes` (join) | `TrainingSession.athleteIds` | Flattened — the hub always reads them together. |
| `registrations` | `Payment` | One row per purchase. |
| `registrations.shopify_order_id` / `_name` | `Payment.shopifyOrderId` / `shopifyOrderName` | |
| `registrations.total` | `Payment.amountCents` | Unit change. |
| `registrations.items` | `Payment.category` + `description` | Collapsed for display; the jsonb stays authoritative. |

### Two deliberate deviations

**Money is integer cents.** Supabase stores `numeric`. The hub stores
`amountCents: number`. Floats accumulate rounding error across sums and splits;
a `numeric` read into JavaScript becomes a float the moment it crosses the wire.
Convert at the boundary — `Math.round(row.amount * 100)` on read,
`cents / 100` on write — and never inside a component. Format only with
`formatMoney()`.

**Dates are civil strings, not `Date`s.** `sessions.date` is `timestamptz`.
The hub stores `IsoDateTime` = `'2026-08-01T16:00:00'`, a local wall-clock string
with **no zone suffix**: "the time on the clock in the Riverside mat room".
Reason: this app server-renders. A `timestamptz` re-derived through `new Date()`
formats one way on a UTC server and another in a Pacific browser, and React
throws a hydration error. On read, convert `timestamptz` → America/Los_Angeles
wall clock **once**, server-side. Date arithmetic uses the pure integer helpers
in `types.ts` (`addDays`, `daysBetween`, `weekdayOfIso`) which never touch
`Date` and are therefore timezone-proof.

---

## 2. Mapping onto Shopify

### 2.1 Products / Variants → bookable offerings

`Product` and `ProductVariant` in `types.ts` are shaped to Shopify's Admin API
vocabulary (`title`, `handle`, `description`, `status`, `sku`, `vendor`,
`productType`, `tags`, `inventoryQuantity`, `inventoryPolicy`,
`compareAtPrice`) so a real Admin response drops in without renaming anything.

The six offerings in `offerings.ts` become six Shopify products:

| Offering | Handle | Variants | Price |
| --- | --- | --- | --- |
| Private 1-on-1 | `private-1-on-1` | 60 min / 90 min | $200 / $280 |
| Partner Session | `partner-session` | 60 min · 2 athletes | $200 total |
| Dedicated Workout | `dedicated-workout` | 90 min | $150 |
| Small-Group Clinic | `small-group-clinic` | Single / 3-clinic bundle | $100 / $200 |
| Monthly Private Package | `monthly-private-package` | Two-Day / Three-Day / Gold Standard | $1,400 / $2,000 / $3,200 per month |
| Overnight Camp | `overnight-camp` | One variant per camp date | $895 / $1,450 |

Notes on the seams:

- **The variant is the unit of sale, and price lives on the variant.** The flat
  `priceCents` / `sku` / `compareAtPriceCents` on `Product` are mirrors of the
  first variant, kept for cheap list rendering. On sync, the variant wins.
- **Services should not track inventory** (`inventoryPolicy: 'continue'`,
  `inventoryQuantity: null`). Camps are the exception: the bed count is real
  inventory, and `spotsRemaining` in `offerings.ts` maps onto
  `inventoryQuantity`. Apparel tracks inventory normally.
- **A camp deposit is not a discount.** Shopify's native checkout charges the
  full variant price. Either sell the deposit as its own variant and invoice the
  balance separately, or use draft orders / a deposits app. Today the seed models
  it as two `Payment` rows (`deposit`, then `balance`) which is what actually
  happens in the bank account.
- **Monthly packages are subscriptions.** Vanilla Shopify checkout cannot bill
  monthly. This needs a subscription app or Shopify Subscriptions, and until
  then a package sale is a one-time order repeated each month. `Payment.category`
  is `'package'` either way, so the finance page does not care.
- **`availability` / open time slots are not a Shopify concept.** Booking a
  specific 5:15 PM Thursday is scheduling, not commerce — see §3.

### 2.2 Customers → clients

Shopify `Customer` → `Client`. Natively available:

| Shopify Customer | `Client` |
| --- | --- |
| `id` | `shopifyCustomerId` |
| `firstName` + `lastName` | `name` |
| `email` | `email` |
| `phone` | `phone` |
| `tags` | `tags` |
| `createdAt` | `joinedAt` |
| `amountSpent` | `lifetimeValueCents` |

**Important:** the Shopify customer is the **payer** (the parent), while
`Client` is the **athlete**. For a household with three wrestlers there is one
Shopify customer and three `Client` rows. That is why `familyGroup` exists and
why finance rolls up by household (`OutstandingAccount`) rather than by athlete.
Do not model the athlete as the Shopify customer — the first sibling to check
out would overwrite the second.

### 2.3 Orders → payments

Shopify `Order` → `Payment`.

| Shopify Order | `Payment` |
| --- | --- |
| `id` | `shopifyOrderId` |
| `name` (`#1042`) | `shopifyOrderName` |
| `processedAt` | `date` |
| `currentTotalPriceSet` | `amountCents` |
| `totalRefundedSet` | `refundedCents` |
| `paymentGatewayNames` | `method` |
| `lineItems[].variant` | `offeringId`, `category`, `description` |
| `customer.id` | `clientId` (via `shopifyCustomerId`) |

Seams:

- **Most revenue is not a Shopify order.** Cash, Zelle and Venmo dominate the
  real ledger (see the Deep Waters session exports). Those arrive through the
  coaching ledger, not through checkout. `Payment.source` exists to keep them
  visible side by side, and the finance page must never present the Shopify
  total as "revenue".
- **Processing fees.** Shopify does not return the fee on a standard Admin order
  query; it comes from the payout/transaction endpoints. `feeCents` is estimated
  as 2.9% + 30¢ for `Card`/`Shopify` and 0 for cash-like methods. Replace the
  estimate with real payout data before this figure is used for anything but
  orientation.
- **Refunds stay positive.** `amountCents` is always gross; `refundedCents` is
  the give-back; `netCents` is precomputed. Never store a negative payment.

### 2.4 Metafields — the wrestling fields Shopify has no home for

None of the compliance data fits a native Shopify field. It goes in customer
metafields under the namespace `jvgold`, or stays in Supabase and is joined at
read time. Recommended definitions:

| Metafield key | Type | Maps to |
| --- | --- | --- |
| `jvgold.usaw_card_number` | `single_line_text_field` | `Compliance.usawCardNumber` |
| `jvgold.has_health_insurance` | `boolean` | `Compliance.hasHealthInsurance` |
| `jvgold.insurance_provider` | `single_line_text_field` | `Compliance.insuranceProvider` |
| `jvgold.insurance_policy_number` | `single_line_text_field` | `Compliance.insurancePolicyNumber` |
| `jvgold.emergency_contact_name` | `single_line_text_field` | `Compliance.emergencyContactName` |
| `jvgold.emergency_contact_phone` | `single_line_text_field` | `Compliance.emergencyContactPhone` |
| `jvgold.waiver_signed` | `boolean` | `Compliance.waiverSigned` |
| `jvgold.waiver_signed_at` | `date` | (add when waiver dating is needed) |
| `jvgold.date_of_birth` | `date` | `Client.dateOfBirth` |
| `jvgold.school` | `single_line_text_field` | `Client.school` |
| `jvgold.level` | `single_line_text_field` | `Client.level` |
| `jvgold.family_group` | `single_line_text_field` | `Client.familyGroup` |
| `jvgold.sessions_purchased` | `number_integer` | `PackageState.purchased` |
| `jvgold.sessions_used` | `number_integer` | `PackageState.used` |
| `jvgold.sessions_remaining` | `number_integer` | `PackageState.remaining` |

**Honest warning about session counters.** Putting `sessions_remaining` in a
metafield makes it visible in the Shopify mobile app, which is the whole reason
Jesse wants it there — but it also makes Shopify a second writer of a number
Supabase already owns. Two writers, no transaction, guaranteed drift. Pick one:

- **Recommended:** Supabase owns the counter; a webhook pushes a read-only mirror
  into the metafield after every change. The hub always reads Supabase.
- Or: Shopify owns it and Supabase mirrors — simpler for Jesse's phone, but then
  coach adjustments made on the mat have to round-trip through Shopify.

Do not skip this decision. In the real data, coaches adjust `sessions_remaining`
by hand after comps and make-ups, which is why `PackageState.remaining` is
stored rather than derived from `purchased - used`.

### 2.5 What should be metafields but should NOT be public

`waiver_signed`, insurance details, `date_of_birth` and emergency contacts are
minors' data. Set every one of these metafield definitions to **private /
app-owned access**, never `PUBLIC_READ`. A `PUBLIC_READ` metafield is queryable
from the Storefront API by anyone with the public token — which is shipped in
the browser bundle. This is the single highest-consequence mistake available in
this migration.

---

## 3. What cannot live in Shopify

Shopify is a commerce system. It has no concept of a calendar, a mat, an
attendance record, or a coach's ledger. These stay in Supabase permanently:

| Entity | Why not Shopify |
| --- | --- |
| `TrainingSession` | Shopify has no scheduling primitive. An order says "a private was bought"; it cannot say it happens Thursday 5:15 PM at the Riverside room, ran 60 minutes, and covered a re-attack drill. |
| `session_athletes` / `TrainingSession.athleteIds` | Attendance is many-to-many between sessions and athletes. Shopify orders are one customer, one order. |
| `CalendarEvent` | Half of Jesse's real week (school duals, travel, family) exists only in Google Calendar and has no commercial equivalent. |
| Open slots / availability | `offerings.ts` `availability` + `slotsFor()`. Shopify has no booking engine; a real one needs a bookings app or a scheduling table in Supabase. |
| Package **consumption** | Shopify records the purchase of a 10-session block. It cannot record the tenth session being used on a Tuesday. |
| Coaching notes, focus, film links | Operational, not commercial. |
| Payroll (assistant coaches) | Present in the Deep Waters exports; out of scope for this model but explicitly *not* Shopify. |

**The division, in one line:** *Shopify owns the sale. Supabase owns the mat.*
The `Payment` ↔ `TrainingSession` link (`Payment.sessionId`) is the seam where
the two meet, and it is the only place they touch.

### 3.1 Google Calendar

`CalendarEvent` is a superset that represents both a JV Gold session and an
imported Google event. The important field is `readOnly`.

- `source: 'jvgold'` → backed by a `TrainingSession`, `readOnly: false`, fully
  editable.
- `source: 'google'`, `claimed: false` → `readOnly: true`. **Render it, never
  write it.** Until two-way sync exists, an edit made in the hub would silently
  diverge from the copy on Jesse's phone, and the phone is what he actually
  runs the business from.
- `source: 'google'`, `claimed: true` → Jesse has attached it to the ledger
  (`sessionId`, `kind`, `amountCents`). It becomes editable.

Google-native fields (`googleEventId`, `calendarId`, `colorId`, `recurrence`,
`attendees`, `allDay`) are kept verbatim so a claimed event can eventually be
written back without a lossy round trip. `Recurrence` stores the raw RFC 5545
RRULE strings **plus** a pre-rendered human `label`, because parsing an RRULE
during render is both slow and a hydration risk.

---

## 4. Going live — the concrete checklist

### Step 1 — Link the store

1. Connect the Shopify connector / create a custom app on the JV Gold store.
2. Set `PUBLIC_STORE_DOMAIN`, `PUBLIC_STOREFRONT_API_TOKEN`,
   `PUBLIC_STOREFRONT_ID` and the Admin API token in the Oxygen environment.
   The site currently runs against `mock.shop`.
3. Confirm: `env.PUBLIC_STORE_DOMAIN` is no longer `mock.shop`.
4. Flip `integrations.shopify.state` to `connected`.

### Step 2 — Create the metafield definitions

Create all fifteen `jvgold.*` customer metafield definitions from §2.4 **before**
importing anyone. Set every one to private/app-owned access (§2.5). Definitions
created after the data exists require a backfill pass to become visible in the
admin UI.

### Step 3 — Create the products

Create the six products and their variants from §2.1 with exactly the handles
listed — the hub matches on `handle`, not on title. Set services to
`inventoryPolicy: 'continue'` with untracked inventory; set camp variants to
tracked inventory equal to `spotsRemaining` in `offerings.ts`.

Then write the returned `gid://shopify/Product/…` and
`gid://shopify/ProductVariant/…` back onto the `Product` records. **A non-null
`shopifyProductId` is the signal the products page uses to stop rendering "not
synced".**

### Step 4 — Backfill customers

Source of truth is `~/JVPrivateMGMT/deepwaters/data/registrations/registrants.json`
plus the live `athletes` table.

1. **De-duplicate by household first.** One Shopify customer per *payer*, not
   per athlete. In the real export, `family_group` and `parent_contact` are the
   only signals, and both are frequently null — expect this step to need human
   review, not a script.
2. Create/merge the Shopify customer; write `shopify_customer_id` back onto
   every `athletes` row in that household.
3. Populate the `jvgold.*` metafields from the athlete row.
4. **Expect large gaps.** In the production export, `usaw_card_number`,
   `date_of_birth`, `insurance_*` and `waiver_signed` are null for the majority
   of imported athletes. Do not write empty strings — leave them null so the
   compliance screen can find them. That screen exists precisely to chase these.

### Step 5 — Backfill orders (optional, and probably skip it)

Historic payments were cash, Zelle and Venmo. Back-dating them as Shopify orders
would inflate Shopify's own analytics and misreport the store's history. Import
them into Supabase `registrations` with `source: 'import'` instead, and let
Shopify's order history start on the day the store goes live.

### Step 6 — Point the loaders at real data

Per page, replace the seed import with a loader that returns the same shapes:

```ts
// before
import {CLIENTS, SESSIONS} from '~/lib/ops/seed';

// after
export async function loader({context}: Route.LoaderArgs) {
  requireDemoRole(context, 'coach');
  const [clients, sessions] = await Promise.all([
    fetchClients(context),   // Supabase athletes + Shopify customer join
    fetchSessions(context),  // Supabase sessions + session_athletes
  ]);
  return {clients, sessions};
}
```

At the boundary, and only at the boundary: `numeric` → cents, `timestamptz` →
Pacific wall-clock string, `snake_case` → `camelCase`. Everything downstream is
already correct.

### Step 7 — Delete the seed

When every page reads live, delete `app/lib/ops/seed.ts`. `types.ts` stays.

---

## 5. Known seams, stated plainly

1. **`sessions.kind` is narrower in Supabase than in the hub.** Supabase has
   `private | group`; the hub has six values. Widen the column or map at the
   boundary — but decide, do not let a `partner` session silently become
   `group`.
2. **`sessions_remaining` will have two writers** unless §2.4 is decided. It will
   drift. It always drifts.
3. **The payer/athlete split is the highest-risk part of the backfill.** Getting
   it wrong means siblings overwrite each other's Shopify customer record.
4. **Processing fees are estimated, not read.** `feeCents` is 2.9% + 30¢, not a
   real payout figure. Do not reconcile a bank statement against it.
5. **Monthly packages need a subscription mechanism Shopify does not include.**
6. **Camp deposits need draft orders or a deposits app.**
7. **Booking a specific time slot is not commerce.** `/train` currently quotes
   and collects a request; converting that to a real checkout with a held slot
   requires a scheduling table with a reservation lock, or a bookings app.
8. **Google Calendar is one-way.** Anything with `readOnly: true` must never be
   written to. Two-way sync is a separate project.

---

## 6. Rules for anyone touching the seed

- **Every person is de-identified.** `Athlete 01`, `Guardian 07`, `Family 03`,
  `Account 12`. Never a human name, invented or otherwise. Never invented
  medical, injury or weight-cut status attached to a name. An earlier draft of
  this project shipped fabricated named minors with weights and injury status
  and it had to be torn out. A screenshot of this hub must never read as real
  records about real children.
- **No `Math.random()`, no `Date.now()`, no `new Date()`.** Unstable data
  renders differently on the server and in the browser and breaks hydration.
  All variation comes from the seeded PRNG in `seed.ts`; all dates derive from
  `ANCHOR_DATE` (`2026-08-01`) via the integer civil-date helpers in `types.ts`.
- **Money is integer cents.** Format with `formatMoney()` at the render edge and
  nowhere else.
- **Derived figures stay derived.** `lifetimeValueCents`, `balanceCents`,
  `lastSessionAt` and `Client.status` are reconciled against the ledger in
  `patchClientRollups()`. A client must never read "Paid In Full" on the roster
  while the ledger shows a balance.
