import {Await} from 'react-router';
import {Suspense} from 'react';
import {Aside} from '~/components/Aside';
import {CartMain} from '~/components/CartMain';
import {SiteHeader} from './SiteHeader';
import {SiteFooter} from './SiteFooter';
import {RevealObserver} from './Reveal';

/**
 * The JV Gold shell. Replaces the Hydrogen starter's PageLayout so the brand
 * nav is used everywhere, while keeping Aside.Provider mounted so the stock
 * commerce routes (cart, products) still open their drawers.
 */
export function SiteLayout({
  cart,
  isLoggedIn,
  children = null,
}: {
  cart?: Promise<any>;
  isLoggedIn?: Promise<boolean>;
  children?: React.ReactNode;
}) {
  return (
    <Aside.Provider>
      <Aside type="cart" heading="CART">
        <Suspense fallback={<p>Loading cart…</p>}>
          <Await resolve={cart} errorElement={null}>
            {(resolved) => <CartMain cart={resolved} layout="aside" />}
          </Await>
        </Suspense>
      </Aside>

      <SiteHeader cart={cart} isLoggedIn={isLoggedIn} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <RevealObserver />
    </Aside.Provider>
  );
}
