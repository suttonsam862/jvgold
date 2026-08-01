import {Form, Link, redirect, useActionData, useNavigation} from 'react-router';
import {Img} from '~/components/site/Img';
import {PortalMark} from '~/components/portal/PortalMark';
import {
  DEMO_ROUTES,
  redirectIfSignedIn,
  setDemoUser,
  verifyDemoCredentials,
} from '~/lib/demoAuth';
import styles from '~/styles/portal.css?url';
import type {Route} from './+types/portal._index';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Family Portal — Preview — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

/**
 * CUSTOMER PORTAL PREVIEW — NOT SHOPIFY CUSTOMER AUTH.
 *
 * The real customer account lives at /account on Shopify's Customer Account
 * API, which rejects localhost and mock.shop outright — so it cannot be walked
 * until the store is linked and the app is deployed to Oxygen. This route
 * (plus portal.dashboard.tsx and portal.logout.tsx) is a standalone preview so
 * the parent/athlete experience can be reviewed today. The starter account*
 * routes are untouched and take over on launch; deleting portal*.tsx,
 * app/components/portal/ and app/styles/portal.css removes this entirely.
 *
 * Credentials: app/lib/demoAuth.ts, role 'customer'.
 *   DEMO_CUSTOMER_EMAIL    (default parent@deepwaters.com)
 *   DEMO_CUSTOMER_PASSWORD (default DeepWaters26)
 */

export async function loader({context}: Route.LoaderArgs) {
  redirectIfSignedIn(context, 'customer');
  return null;
}

export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!verifyDemoCredentials(context.env, 'customer', email, password)) {
    // Never log the submitted password.
    return {
      error:
        'That email and password don’t match. Check them and try again — or text the front desk and we’ll sort it out.',
    };
  }

  setDemoUser(context, 'customer', email);
  throw redirect(DEMO_ROUTES.customer.dashboard);
}

export default function PortalLoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="min-h-[100svh] bg-onyx-deep text-stone">
      <div className="grid min-h-[100svh] grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* PLATE — the corner, not the podium. Hidden on phones so the form
            owns the whole viewport where parents actually sign in. */}
        <div className="relative hidden overflow-hidden bg-onyx lg:block">
          <Img
            id="19HSWCIFF9945"
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
            <p className="tag text-gold">Deep Waters Wrestling Club</p>
            <p className="display mt-4 max-w-[16ch] text-[clamp(1.75rem,2.6vw,2.75rem)] text-stone">
              Nobody gets
              <br />
              there alone
            </p>
          </div>
        </div>

        {/* DOOR */}
        <div className="relative flex items-center justify-center overflow-hidden px-5 py-20 sm:px-10 lg:px-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#C8A25B,transparent_65%)]" />
          </div>

          <div className="relative w-full max-w-[26rem]">
            <div data-reveal>
              <PortalMark className="h-14 w-auto text-gold" />
              <p className="tag mt-10 text-gold-deep">Families &amp; Athletes</p>
              <h1 className="display mt-4 text-[clamp(2.25rem,7vw,3.25rem)]">
                The Front Door
              </h1>
              <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-steel">
                Everything for your athlete in one place — the sessions you’ve
                booked, what’s left on your package, camp balances and every
                receipt. Sign in and we’ll keep the paperwork out of your way.
              </p>
            </div>

            <Form
              method="post"
              className="mt-14 space-y-9"
              noValidate
              data-reveal
              style={{'--reveal-delay': '120ms'} as React.CSSProperties}
            >
              <div className="portal-field-shell">
                <label htmlFor="email" className="tag mb-1 block text-steel">
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
                  aria-describedby={
                    actionData?.error ? 'portal-error' : undefined
                  }
                />
              </div>

              <div className="portal-field-shell">
                <label htmlFor="password" className="tag mb-1 block text-steel">
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
                  aria-describedby={
                    actionData?.error ? 'portal-error' : undefined
                  }
                />
              </div>

              {actionData?.error ? (
                <p
                  id="portal-error"
                  role="alert"
                  className="portal-error flex items-start gap-3 border-l border-gold pl-4 text-sm leading-relaxed text-gold"
                >
                  {actionData.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="portal-submit display flex w-full items-center justify-center gap-3 border border-gold py-4 text-sm tracking-[0.18em] text-gold"
              >
                {isSubmitting ? (
                  <>
                    <span className="portal-dot portal-pulse" aria-hidden="true" />
                    Checking
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </Form>

            <div
              className="mt-12 space-y-4 border-t rule-light pt-5 text-xs leading-relaxed text-steel"
              data-reveal
              style={{'--reveal-delay': '220ms'} as React.CSSProperties}
            >
              <p>
                <span className="text-gold">Preview.</span> This is a sample
                family account so the experience can be walked before launch.
                Live customer accounts arrive with the Shopify store
                connection.
              </p>
              <p>
                New to the club?{' '}
                <Link
                  to="/train"
                  className="portal-action text-stone underline decoration-gold/50 underline-offset-4 transition-colors duration-500 hover:text-gold"
                >
                  Start with a session
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
