import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link, redirect, useFetcher, useLoaderData} from 'react-router';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Img} from '~/components/site/Img';
import {Screen} from '~/components/ops/Screen';
import {PrivateMark} from '~/components/private/PrivateMark';
import {
  DEMO_ROUTES,
  consumeSupabaseSignOut,
  redirectIfSignedIn,
  setDemoUser,
  verifyDemoCredentials,
} from '~/lib/demoAuth';
import {
  getSupabaseBrowserClient,
  isStaffAccessToken,
  supabaseConfig,
  usePublicEnv,
  verifySupabaseAccessToken,
} from '~/lib/supabase';
import styles from '~/styles/private.css?url';
import type {Route} from './+types/private._index';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Private Access — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/**
 * ============================================================================
 * THE BACK DOOR — STAFF SIGN-IN
 * ============================================================================
 *
 * REAL AUTH, in the light register.
 *
 * HOW A SIGN-IN ACTUALLY TRAVELS:
 *   1. The browser signs in with supabase-js (email/password, or Google).
 *      supabase-js keeps the session — that is what makes every later query
 *      from this browser run as a real `auth.uid()` instead of anon, which is
 *      the whole point: `public.is_staff()` reads `auth.uid()`, and RLS
 *      returns an EMPTY ARRAY, silently, to anyone it doesn't recognise.
 *   2. The page posts the resulting access token to the action below.
 *   3. The action verifies that token with Supabase itself, asks the database
 *      whether the account is staff, and only then writes the session cookie
 *      that guards /private/*. Posting an email alone gets you nothing.
 *
 * IF SUPABASE IS NOT CONFIGURED the screen falls back to the old demo
 * credential gate so nobody is locked out mid-transition. That mode is
 * announced in the banner at the top of the screen, and it carries no
 * Supabase identity — see app/lib/demoAuth.ts.
 */

export async function loader({context}: Route.LoaderArgs) {
  redirectIfSignedIn(context, 'coach');
  return {
    supabaseReady: Boolean(supabaseConfig(context.env)),
    // Set when a logout cleared the cookie; the browser still has to drop its
    // own Supabase session.
    signOutPending: consumeSupabaseSignOut(context),
  };
}

type ActionResult = {error: string; signOut?: boolean};

const fail = (error: string, signOut = false): ActionResult => ({
  error,
  signOut,
});

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const supabaseReady = Boolean(supabaseConfig(context.env));

  // ---- real sign-in: verify the token the browser just earned ----
  if (intent === 'supabase') {
    const accessToken = String(formData.get('accessToken') ?? '');
    const identity = await verifySupabaseAccessToken(context.env, accessToken);
    if (!identity) {
      return fail('That session couldn’t be verified. Sign in again.', true);
    }

    // Ask the database the same question its own policies ask. `null` means
    // the question couldn't be asked — let it through, because RLS still
    // shows a non-staff account nothing at all.
    const staff = await isStaffAccessToken(context.env, accessToken);
    if (staff === false) {
      return fail(
        'That account isn’t on the staff list. Ask Jesse to add it, then try again.',
        true,
      );
    }

    setDemoUser(context, 'coach', identity.email);
    throw redirect(DEMO_ROUTES.coach.dashboard);
  }

  // ---- no-JS post while Supabase IS configured ----
  if (supabaseReady) {
    return fail(
      'Sign-in needs JavaScript switched on. Enable it and reload this page.',
    );
  }

  // ---- fallback: the demo gate, only while Supabase is unconfigured ----
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!verifyDemoCredentials(context.env, 'coach', email, password)) {
    // Never log the submitted password.
    return fail('That email and password don’t match. Try again.');
  }

  setDemoUser(context, 'coach', email);
  throw redirect(DEMO_ROUTES.coach.dashboard);
}

