import {Link, useFetcher} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import React, {useRef, useEffect} from 'react';
import {
  getEmptyPredictiveSearchResult,
  urlWithTrackingParams,
} from '~/lib/search';
import {useAside} from './Aside';

/**
 * Component that renders predictive search results
 * @param {SearchResultsPredictiveProps}
 * @return {React.ReactNode}
 */
export function SearchResultsPredictive({children}) {
  const aside = useAside();
  const {term, inputRef, fetcher, total, items} = usePredictiveSearch();

  /*
   * Utility that resets the search input
   */
  function resetInput() {
    if (inputRef.current) {
      inputRef.current.blur();
      inputRef.current.value = '';
    }
  }

  /**
   * Utility that resets the search input and closes the search aside
   */
  function closeSearch() {
    resetInput();
    aside.close();
  }

  return (
    <div className={PREDICTIVE_RESULTS_CLASS} aria-live="polite">
      {children({
        items,
        closeSearch,
        inputRef,
        state: fetcher.state,
        term,
        total,
      })}
    </div>
  );
}

/**
 * Wrapper for everything the caller renders below the search field.
 * The caller (PageLayout's SearchAside) also renders a plain "Loading…" div
 * and the trailing "view all results" link, so both are dressed from here.
 */
const PREDICTIVE_RESULTS_CLASS = [
  'mt-1 pb-2 font-sans text-sm text-steel',
  // trailing "view all results" link, the only direct <a> child
  '[&>a]:mt-8 [&>a]:block [&>a]:border-t [&>a]:border-[color-mix(in_srgb,var(--onyx)_15%,transparent)]',
  // reset.css underlines links on hover from outside any cascade layer, so the
  // override has to be important to win against it.
  '[&>a]:pt-5 [&>a]:no-underline! [&>a:hover]:no-underline!',
  // reset.css styles bare <p> and <h5> outside every cascade layer, so type
  // overrides on those elements have to be important to land.
  '[&>a>p]:font-display [&>a>p]:text-[0.6875rem]! [&>a>p]:uppercase [&>a>p]:tracking-[0.22em]',
  '[&>a>p]:text-gold [&>a>p]:transition-opacity [&>a>p]:duration-300',
  '[&>a:hover>p]:opacity-70',
  '[&>a>p_q]:not-italic [&>a>p_q]:text-onyx',
  '[&>a:focus-visible]:outline-2 [&>a:focus-visible]:outline-offset-4 [&>a:focus-visible]:outline-gold',
].join(' ');

/** Shared row link: hairline separated, gold focus ring, slow eased hover. */
const RESULT_LINK_CLASS =
  'group flex items-center gap-4 py-3.5 no-underline! hover:no-underline! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

const RESULT_TITLE_CLASS =
  'min-w-0 flex-1 text-[0.9375rem] leading-snug text-onyx transition-colors duration-300 group-hover:text-gold-deep';

const RESULT_ROW_CLASS = 'border-b rule last:border-b-0';

/**
 * A titled group of results — .tag label over a hairline-ruled list.
 * @param {{label: string; children: React.ReactNode}}
 */
