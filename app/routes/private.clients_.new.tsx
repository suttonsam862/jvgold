/**
 * ============================================================================
 * /private/clients/new — CLIENT INTAKE
 * ============================================================================
 *
 * Note the trailing underscore in the filename. `private.clients_.new.tsx` keeps
 * the URL `/private/clients/new` while opting OUT of nesting inside the roster
 * route — intake is a full screen of its own, not a panel drawn on top of a
 * filtered table that would re-run its filters on every keystroke behind it.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ACTION DOES, IN ORDER
 * ---------------------------------------------------------------------------
 *   1. Validate. The same `validateIntake` the browser ran, because a
 *      client-side check is a courtesy and never a gate.
 *   2. Shopify: SEARCH BY EMAIL FIRST. A returning family already has a
 *      customer record, and creating a second one splits their order history in
 *      half and sends the next invoice to the wrong copy. Only when the search
 *      comes back empty is `customerCreate` called.
 *   3. Supabase: the whole record, into `jvgold.clients` — a table with
 *      row-level security — carrying the identity and insurance fields that
 *      must never reach Shopify.
 *
 * Every step reports what it actually did. A save where Shopify was reachable
 * and Supabase was not says exactly that, with the customer id it got, so the
 * coach knows what exists and what does not.
 *
 * ---------------------------------------------------------------------------
 * THE DATA RULE
 * ---------------------------------------------------------------------------
 * Date of birth, insurance policy number and waiver status go to Supabase and
 * ONLY to Supabase. They are never written to a Shopify customer metafield: a
 * metafield definition created with `PUBLIC_READ` access is queryable through
 * the Storefront API with the public token, and that token ships inside this
 * site's browser bundle. The roster is full of minors. See
 * `SUPABASE_ONLY_FIELDS` in `~/components/clients/intakeModel`, and §2.5 of
 * docs/DATA-MODEL.md.
 *
 * SECRETS. `SUPABASE_SERVICE_ROLE_KEY` and the Admin API token are read off
 * `context.env` inside this action and never leave it. Nothing in the loader
 * payload or the action result contains a token, a store domain, a Supabase URL
 * or a raw error body from either service.
 *
 * PRIVACY. Coach-gated and `noindex`, like every screen that touches real
 * athletes. The form posts real names of real children; nothing here may be
 * lifted into a meta tag, an analytics payload or a log line.
 */