export default function PrivateLoginPage() {
  const {supabaseReady, signOutPending} = useLoaderData<typeof loader>();
  const env = usePublicEnv();
  const fetcher = useFetcher<ActionResult>();

  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [checking, setChecking] = useState(supabaseReady);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const handedOff = useRef(false);

  const submitToken = (accessToken: string) => {
    void fetcher.submit({intent: 'supabase', accessToken}, {method: 'post'});
  };

  // Boot the browser client, and pick up a session that already exists —
  // either because Google just redirected back here, or because the visitor
  // never signed out of Supabase.
  useEffect(() => {
    // Read this BEFORE supabase-js scrubs the OAuth params out of the URL.
    const returningFromOAuth =
      window.location.hash.includes('access_token') ||
      new URLSearchParams(window.location.search).has('code');

    let cancelled = false;

    void getSupabaseBrowserClient(env).then(async (supabase) => {
      if (cancelled) return;
      setClient(supabase);
      if (!supabase) {
        setChecking(false);
        return;
      }

      // A logout cleared the cookie; finish the job on this side.
      if (signOutPending) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setAccount(null);
        setChecking(false);
        return;
      }

      const {data} = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      setAccount(session?.user.email ?? null);
      setChecking(false);

      // Only auto-continue when Google sent them back. Otherwise the visitor
      // presses "Continue" themselves — a logout must never bounce straight
      // back into the dashboard.
      if (session && returningFromOAuth && !handedOff.current) {
        handedOff.current = true;
        submitToken(session.access_token);
      }
    });

    return () => {
      cancelled = true;
    };
    // env and the flag are fixed for the life of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The server refused the token (not staff, expired). Drop the client session
  // too, so the screen doesn't keep offering an account that can't get in.
  useEffect(() => {
    if (!client || !fetcher.data?.signOut) return;
    void client.auth.signOut().then(() => setAccount(null));
  }, [client, fetcher.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // No client => the demo fallback; let the form post to the action.
    if (!client) return;
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setError(null);
    setBusy(true);
    const {data, error: signInError} = await client.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);

    if (signInError || !data.session) {
      setError(signInError?.message ?? 'That sign-in didn’t take. Try again.');
      return;
    }
    handedOff.current = true;
    submitToken(data.session.access_token);
  }

  async function handleGoogle() {
    if (!client) return;
    setError(null);
    const {error: oauthError} = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {redirectTo: `${window.location.origin}/private`},
    });
    if (oauthError) setError(oauthError.message);
  }

  async function handleContinue() {
    if (!client) return;
    setError(null);
    setBusy(true);
    const {data} = await client.auth.getSession();
    setBusy(false);
    if (!data.session) {
      setAccount(null);
      setError('That session expired. Sign in again.');
      return;
    }
    handedOff.current = true;
    submitToken(data.session.access_token);
  }

  async function handleUseAnother() {
    if (!client) return;
    await client.auth.signOut();
    setAccount(null);
    setError(null);
  }

  const shownError = error ?? fetcher.data?.error ?? null;
  const working = busy || fetcher.state !== 'idle';
  const errorId = shownError ? 'private-error' : undefined;

  return (
    <Screen
      mark={<PrivateMark className="h-12 w-auto" />}
      eyebrow="Staff Access"
      title="The Back Door"
      subtitle="A private entrance for Jesse and his team. Not for athletes or families — that account system lives elsewhere."
      back={{to: '/', label: 'Back to the site'}}
      notice={
        supabaseReady ? undefined : (
          <>
            Preview mode — Supabase isn’t configured on this environment, so
            this door uses the demo credentials and no live data.
          </>
        )
      }
      className="pb-24"
      mainId="private-main"
    >
      <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        {/* GATE */}
        <div data-reveal>
          {checking ? (
            <p className="ops-mute text-sm leading-relaxed">
              Checking your session…
            </p>
          ) : null}

          {!checking && account ? (
            <div className="private-resume ops-rule border-b pb-8">
              <p className="tag ops-accent">Already signed in</p>
              <p className="mt-3 text-sm leading-relaxed">
                This browser is signed in as{' '}
                <span className="font-semibold">{account}</span>.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="ops-btn ops-btn-primary"
                  onClick={() => void handleContinue()}
                  disabled={working}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="ops-btn ops-btn-quiet"
                  onClick={() => void handleUseAnother()}
                  disabled={working}
                >
                  Use another account
                </button>
              </div>
            </div>
          ) : null}

          <fetcher.Form
            method="post"
            className="mt-10 space-y-8"
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="private-field-shell">
              <label htmlFor="email" className="tag ops-mute mb-1 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="private-field"
                placeholder="jesse@jvgold.com"
                aria-describedby={errorId}
              />
            </div>

            <div className="private-field-shell">
              <label htmlFor="password" className="tag ops-mute mb-1 block">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="private-field"
                placeholder="••••••••"
                aria-describedby={errorId}
              />
            </div>

            {shownError ? (
              <p
                id="private-error"
                role="alert"
                className="private-error ops-warn border-l pl-4 text-sm leading-relaxed"
              >
                {shownError}
              </p>
            ) : null}

            {/* Disabled while the SDK boots: a submit landing in that window
                would post to the demo branch and be refused. In demo mode
                `checking` is false from the first render, so a no-JS visitor
                still gets a working button. */}
            <button
              type="submit"
              disabled={working || checking}
              className="private-submit display flex w-full items-center justify-center gap-3 py-4 text-sm tracking-[0.18em]"
            >
              {working ? (
                <>
                  <span className="ops-dot private-pulse" aria-hidden="true" />
                  Checking
                </>
              ) : (
                'Enter'
              )}
            </button>
          </fetcher.Form>

          {client ? (
            <div className="mt-8">
              <p className="tag ops-mute private-or ops-rule">or</p>
              <button
                type="button"
                className="ops-btn mt-6 w-full"
                onClick={() => void handleGoogle()}
                disabled={working}
              >
                Continue with Google
              </button>
            </div>
          ) : null}

          <p className="ops-mute ops-rule mt-12 border-t pt-5 text-xs leading-relaxed">
            {supabaseReady
              ? 'Staff accounts are provisioned by Jesse. Access is checked against the staff list every time — a personal Google account won’t open this door on its own.'
              : 'Demo credentials for testing only — ask the team if you need them.'}
          </p>
        </div>

        {/* PLATE — a dark object on a light page, so it carries .ops-dark and
            its tokens flip with it. */}
        <aside
          className="ops-dark private-plate relative hidden overflow-hidden lg:block"
          data-reveal
          style={{'--reveal-delay': '160ms'} as React.CSSProperties}
        >
          <Img
            id="20CIFFNL3801"
            alt=""
            size="hero"
            fill
            sizes="(min-width: 1024px) 55vw, 0px"
            className="img-mono"
          />
          <div className="private-plate-veil" aria-hidden="true" />
          <div className="private-plate-copy">
            <p className="tag ops-accent">Riverside, California</p>
            <p className="display ops-ink mt-4 max-w-[16ch] text-[clamp(1.75rem,2.6vw,2.75rem)]">
              Built in the
              <br />
              hours nobody
              <br />
              claps for
            </p>
          </div>
        </aside>
      </div>

      <p className="ops-mute mt-16 text-xs leading-relaxed lg:hidden">
        Families and athletes sign in at{' '}
        <Link to="/portal" className="ops-accent underline underline-offset-4">
          the front door
        </Link>
        .
      </p>
    </Screen>
  );
}
