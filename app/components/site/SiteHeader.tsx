import {Link, NavLink} from 'react-router';
import {Suspense} from 'react';
import {Await} from 'react-router';

const nav = [
  {to: '/archive', label: 'THE ARCHIVE', short: 'ARCHIVE'},
  {to: '/deep-waters', label: 'DEEP WATERS', short: 'DEEP WATERS'},
  {to: '/train', label: 'TRAIN WITH JESSE', short: 'TRAIN'},
  {to: '/future-champions', label: 'FUTURE CHAMPIONS', short: 'FUTURE'},
  {to: '/shop', label: 'SHOP', short: 'SHOP'},
];

interface SiteHeaderProps {
  cart?: Promise<{totalQuantity?: number} | null>;
  isLoggedIn?: Promise<boolean>;
}

export function SiteHeader({cart, isLoggedIn}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b rule bg-stone/90 backdrop-blur-md">
      <nav className="flex items-center justify-between border-b rule px-4 py-2 md:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="tag !text-[0.55rem] whitespace-nowrap text-onyx/70 transition-colors hover:text-onyx"
          >
            {item.short}
          </NavLink>
        ))}
      </nav>

      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10">
        <Link to="/" className="flex items-center gap-3" aria-label="JV Gold — home">
          <img
            src="/brand/jv-gold-logo-gold.png"
            alt="JV Gold"
            width={760}
            height={348}
            className="h-7 w-auto"
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({isActive}) =>
                `tag transition-colors hover:text-onyx ${
                  isActive ? 'text-onyx' : 'text-onyx/70'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Suspense fallback={null}>
            <Await resolve={isLoggedIn} errorElement={null}>
              {(loggedIn) => (
                <Link
                  to={loggedIn ? '/account' : '/private'}
                  className="tag hidden text-onyx/60 transition-colors hover:text-onyx sm:inline"
                >
                  {loggedIn ? 'ACCOUNT' : 'SIGN IN'}
                </Link>
              )}
            </Await>
          </Suspense>

          <Suspense fallback={null}>
            <Await resolve={cart} errorElement={null}>
              {(data) =>
                data?.totalQuantity ? (
                  <Link to="/cart" className="tag text-onyx/60 hover:text-onyx">
                    CART {data.totalQuantity}
                  </Link>
                ) : null
              }
            </Await>
          </Suspense>

          <Link
            to="/train#book"
            className="display border border-onyx px-4 py-2 text-[0.7rem] tracking-[0.14em] transition-colors hover:bg-onyx hover:text-stone"
          >
            Book a Session
          </Link>
        </div>
      </div>
    </header>
  );
}
