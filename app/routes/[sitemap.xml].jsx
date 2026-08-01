/**
 * The site's real content lives in hand-built routes, not in Shopify
 * collections, so the sitemap is authored here rather than generated from the
 * Storefront API. Private and account routes are deliberately excluded.
 */
const CONTENT_ROUTES = [
  {path: '/', changefreq: 'monthly', priority: '1.0'},
  {path: '/archive', changefreq: 'monthly', priority: '0.9'},
  {path: '/deep-waters', changefreq: 'monthly', priority: '0.8'},
  {path: '/train', changefreq: 'monthly', priority: '0.9'},
  {path: '/future-champions', changefreq: 'monthly', priority: '0.8'},
];

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request}) {
  const origin = new URL(request.url).origin;
  const lastmod = new Date().toISOString().split('T')[0];

  const urls = CONTENT_ROUTES.map(
    ({path, changefreq, priority}) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/** @typedef {import('./+types/[sitemap.xml]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
