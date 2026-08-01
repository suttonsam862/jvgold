import {isRouteErrorResponse, useRouteError} from 'react-router';
import {ErrorPage} from '~/components/site/ErrorPage';
import styles from '~/styles/error.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Page not found — Jesse Vasquez | JV GOLD'},
    {
      name: 'description',
      content:
        'That page is off the mat. Head back to the archive, the training work, or the homepage.',
    },
    {name: 'robots', content: 'noindex, follow'},
  ];
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request}) {
  throw new Response(`${new URL(request.url).pathname} not found`, {
    status: 404,
    statusText: 'Not Found',
  });
}

export default function CatchAllPage() {
  return <ErrorPage />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 404;

  if (status === 404) {
    return <ErrorPage status={404} />;
  }

  return (
    <ErrorPage
      status={status}
      title="Something gave way"
      body="An unexpected error stopped this page from loading. Try again, or take one of the routes below."
    />
  );
}

/** @typedef {import('./+types/$').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
