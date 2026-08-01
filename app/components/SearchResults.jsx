import {Link} from 'react-router';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams} from '~/lib/search';

const SECTION = 'mt-16 first:mt-0 md:mt-24';
const SECTION_HEADING = 'tag text-gold-deep';

const PAGE_NAV =
  'flex justify-center empty:hidden ' +
  '[&_a]:inline-flex [&_a]:items-center [&_a]:border [&_a]:border-onyx/20 ' +
  '[&_a]:px-8 [&_a]:py-4 [&_a]:font-display [&_a]:text-[0.7rem] [&_a]:font-bold ' +
  '[&_a]:uppercase [&_a]:tracking-[0.18em] [&_a]:text-onyx [&_a]:no-underline ' +
  '[&_a]:transition-colors [&_a]:duration-500 ' +
  '[&_a:hover]:border-onyx [&_a:hover]:bg-onyx [&_a:hover]:text-stone';

const TEXT_ROW =
  'group flex items-baseline justify-between gap-6 border-b rule py-5 ' +
  'transition-colors duration-500 hover:text-gold-deep ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

/**
 * @param {Omit<SearchResultsProps, 'error' | 'type'>}
 */
export function SearchResults({term, result, children}) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

/**
 * @param {PartialSearchResult<'articles'>}
 */
function SearchResultsArticles({term, articles}) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section className={SECTION} aria-label="Article results">
      <h2 className={SECTION_HEADING}>JOURNAL</h2>
      <div className="mt-6 border-t rule">
        {articles?.nodes?.map((article, i) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <Link
              key={article.id}
              prefetch="intent"
              to={articleUrl}
              className={TEXT_ROW}
              data-reveal
              style={{'--reveal-delay': `${Math.min(i, 6) * 60}ms`}}
            >
              <span className="display text-[0.95rem] leading-tight">
                {article.title}
              </span>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.18em] text-steel">
                Read
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * @param {PartialSearchResult<'pages'>}
 */
function SearchResultsPages({term, pages}) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <section className={SECTION} aria-label="Page results">
      <h2 className={SECTION_HEADING}>PAGES</h2>
      <div className="mt-6 border-t rule">
        {pages?.nodes?.map((page, i) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <Link
              key={page.id}
              prefetch="intent"
              to={pageUrl}
              className={TEXT_ROW}
              data-reveal
              style={{'--reveal-delay': `${Math.min(i, 6) * 60}ms`}}
            >
              <span className="display text-[0.95rem] leading-tight">
                {page.title}
              </span>
              <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.18em] text-steel">
                Open
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * @param {PartialSearchResult<'products'>}
 */
function SearchResultsProducts({term, products}) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <section className={SECTION} aria-label="Product results">
      <h2 className={SECTION_HEADING}>THE SHOP</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product, i) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });

            const price = product?.selectedOrFirstAvailableVariant?.price;
            const image = product?.selectedOrFirstAvailableVariant?.image;

            return (
              <Link
                key={product.id}
                prefetch="intent"
                to={productUrl}
                className="group block focus:outline-none"
                data-reveal
                style={{'--reveal-delay': `${Math.min(i, 7) * 70}ms`}}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-stone-warm group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-gold">
                  {image ? (
                    <Image
                      data={image}
                      alt={image.altText || product.title}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                      className="absolute inset-0 h-full w-full object-cover brightness-[0.98] contrast-[1.08] grayscale transition-[transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:grayscale-0"
                    />
                  ) : null}
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-6 border-t rule pt-4">
                  <h3 className="display text-[0.95rem] leading-tight transition-colors duration-500 group-hover:text-gold-deep">
                    {product.title}
                  </h3>
                  {price ? (
                    <Money
                      as="span"
                      data={price}
                      className="tabular shrink-0 text-sm text-gold-deep"
                    />
                  ) : null}
                </div>
              </Link>
            );
          });

          return (
            <div className="mt-8">
              <div className={`${PAGE_NAV} pb-12`}>
                <PreviousLink>
                  {isLoading ? (
                    'Loading'
                  ) : (
                    <span>
                      <span aria-hidden="true">&#8593;</span>&nbsp;&nbsp;Earlier
                    </span>
                  )}
                </PreviousLink>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:gap-x-10 md:gap-y-20 lg:grid-cols-3 lg:gap-x-12">
                {ItemsMarkup}
              </div>
              <div className={`${PAGE_NAV} pt-16`}>
                <NextLink>
                  {isLoading ? (
                    'Loading'
                  ) : (
                    <span>
                      See more&nbsp;&nbsp;
                      <span aria-hidden="true">&#8595;</span>
                    </span>
                  )}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
    </section>
  );
}

function SearchResultsEmpty() {
  return (
    <div className="max-w-xl">
      <p className="display text-[clamp(1.6rem,3.4vw,2.6rem)]">
        Nothing came back.
      </p>
      <p className="mt-5 leading-relaxed text-onyx/70">
        Try a shorter word, or a different one. If you are looking for something
        in particular from the shop, the{' '}
        <Link
          to="/collections/all"
          prefetch="intent"
          className="text-gold-deep underline underline-offset-4"
        >
          full catalogue
        </Link>{' '}
        is a good place to start.
      </p>
    </div>
  );
}

/** @typedef {RegularSearchReturn['result']['items']} SearchItems */
/**
 * @typedef {Pick<
 *   SearchItems,
 *   ItemType
 * > &
 *   Pick<RegularSearchReturn, 'term'>} PartialSearchResult
 * @template {keyof SearchItems} ItemType
 */
/**
 * @typedef {RegularSearchReturn & {
 *   children: (args: SearchItems & {term: string}) => React.ReactNode;
 * }} SearchResultsProps
 */

/** @typedef {import('~/lib/search').RegularSearchReturn} RegularSearchReturn */
