import {redirect} from 'react-router';

/**
 * DEMO AUTH — NOT SHOPIFY CUSTOMER AUTH.
 *
 * One tiny module behind both preview gates:
 *   /private  → role 'coach'    (Jesse + staff management view)
 *   /portal   → role 'customer' (parent / athlete view)
 *
 * Both are self-contained session-cookie gates built so the client can walk
 * each experience today, while the site still runs against mock.shop.
 * Shopify's real Customer Account API cannot be exercised on localhost or
 * mock.shop, so the real starter routes (account*.jsx, account_.login.jsx,
 * account_.authorize.jsx, account_.logout.jsx) are left untouched and will
 * take over once the store is linked and deployed to Oxygen.
 *
 * To delete the whole preview later: remove app/routes/private*.tsx,
 * app/routes/portal*.tsx, app/components/private/, app/components/portal/,
 * app/styles/private.css, app/styles/portal.css and this file. Nothing else
 * depends on it.
 *
 * Credentials come from context.env with hardcoded fallbacks so both gates
 * work with zero .env setup:
 *   DEMO_LOGIN_EMAIL       (default jesse@jvgold.com)
 *   DEMO_LOGIN_PASSWORD    (default GreaterLater26)
 *   DEMO_CUSTOMER_EMAIL    (default parent@deepwaters.com)
 *   DEMO_CUSTOMER_PASSWORD (default DeepWaters26)
 *
 * The two roles live under separate session keys, so signing in as a parent
 * never grants the management view and vice versa.
 */

export type DemoRole = 'coach' | 'customer';

/** Minimal shape of the Hydrogen session this module touches. */
interface DemoSession {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  unset(key: string): void;
}

/** Minimal shape of the loader/action context this module touches. */
export interface DemoAuthContext {
  session: DemoSession;
  env: Env;
}

/**
 * Session keys, one per role. 'jvDemoUser' is the key the coach gate has
 * always used — keeping it means existing signed-in sessions survive this
 * refactor untouched.
 */
export const DEMO_SESSION_KEYS: Record<DemoRole, string> = {
  coach: 'jvDemoUser',
  customer: 'jvDemoCustomer',
};

/** Where each role signs in and lands. */
export const DEMO_ROUTES: Record<DemoRole, {login: string; dashboard: string}> =
  {
    coach: {login: '/private', dashboard: '/private/dashboard'},
    customer: {login: '/portal', dashboard: '/portal/dashboard'},
  };

const DEMO_FALLBACKS: Record<DemoRole, {email: string; password: string}> = {
  coach: {email: 'jesse@jvgold.com', password: 'GreaterLater26'},
  customer: {email: 'parent@deepwaters.com', password: 'DeepWaters26'},
};

/**
 * Constant-time-ish string comparison — avoids a naive === short-circuit
 * leaking length/prefix information through timing. Cheap, not a substitute
 * for real credential storage; fine for a demo gate.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length, 1);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function demoCredentials(env: Env, role: DemoRole) {
  const fallback = DEMO_FALLBACKS[role];
  if (role === 'coach') {
    return {
      email: env.DEMO_LOGIN_EMAIL ?? fallback.email,
      password: env.DEMO_LOGIN_PASSWORD ?? fallback.password,
    };
  }
  return {
    email: env.DEMO_CUSTOMER_EMAIL ?? fallback.email,
    password: env.DEMO_CUSTOMER_PASSWORD ?? fallback.password,
  };
}

/**
 * Check a submitted email/password pair against the demo credentials for a
 * role. Never logs, echoes or returns the submitted password.
 */
export function verifyDemoCredentials(
  env: Env,
  role: DemoRole,
  email: string,
  password: string,
): boolean {
  const expected = demoCredentials(env, role);
  const emailOk = timingSafeStringEqual(
    email.trim().toLowerCase(),
    expected.email.toLowerCase(),
  );
  const passwordOk = timingSafeStringEqual(password, expected.password);
  return emailOk && passwordOk;
}

/** The signed-in demo identity for a role, or null. */
export function getDemoUser(
  context: DemoAuthContext,
  role: DemoRole,
): string | null {
  const value = context.session.get(DEMO_SESSION_KEYS[role]);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function setDemoUser(
  context: DemoAuthContext,
  role: DemoRole,
  email: string,
): void {
  context.session.set(DEMO_SESSION_KEYS[role], email);
}

export function clearDemoUser(context: DemoAuthContext, role: DemoRole): void {
  context.session.unset(DEMO_SESSION_KEYS[role]);
}

/**
 * Dashboard guard. Throws a redirect to that role's login screen when the
 * session doesn't carry the role. A coach session never satisfies the
 * customer portal, and vice versa.
 */
export function requireDemoRole(
  context: DemoAuthContext,
  role: DemoRole,
): string {
  const user = getDemoUser(context, role);
  if (!user) {
    throw redirect(DEMO_ROUTES[role].login);
  }
  return user;
}

/** Login-screen guard — bounce an already-signed-in visitor to their view. */
export function redirectIfSignedIn(
  context: DemoAuthContext,
  role: DemoRole,
): void {
  if (getDemoUser(context, role)) {
    throw redirect(DEMO_ROUTES[role].dashboard);
  }
}

/**
 * Both roles at once, for the root loader / header. Serialisable, and safe to
 * send to the client — it carries the demo email only, never a password.
 */
export function getDemoSession(context: DemoAuthContext): {
  coach: string | null;
  customer: string | null;
} {
  return {
    coach: getDemoUser(context, 'coach'),
    customer: getDemoUser(context, 'customer'),
  };
}
