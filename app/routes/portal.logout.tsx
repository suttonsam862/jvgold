import {redirect} from 'react-router';
import {clearDemoUser} from '~/lib/demoAuth';
import type {Route} from './+types/portal.logout';

// Action-only route, mirroring account_.logout.jsx and private.logout.tsx: a
// GET (or a stray link prefetch) must never sign the family out, so the loader
// just bounces back to the site and only the POST action clears the session
// key. Clears the 'customer' role only — a staff session is untouched.

export function meta() {
  return [{name: 'robots', content: 'noindex'}];
}

export async function loader() {
  throw redirect('/');
}

export async function action({context}: Route.ActionArgs) {
  clearDemoUser(context, 'customer');
  throw redirect('/');
}
