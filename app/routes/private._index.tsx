import {Form, redirect, useActionData, useNavigation} from 'react-router';
import {Img} from '~/components/site/Img';
import {PrivateMark} from '~/components/private/PrivateMark';
import {
  DEMO_ROUTES,
  redirectIfSignedIn,
  setDemoUser,
  verifyDemoCredentials,
} from '~/lib/demoAuth';
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
 * DEMO GATE — NOT SHOPIFY CUSTOMER AUTH. See app/lib/demoAuth.ts for the
 * shared credential check, the session keys and why this exists. This screen
 * is the 'coach' role; the parent/athlete preview lives at /portal.
 */

export async function loader({context}: Route.LoaderArgs) {
  redirectIfSignedIn(context, 'coach');
  return null;
}

export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!verifyDemoCredentials(context.env, 'coach', email, password)) {
    // Never log the submitted password.
    return {error: 'That email and password don’t match. Try again.'};
  }

  setDemoUser(context, 'coach', email);
  throw redirect(DEMO_ROUTES.coach.dashboard);
}

export default function PrivateLoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="min-h-[100svh] bg-onyx-deep text-stone">
      <div className="grid min-h-[100svh] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* PLATE — monochrome, full-bleed, silent. Hidden on phones so the
            form owns the whole viewport where Jesse actually signs in. */}
        <div className="relative hidden overflow-hidden bg-onyx lg:block">
          <Img
            id="20CIFFNL3801"
            alt=""
            size="hero"
            fill
            sizes="(min-width: 1024px) 55vw, 0px"
            className="img-mono"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-onyx-deep/70 via-onyx-deep/25 to-onyx-deep"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
            <p className="tag text-gold">Riverside, California</p>
            <p className="display mt-4 max-w-[16ch] text-[clamp(1.75rem,2.6vw,2.75rem)] text-stone">
              Built in the
              <br />
              hours nobody
              <br />
              claps for
            </p>
          </div>
        </div>

        {/* GATE */}
        <div className="relative flex items-center justify-center overflow-hidden px-5 py-20 sm:px-10 lg:px-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#C8A25B,transparent_65%)]" />
          </div>

          <div className="relative w-full max-w-[26rem]">
            <div data-reveal>
              <PrivateMark className="h-14 w-auto text-gold" />
              <p className="tag mt-10 text-gold-deep">Staff Access</p>
              <h1 className="display mt-4 text-[clamp(2.25rem,7vw,3.25rem)]">
                The Back Door
              </h1>
              <p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-steel">
                A private entrance for Jesse and his team. Not for athletes or
                families — that account system lives elsewhere.
              </p>
            </div>

            <Form
              method="post"
              className="mt-14 space-y-9"
              noValidate
              data-reveal
              style={{'--reveal-delay': '120ms'} as React.CSSProperties}
            >
              <div className="private-field-shell">
                <label
                  htmlFor="email"
                  className="tag mb-1 block text-steel"
                >
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
                  aria-describedby={actionData?.error ? 'private-error' : undefined}
                />
              </div>

              <div className="private-field-shell">
                <label
                  htmlFor="password"
                  className="tag mb-1 block text-steel"
                >
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
                  aria-describedby={actionData?.error ? 'private-error' : undefined}
                />
              </div>

              {actionData?.error ? (
                <p
                  id="private-error"
                  role="alert"
                  className="private-error flex items-start gap-3 border-l border-gold pl-4 text-sm leading-relaxed text-gold"
                >
                  {actionData.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="private-submit display flex w-full items-center justify-center gap-3 border border-gold py-4 text-sm tracking-[0.18em] text-gold"
              >
                {isSubmitting ? (
                  <>
                    <span className="private-dot private-pulse" aria-hidden="true" />
                    Checking
                  </>
                ) : (
                  'Enter'
                )}
              </button>
            </Form>

            <p
              className="mt-12 border-t rule-light pt-5 text-xs leading-relaxed text-steel"
              data-reveal
              style={{'--reveal-delay': '220ms'} as React.CSSProperties}
            >
              Demo credentials for testing only — ask the team if you need them.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
