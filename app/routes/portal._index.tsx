import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link, redirect, useFetcher, useLoaderData} from 'react-router';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Img} from '~/components/site/Img';
import {Screen} from '~/components/ops/Screen';
import {PortalMark} from '~/components/portal/PortalMark';
import {
  DEMO_ROUTES,
  consumeSupabaseSignOut,
  redirectIfSignedIn,
  setDemoUser,
  verifyDemoCredentials,
} from '~/lib/demoAuth';
import {
  getSupabaseBrowserClient,
  supabaseConfig,
  usePublicEnv,
  verifySupabaseAccessToken,
} from '~/lib/supabase';
import styles from '~/styles/portal.css?url';
import type {Route} from './+types/portal._index';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Family Portal — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/**
 * ============================================================================
 * THE FRONT DOOR — FAMILY SIGN-IN
 * ============================================================================
 *
 * The staff door's twin (app/routes/private._index.tsx), same machinery, two
 * differences: no Google button, and no staff check — a family account is not
 * meant to be on public.staff. Row-level security decides what each signed-in
 * family can see; this screen only proves who they are.
 *
 * Sign-in happens in the browser with supabase-js, the resulting access token
 * is posted to the action, and the action verifies it with Supabase before it
 * writes the session cookie that guards /portal/*.
 *
 * With Supabase unconfigured this falls back to the demo credential gate, and
 * says so in the banner. See app/lib/demoAuth.ts.
 */

export async function loader({context}: Route.LoaderArgs) {
  redirectIfSignedIn(context, 'customer');
  return {
    supabaseReady: Boolean(supabaseConfig(context.env)),
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
    setDemoUser(context, 'customer', identity.email);
    throw redirect(DEMO_ROUTES.customer.dashboard);
  }

  // ---- no-JS post while Supabase IS configured ----
  if (supabaseReady) {
    return fail(
      'Signing in needs JavaScript switched on. Turn it on and reload this page — or text the front desk and we’ll help.',
    );
  }

  // ---- fallback: the demo gate, only while Supabase is unconfigured ----
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!verifyDemoCredentials(context.env, 'customer', email, password)) {
    // Never log the submitted password.
    return fail(
      'That email and password don’t match. Check them and try again — or text the front desk and we’ll sort it out.',
    );
  }

  setDemoUser(context, 'customer', email);
  throw redirect(DEMO_ROUTES.customer.dashboard);
}

export default function PortalLoginPage() {
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

  useEffect(() => {
    let cancelled = false;

    void getSupabaseBrowserClient(env).then(async (supabase) => {
      if (cancelled) return;
      setClient(supabase);
      if (!supabase) {
        setChecking(false);
        return;
      }

      // A logout cleared the cookie; finish the job on this side, because
      // supabase-js keeps its session in localStorage where no route can
      // reach it.
      if (signOutPending) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setAccount(null);
        setChecking(false);
        return;
      }

      const {data} = await supabase.auth.getSession();
      if (cancelled) return;
      setAccount(data.session?.user.email ?? null);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
    // env and the flag are fixed for the life of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The server refused the token (expired, revoked). Drop the client session
  // too, so the screen stops offering an account that can't get in.
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
      setError(
        signInError?.message ??
          'That didn’t go through. Check the email and password and try again.',
      );
      return;
    }
    handedOff.current = true;
    submitToken(data.session.access_token);
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
  const errorId = shownError ? 'portal-error' : undefined;

  return (
    <Screen
      mark={<PortalMark className="h-12 w-auto" />}
      eyebrow="Families & Athletes"
      title="The Front Door"
      subtitle="Everything for your athlete in one place — the sessions you’ve booked, what’s left on your package, camp balances and every receipt."
      back={{to: '/', label: 'Back to the site'}}
      notice={
        supabaseReady ? undefined : (
          <>
            Preview mode — accounts aren’t connected on this environment yet,
            so this door uses a sample family login.
          </>
        )
      }
      className="pb-24"
      mainId="portal-main"
    >
      <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        {/* DOOR */}
        <div data-reveal>
          {checking ? (
            <p className="ops-mute text-sm leading-relaxed">
              Checking your session…
            </p>
          ) : null}

          {!checking && account ? (
            <div className="portal-resume ops-rule border-b pb-8">
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
            <div className="portal-field-shell">
              <label htmlFor="email" className="tag ops-mute mb-1 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="portal-field"
                placeholder="you@example.com"
                aria-describedby={errorId}
              />
            </div>

            <div className="portal-field-shell">
              <label htmlFor="password" className="tag ops-mute mb-1 block">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="portal-field"
                placeholder="••••••••"
                aria-describedby={errorId}
              />
            </div>

            {shownError ? (
              <p
                id="portal-error"
                role="alert"
                className="portal-error ops-warn border-l pl-4 text-sm leading-relaxed"
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
              className="portal-submit display flex w-full items-center justify-center gap-3 py-4 text-sm tracking-[0.18em]"
            >
              {working ? (
                <>
                  <span className="ops-dot portal-pulse" aria-hidden="true" />
                  Checking
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </fetcher.Form>

          <div className="ops-mute ops-rule mt-12 space-y-4 border-t pt-5 text-xs leading-relaxed">
            <p>
              {supabaseReady
                ? 'Accounts are set up by the club. If you don’t have one yet, book a session and we’ll open it for you.'
                : 'This is a sample family account so the experience can be walked before launch.'}
            </p>
            <p>
              New to the club?{' '}
              <Link
                to="/train"
                className="portal-action ops-accent underline underline-offset-4"
              >
                Start with a session
              </Link>
              .
            </p>
          </div>
        </div>

        {/* PLATE — a dark object on a light page, so it carries .ops-dark and
            its tokens flip with it. */}
        <aside
          className="ops-dark portal-plate relative hidden overflow-hidden lg:block"
          data-reveal
          style={{'--reveal-delay': '160ms'} as React.CSSProperties}
        >
          <Img
            id="19HSWCIFF9945"
            alt=""
            size="hero"
            fill
            sizes="(min-width: 1024px) 55vw, 0px"
            className="img-mono"
          />
          <div className="portal-plate-veil" aria-hidden="true" />
          <div className="portal-plate-copy">
            <p className="tag ops-accent">Deep Waters Wrestling Club</p>
            <p className="display ops-ink mt-4 max-w-[16ch] text-[clamp(1.75rem,2.6vw,2.75rem)]">
              Nobody gets
              <br />
              there alone
            </p>
          </div>
        </aside>
      </div>

      <p className="ops-mute mt-16 text-xs leading-relaxed lg:hidden">
        Staff sign in at{' '}
        <Link to="/private" className="ops-accent underline underline-offset-4">
          the back door
        </Link>
        .
      </p>
    </Screen>
  );
}