import {useNavigation, useActionData, useLoaderData, useSearchParams} from 'react-router';
import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import type {DemoAuthContext} from '~/lib/demoAuth';
import {requireDemoRole} from '~/lib/demoAuth';
import {IntakeForm} from '~/components/clients/IntakeForm';
import {
  draftFromFormData,
  hasErrors,
  phoneDigits,
  shopifySafeDraft,
  validateIntake,
} from '~/components/clients/intakeModel';
import type {
  IntakeDraft,
  IntakeResult,
  ShopifyLinkState,
  ShopifySafeDraft,
} from '~/components/clients/intakeModel';
import {Screen} from '~/components/ops/Screen';
import styles from '~/styles/clients.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  // No athlete name, ever. The tab title is the only thing that leaves.
  return [
    {title: 'New client — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/* ==========================================================================
 * SHOPIFY ADMIN
 *
 * `env.d.ts` does not declare the Admin token and this route may not edit that
 * file, so `context.env` is read through a narrow index signature. Declaring
 * `SHOPIFY_ADMIN_API_ACCESS_TOKEN` there is the follow-up; the cast is local and
 * nothing derived from it is serialised.
 * ======================================================================== */

const ADMIN_API_VERSION = '2026-04';

const ADMIN_TOKEN_KEYS = [
  'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_TOKEN',
] as const;

type EnvBag = Record<string, string | undefined>;

interface AdminCredentials {
  domain: string;
  token: string;
}

/** Credentials, or a sentence naming exactly what is missing. Never both. */
function adminCredentials(
  env: EnvBag,
): {ok: true; value: AdminCredentials} | {ok: false; detail: string} {
  const domain = (env.PUBLIC_STORE_DOMAIN ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const key = ADMIN_TOKEN_KEYS.find((name) => (env[name] ?? '').trim());
  const token = key ? (env[key] ?? '').trim() : '';

  if (!domain || domain === 'mock.shop') {
    return {
      ok: false,
      detail:
        'The store is not linked yet — PUBLIC_STORE_DOMAIN still points at mock.shop, which has no customers. Records save to Supabase and can be connected to Shopify later.',
    };
  }
  if (!token) {
    return {
      ok: false,
      detail:
        'No Shopify Admin API token is set in this environment, so no customer can be matched or created. Records save to Supabase and can be connected later.',
    };
  }
  return {ok: true, value: {domain, token}};
}

interface AdminResult {
  data: Record<string, unknown> | null;
  /** Safe to print. Never Shopify's raw body. */
  error: string | null;
}

async function adminGraphql(
  credentials: AdminCredentials,
  query: string,
  variables: Record<string, unknown>,
): Promise<AdminResult> {
  try {
    const response = await fetch(
      `https://${credentials.domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The only place the token is used. Never logged, never returned.
          'X-Shopify-Access-Token': credentials.token,
        },
        body: JSON.stringify({query, variables}),
      },
    );

    if (!response.ok) {
      return {
        data: null,
        error: `Shopify refused the request (HTTP ${response.status}).`,
      };
    }

    const payload = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: {message?: string}[];
    };
    if (payload.errors?.length) {
      return {
        data: null,
        error: `Shopify rejected the request: ${payload.errors[0]?.message ?? 'unknown error'}`,
      };
    }
    return {data: payload.data ?? null, error: null};
  } catch {
    return {data: null, error: 'Could not reach Shopify.'};
  }
}

const CUSTOMER_SEARCH = `#graphql
  query JvGoldFindCustomer($query: String!) {
    customers(first: 2, query: $query) {
      nodes { id email }
    }
  }
`;

const CUSTOMER_CREATE = `#graphql
  mutation JvGoldCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

interface UserError {
  message?: string;
}

/**
 * Match an existing Shopify customer by email, or create one.
 *
 * SEARCH FIRST is the whole point. Jesse's families come back season after
 * season; a blind `customerCreate` on every intake would give the same parent
 * two customer records, split their orders between them, and send the next
 * invoice to whichever copy the code happened to pick.
 *
 * The argument is a `ShopifySafeDraft`, not an `IntakeDraft`. That is the
 * enforcement rather than the intention: this function CANNOT read a date of
 * birth or an insurance policy number, because those keys are not on its
 * parameter's type. There is no metafield block in the input, and adding one
 * for a protected field would not compile.
 */
async function linkShopifyCustomer(
  env: EnvBag,
  draft: ShopifySafeDraft,
): Promise<{state: ShopifyLinkState; customerId: string | null; detail: string}> {
  const admin = adminCredentials(env);
  if (!admin.ok) {
    return {state: 'unavailable', customerId: null, detail: admin.detail};
  }

  /* --------------------------------------------------------- 1. search */

  // Email is quoted so an address with a dot or a plus is one term, not three.
  const found = await adminGraphql(admin.value, CUSTOMER_SEARCH, {
    query: `email:"${draft.email.replace(/"/g, '')}"`,
  });

  if (found.error) {
    return {
      state: 'failed',
      customerId: null,
      detail: `${found.error} No customer was created — the record is not connected to Shopify.`,
    };
  }

  const nodes =
    (found.data?.customers as {nodes?: {id?: string}[]} | undefined)?.nodes ?? [];
  if (nodes.length > 0 && nodes[0]?.id) {
    return {
      state: 'matched',
      customerId: nodes[0].id,
      detail: `Matched an existing Shopify customer on ${draft.email}. No duplicate was created.`,
    };
  }

  /* --------------------------------------------------------- 2. create */

  const created = await adminGraphql(admin.value, CUSTOMER_CREATE, {
    input: {
      // The PAYER is the customer — the guardian, not the child. Siblings share
      // one Shopify customer and get one roster row each. See §2.3 of
      // docs/DATA-MODEL.md; getting this backwards means the first sibling to
      // check out overwrites the second's record.
      firstName: firstNameOf(draft.guardian || draft.name),
      lastName: lastNameOf(draft.guardian || draft.name),
      email: draft.email,
      phone: e164(draft.phone),
      tags: ['jvgold', 'roster'],
      // NO metafields. Everything Shopify has no honest home for lives in
      // Supabase, and putting a child's paperwork in a metafield risks it
      // being readable with the public storefront token that ships in this
      // site's browser bundle. The parameter type makes it unreachable anyway.
    },
  });

  if (created.error) {
    return {state: 'failed', customerId: null, detail: created.error};
  }

  const payload = created.data?.customerCreate as
    | {customer?: {id?: string} | null; userErrors?: UserError[]}
    | undefined;

  if (payload?.userErrors?.length) {
    return {
      state: 'failed',
      customerId: null,
      detail: `Shopify rejected the customer: ${payload.userErrors[0]?.message ?? 'unknown error'}`,
    };
  }

  const id = payload?.customer?.id ?? null;
  if (!id) {
    return {
      state: 'failed',
      customerId: null,
      detail: 'Shopify returned no customer id, so the record is not connected.',
    };
  }

  return {
    state: 'created',
    customerId: id,
    detail: 'Created a new Shopify customer for this family.',
  };
}

/** `'Sam Sutton'` → `'Sam'`. A single word is the first name. */
function firstNameOf(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? '';
}

/** `'Sam Sutton'` → `'Sutton'`. A single word has no last name; `''` is honest. */
function lastNameOf(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

/** Ten digits → `+1…`. Anything else is passed through as typed. */
function e164(phone: string): string {
  const digits = phoneDigits(phone);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.trim();
}

/* ==========================================================================
 * SUPABASE
 *
 * The record lands in `jvgold.clients`, which has row-level security on it —
 * every read of this row goes through the same `public.is_staff()` policy the
 * rest of the hub does, so a child's date of birth is reachable by staff and by
 * nobody else.
 *
 * The write runs server-side with the service-role key because there is no
 * Supabase access token on this side of the wire: sign-in happens in the
 * browser and the coach gate here is a session cookie. That key bypasses RLS
 * BY DESIGN and is the reason this is the only place it is touched — it is read
 * off `context.env` inside this function, used once, and never serialised,
 * logged or returned.
 * ======================================================================== */

interface SupabaseWriteResult {
  stored: boolean;
  detail: string;
}

function supabaseTarget(env: EnvBag): {url: string; key: string} | null {
  const url = (env.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) return null;
  return {url, key};
}

async function storeClientRow(
  env: EnvBag,
  draft: IntakeDraft,
  shopifyCustomerId: string | null,
): Promise<SupabaseWriteResult> {
  const target = supabaseTarget(env);
  if (!target) {
    return {
      stored: false,
      detail:
        'Supabase is not configured on this environment (PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY), so nothing was written. The record does not exist yet.',
    };
  }

  try {
    const response = await fetch(`${target.url}/rest/v1/clients`, {
      method: 'POST',
      headers: {
        apikey: target.key,
        Authorization: `Bearer ${target.key}`,
        'Content-Type': 'application/json',
        // The operational tables live in the `jvgold` schema, not `public`.
        'Content-Profile': 'jvgold',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        name: draft.name,
        guardian: draft.guardian || null,
        email: draft.email || null,
        phone: draft.phone || null,
        level: draft.level,
        status: draft.status,
        // Identity and insurance. These columns are the reason this row is in
        // Supabase and not in a Shopify metafield.
        date_of_birth: draft.dateOfBirth || null,
        usaw_card_number: draft.usawCardNumber || null,
        insurance_provider: draft.insuranceProvider || null,
        insurance_policy_number: draft.insurancePolicyNumber || null,
        emergency_contact_name: draft.emergencyContactName || null,
        emergency_contact_phone: draft.emergencyContactPhone || null,
        waiver_signed: draft.waiver === 'signed',
        source: 'manual',
        shopify_customer_id: shopifyCustomerId,
      }),
    });

    if (!response.ok) {
      // PostgREST's body can echo column values back. Report the status and
      // nothing else — this row contains a child's date of birth.
      return {
        stored: false,
        detail: `Supabase refused the insert (HTTP ${response.status}). Nothing was written. If this is a schema error, confirm the \`jvgold\` schema is exposed to PostgREST.`,
      };
    }

    return {
      stored: true,
      detail:
        'Stored in Supabase (jvgold.clients) behind row-level security. Date of birth, insurance policy number and waiver status are here and nowhere else.',
    };
  } catch {
    return {
      stored: false,
      detail: 'Could not reach Supabase. Nothing was written.',
    };
  }
}

/* ==========================================================================
 * LOADER
 * ======================================================================== */

export async function loader({context}: LoaderFunctionArgs) {
  const auth = context as unknown as DemoAuthContext;
  requireDemoRole(auth, 'coach');
  const env = auth.env as unknown as EnvBag;

  // Credentials are TESTED here and thrown away. Only a boolean and a sentence
  // cross to the browser — never a domain, a URL or a token.
  const admin = adminCredentials(env);
  const supabase = supabaseTarget(env);

  return {
    shopifyReady: admin.ok,
    shopifyDetail: admin.ok
      ? 'The store is linked, so the search runs against real customers.'
      : admin.detail,
    supabaseReady: Boolean(supabase),
    supabaseDetail: supabase
      ? 'Configured. The row lands in jvgold.clients under row-level security.'
      : 'Not configured on this environment — PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both needed before a record can be saved.',
  };
}

/* ==========================================================================
 * ACTION
 * ======================================================================== */

export async function action({request, context}: ActionFunctionArgs) {
  const auth = context as unknown as DemoAuthContext;
  requireDemoRole(auth, 'coach');
  const env = auth.env as unknown as EnvBag;

  const draft = draftFromFormData(await request.formData());
  const errors = validateIntake(draft);

  if (hasErrors(errors)) {
    const result: IntakeResult = {
      ok: false,
      errors,
      message: 'Nothing was saved.',
      shopify: {state: 'unavailable', customerId: null, detail: ''},
      supabase: {stored: false, detail: ''},
    };
    return result;
  }

  // Shopify first: the customer id is a column on the Supabase row, so linking
  // before storing means one write rather than a write and a patch. A Shopify
  // failure does not stop the record being created — the athlete is real
  // whether or not the store is reachable, and the roster can connect them
  // later from their client record.
  //
  // `shopifySafeDraft` is the one-way door. Everything past it is name and
  // contact details; the identity and insurance fields never make the trip.
  const shopify = await linkShopifyCustomer(env, shopifySafeDraft(draft));
  const supabase = await storeClientRow(env, draft, shopify.customerId);

  const result: IntakeResult = {
    ok: supabase.stored,
    errors: {},
    message: supabase.stored
      ? `${draft.name} is on the roster. ${shopify.detail}`
      : `${draft.name} was NOT saved. ${supabase.detail}`,
    shopify,
    supabase,
  };
  return result;
}

/* ==========================================================================
 * SCREEN
 * ======================================================================== */

export default function NewClientRoute() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>() ?? null;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  /**
   * Back goes to the roster WITH his filters still on it. The roster keeps its
   * whole state in the URL, so carrying the query string here is all it takes
   * for "cancel" to land him exactly where he left.
   */
  const query = searchParams.toString();
  const backTo = query ? `/private/clients?${query}` : '/private/clients';

  return (
    <Screen
      rootClassName="clients-page"
      eyebrow="Intake"
      title="Add an athlete"
      subtitle="Everything the roster, insurance and event registration will ask you for."
      back={{to: backTo, label: 'Roster'}}
      notice="Real athletes, several of them minors. This screen is coach-only. Date of birth, insurance policy number and waiver status are stored in Supabase behind row-level security and are never written to Shopify."
      noticeRole="note"
    >
      <IntakeForm
        result={result}
        busy={navigation.state === 'submitting'}
        backTo={backTo}
        shopifyReady={data.shopifyReady}
        shopifyDetail={data.shopifyDetail}
        supabaseReady={data.supabaseReady}
        supabaseDetail={data.supabaseDetail}
      />
    </Screen>
  );
}