function ResultGroup({label, children}) {
  return (
    <section className="mt-8" aria-label={label}>
      <h5 className="tag mt-0! mb-2! text-steel">{label}</h5>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

/**
 * Small monochrome thumbnail. Renders an empty stone tile when the resource
 * has no image so every row in a group keeps the same rhythm.
 * @param {{image?: {url: string; altText?: string | null} | null}}
 */
function ResultThumb({image}) {
  return (
    <span className="block h-14 w-14 shrink-0 overflow-hidden bg-stone-warm">
      {image?.url ? (
        <Image
          alt={image.altText ?? ''}
          src={image.url}
          aspectRatio="1/1"
          width={112}
          height={112}
          loading="lazy"
          className="img-mono img-mono-hover h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

SearchResultsPredictive.Articles = SearchResultsPredictiveArticles;
SearchResultsPredictive.Collections = SearchResultsPredictiveCollections;
SearchResultsPredictive.Pages = SearchResultsPredictivePages;
SearchResultsPredictive.Products = SearchResultsPredictiveProducts;
SearchResultsPredictive.Queries = SearchResultsPredictiveQueries;
SearchResultsPredictive.Empty = SearchResultsPredictiveEmpty;

/**
 * @param {PartialPredictiveSearchResult<'articles'>}
 */
function SearchResultsPredictiveArticles({term, articles, closeSearch}) {
  if (!articles.length) return null;

  return (
    <ResultGroup label="Articles" key="articles">
      {articles.map((article) => {
        const articleUrl = urlWithTrackingParams({
          baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
          trackingParams: article.trackingParameters,
          term: term.current ?? '',
        });

        return (
          <li className={RESULT_ROW_CLASS} key={article.id}>
            <Link
              onClick={closeSearch}
              to={articleUrl}
              className={RESULT_LINK_CLASS}
            >
              <ResultThumb image={article.image} />
              <span className={RESULT_TITLE_CLASS}>{article.title}</span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'collections'>}
 */
function SearchResultsPredictiveCollections({term, collections, closeSearch}) {
  if (!collections.length) return null;

  return (
    <ResultGroup label="Collections" key="collections">
      {collections.map((collection) => {
        const collectionUrl = urlWithTrackingParams({
          baseUrl: `/collections/${collection.handle}`,
          trackingParams: collection.trackingParameters,
          term: term.current,
        });

        return (
          <li className={RESULT_ROW_CLASS} key={collection.id}>
            <Link
              onClick={closeSearch}
              to={collectionUrl}
              className={RESULT_LINK_CLASS}
            >
              <ResultThumb image={collection.image} />
              <span className={RESULT_TITLE_CLASS}>{collection.title}</span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'pages'>}
 */
function SearchResultsPredictivePages({term, pages, closeSearch}) {
  if (!pages.length) return null;

  return (
    <ResultGroup label="Pages" key="pages">
      {pages.map((page) => {
        const pageUrl = urlWithTrackingParams({
          baseUrl: `/pages/${page.handle}`,
          trackingParams: page.trackingParameters,
          term: term.current,
        });

        return (
          <li className={RESULT_ROW_CLASS} key={page.id}>
            <Link
              onClick={closeSearch}
              to={pageUrl}
              className={RESULT_LINK_CLASS}
            >
              <span className={RESULT_TITLE_CLASS}>{page.title}</span>
              <span
                aria-hidden="true"
                className="shrink-0 text-gold opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                &rarr;
              </span>
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'products'>}
 */
function SearchResultsPredictiveProducts({term, products, closeSearch}) {
  if (!products.length) return null;

  return (
    <ResultGroup label="Products" key="products">
      {products.map((product) => {
        const productUrl = urlWithTrackingParams({
          baseUrl: `/products/${product.handle}`,
          trackingParams: product.trackingParameters,
          term: term.current,
        });

        const price = product?.selectedOrFirstAvailableVariant?.price;
        const image = product?.selectedOrFirstAvailableVariant?.image;
        return (
          <li className={RESULT_ROW_CLASS} key={product.id}>
            <Link
              to={productUrl}
              onClick={closeSearch}
              className={RESULT_LINK_CLASS}
            >
              <ResultThumb image={image} />
              <span className={RESULT_TITLE_CLASS}>{product.title}</span>
              {price ? (
                <span className="tabular shrink-0 text-[0.8125rem] text-gold">
                  <Money data={price} />
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ResultGroup>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'queries', never> & {
 *   queriesDatalistId: string;
 * }}
 */
function SearchResultsPredictiveQueries({queries, queriesDatalistId}) {
  if (!queries.length) return null;

  return (
    <datalist id={queriesDatalistId}>
      {queries.map((suggestion) => {
        if (!suggestion) return null;

        return <option key={suggestion.text} value={suggestion.text} />;
      })}
    </datalist>
  );
}

/**
 * @param {{
 *   term: React.MutableRefObject<string>;
 * }}
 */
function SearchResultsPredictiveEmpty({term}) {
  if (!term.current) {
    return null;
  }

  return (
    <p className="mt-10 max-w-[34ch] font-sans text-[0.9375rem]! leading-relaxed! text-steel">
      Nothing here matches{' '}
      <span className="text-onyx">&ldquo;{term.current}&rdquo;</span>. Try a
      shorter word, or browse the full collection.
    </p>
  );
}

/**
 * Hook that returns the predictive search results and fetcher and input ref.
 * @example
 * '''ts
 * const { items, total, inputRef, term, fetcher } = usePredictiveSearch();
 * '''
 * @return {UsePredictiveSearchReturn}
 */
function usePredictiveSearch() {
  const fetcher = useFetcher({key: 'search'});
  const term = useRef('');
  const inputRef = useRef(null);

  if (fetcher?.state === 'loading') {
    term.current = String(fetcher.formData?.get('q') || '');
  }

  // capture the search input element as a ref
  useEffect(() => {
    if (!inputRef.current) {
      inputRef.current = document.querySelector('input[type="search"]');
    }
  }, []);

  const {items, total} =
    fetcher?.data?.result ?? getEmptyPredictiveSearchResult();

  return {items, total, inputRef, term, fetcher};
}

/** @typedef {PredictiveSearchReturn['result']['items']} PredictiveSearchItems */
/**
 * @typedef {{
 *   term: React.MutableRefObject<string>;
 *   total: number;
 *   inputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   items: PredictiveSearchItems;
 *   fetcher: Fetcher<PredictiveSearchReturn>;
 * }} UsePredictiveSearchReturn
 */
/**
 * @typedef {Pick<
 *   UsePredictiveSearchReturn,
 *   'term' | 'total' | 'inputRef' | 'items'
 * > & {
 *   state: Fetcher['state'];
 *   closeSearch: () => void;
 * }} SearchResultsPredictiveArgs
 */
/**
 * @typedef {Pick<PredictiveSearchItems, ItemType> &
 *   Pick<SearchResultsPredictiveArgs, ExtraProps>} PartialPredictiveSearchResult
 * @template {keyof PredictiveSearchItems} ItemType
 * @template {keyof SearchResultsPredictiveArgs} [ExtraProps='term' | 'closeSearch']
 */
/**
 * @typedef {{
 *   children: (args: SearchResultsPredictiveArgs) => React.ReactNode;
 * }} SearchResultsPredictiveProps
 */

/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
