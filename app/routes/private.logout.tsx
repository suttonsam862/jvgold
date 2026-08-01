import {redirect} from 'react-router';
import {clearDemoUser} from '~/lib/demoAuth';
import type {Route} from './+types/private.logout';

// Action-only route, mirroring account_.logout.jsx: a GET (or a stray
// prefetch) must never log the demo user out, so the loader just bounces
// back to the site and only the POST action clears the session flag.

export function meta() {
  return [{name: 'robots', content: 'noindex'}];
}

export async function loader() {
  throw redirect('/');
}

export async function action({context}: Route.ActionArgs) {
  clearDemoUser(context, 'coach');
  throw redirect('/');
}
