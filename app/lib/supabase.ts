/**
 * ============================================================================
 * SUPABASE — THE ROAD
 * ============================================================================
 *
 * One module for every Supabase touchpoint the app has:
 *
 *   browser  getSupabaseBrowserClient()  lazy singleton, dynamic import(),
 *                                        returns null when unconfigured
 *            usePublicEnv()              the root loader's serialised env
 *
 *   server   supabaseConfig()            url + anon key, or null
 *            verifySupabaseAccessToken() proves a browser-side sign-in
 *            isStaffAccessToken()        asks the DB's own public.is_staff()
 *
 * WHY THE SERVER HALF EXISTS. Sign-in happens in the browser (supabase-js owns
 * the session and its refresh, and later data work runs authenticated from the
 * client so row-level security applies). But the dashboards are gated by a
 * server-side session cookie. So after a successful browser sign-in the login
 * screen posts the access token back, and the action here verifies it against
 * Supabase's own /auth/v1/user endpoint before it will set that cookie. A
 * client that simply POSTs an email gets nothing.
 *
 * WHAT IS PUBLIC. Only PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY ever
 * leave the server. The anon key is designed to be public — RLS is the wall.
 * SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL bypass RLS and must NEVER be
 * serialised, imported here, or referenced in anything the client bundles.
 *
 * React 18 only: no `use()`, no top-level await, no browser API outside an
 * effect or an event handler.
 */

import {useRouteLoaderData} from 'react-router';
import type {SupabaseClient} from '@supabase/supabase-js';

/* ==========================================================================
 * PUBLIC ENV — the browser half
 * ======================================================================== */

/** The only Supabase values the browser is ever given. */
export interface PublicEnv {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export const EMPTY_PUBLIC_ENV: PublicEnv = {
  supabaseUrl: null,
  supabaseAnonKey: null,
};

/**
 * Read the `publicEnv` the root loader serialises. Falls back to nulls so a
 * route rendered without root data (an error boundary, say) degrades to the
 * "not configured" path instead of throwing.
 */
export function usePublicEnv(): PublicEnv {
  const data = useRouteLoaderData('root') as
    | {publicEnv?: Partial<PublicEnv>}
    | undefined;
  return {
    supabaseUrl: data?.publicEnv?.supabaseUrl ?? null,
    supabaseAnonKey: data?.publicEnv?.supabaseAnonKey ?? null,
  };
}

/** True when both public values are present. */
export function isSupabaseConfigured(env: PublicEnv): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

let client: SupabaseClient | null = null;

/**
 * Browser-side Supabase client (singleton). The SDK is imported dynamically so
 * it never weighs down first paint, and the session it stores is the same one
 * every later query on the page reuses — which is what makes RLS resolve to a
 * real `auth.uid()` instead of anon.
 *
 * Resolves null on the server and whenever the project env vars are missing,
 * so every caller can degrade gracefully rather than crash.
 */
export async function getSupabaseBrowserClient(
  env: PublicEnv,
): Promise<SupabaseClient | null> {
  if (typeof document === 'undefined') return null; // browser only
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  if (!client) {
    const {createClient} = await import('@supabase/supabase-js');
    client = createClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}

/* ==========================================================================
 * SERVER — token verification
 * ======================================================================== */

/** The slice of `context.env` this module reads. Nothing secret in it. */
export interface SupabaseServerEnv {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_ANON_KEY?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Normalised project config, or null when the environment is not wired up. */
export function supabaseConfig(env: SupabaseServerEnv): SupabaseConfig | null {
  const url = (env?.PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = (env?.PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey) return null;
  return {url, anonKey};
}

/** A verified Supabase identity. Never carries a token. */
export interface SupabaseIdentity {
  id: string;
  email: string;
}

/**
 * Verify an access token minted by a browser sign-in.
 *
 * Asks Supabase itself (`GET /auth/v1/user`) rather than decoding the JWT
 * locally — no signing key on this side, and a revoked or expired token is
 * rejected by the same authority that issued it. Returns null on any failure;
 * callers must treat null as "not signed in".
 */
export async function verifySupabaseAccessToken(
  env: SupabaseServerEnv,
  accessToken: string | null | undefined,
): Promise<SupabaseIdentity | null> {
  const config = supabaseConfig(env);
  const token = (accessToken ?? '').trim();
  if (!config || !token) return null;

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as {id?: string; email?: string};
    if (!user?.id) return null;
    return {id: user.id, email: (user.email ?? '').toLowerCase()};
  } catch {
    // Network/DNS failure — indistinguishable from "unverified" from here.
    return null;
  }
}

/**
 * Ask the database whether this token belongs to a member of public.staff, by
 * calling the very function the RLS policies use: `public.is_staff()`.
 *
 * Returns true / false when the answer is definitive, and NULL when the
 * question could not be asked (function not exposed over PostgREST, network
 * error, unexpected payload). Callers should treat null as "unknown" and let
 * the visitor through: RLS is still the wall, so a non-staff account that
 * slips past this check sees an empty database rather than someone else's
 * data. Failing closed here would lock the whole team out over a schema quirk.
 */
export async function isStaffAccessToken(
  env: SupabaseServerEnv,
  accessToken: string | null | undefined,
): Promise<boolean | null> {
  const config = supabaseConfig(env);
  const token = (accessToken ?? '').trim();
  if (!config || !token) return null;

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/is_staff`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}
