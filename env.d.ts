/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  interface Env {
    /**
     * Shopify Admin API access token. SERVER ONLY — never serialise it, never
     * put it behind a PUBLIC_ name. It grants full read/write on the store,
     * far beyond what the storefront token can do.
     *
     * `shopify hydrogen env pull` does NOT provide this; it only supplies
     * storefront and customer-account credentials. It has to be created by
     * hand as a custom app in the Shopify admin (Settings → Apps and sales
     * channels → Develop apps), with `write_draft_orders` and
     * `write_customers` scopes at minimum.
     *
     * Without it, invoicing a client and creating a Shopify customer both
     * degrade to a disabled state that says so. That is deliberate — a
     * silently failing invoice button would be worse.
     */
    SHOPIFY_ADMIN_API_ACCESS_TOKEN?: string;
    /**
     * Supabase project URL. PUBLIC — it is serialised to the browser by the
     * root loader and used by app/lib/supabase.ts. Row-level security, not
     * secrecy, is what protects the data behind it.
     */
    PUBLIC_SUPABASE_URL?: string;
    /**
     * Supabase anon key. PUBLIC by design — it only ever grants what RLS
     * allows the signed-in user (or anon) to see.
     *
     * NEVER declare SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL here and
     * never serialise them: they bypass RLS entirely and must stay on the
     * server, read straight off `context.env` where they are needed.
     */
    PUBLIC_SUPABASE_ANON_KEY?: string;

    // Demo/preview credentials for the two gates — /private (staff) and
    // /portal (parent/athlete). Only used when Supabase is unconfigured;
    // see app/lib/demoAuth.ts.
    DEMO_LOGIN_EMAIL?: string;
    DEMO_LOGIN_PASSWORD?: string;
    DEMO_CUSTOMER_EMAIL?: string;
    DEMO_CUSTOMER_PASSWORD?: string;

    /**
     * Google Calendar OAuth. All three are SERVER-ONLY and read straight off
     * `context.env` by app/lib/ops/googleCalendar.ts, which returns null when
     * any of them is missing so screens degrade to an explicit disabled state
     * instead of crashing.
     *
     * NEVER serialise GOOGLE_CLIENT_SECRET, or any access/refresh token derived
     * from it, into a loader payload — the grant reads free/busy across every
     * one of Jesse's calendars and writes to the JV GOLD calendar.
     */
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    /**
     * Must equal the Authorised redirect URI registered in Google Cloud, byte
     * for byte, and must point at /private/calendar/connect — that route is
     * itself the OAuth callback.
     */
    GOOGLE_REDIRECT_URI?: string;
  }
}
