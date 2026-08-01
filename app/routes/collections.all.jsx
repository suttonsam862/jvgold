import {useLoaderData, Link} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import styles from '~/styles/commerce.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Everything — JV GOLD`}];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, request}) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {...paginationVariables},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
  return {products};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {products} = useLoaderData();

  return (
    <section className="mx-auto max-w-[1440px] px-5 pt-16 pb-28 md:px-10 md:pt-24 md:pb-36">
      <div className="mb-16 grid gap-8 border-b rule pb-10 md:mb-24 md:grid-cols-[1.1fr_0.9fr] md:items-end md:gap-16">
        <div>
          <Link
            to="/collections"
            prefetch="intent"
            className="tag text-steel transition-colors duration-500 hover:text-gold-deep"
          >
            THE SHOP
          </Link>
          <h1 className="display mt-4 text-[clamp(2.6rem,7.5vw,6rem)]">
            Ev<span className="text-gold-deep">e</span>rything
          </h1>
        </div>
        <p className="max-w-md leading-relaxed text-onyx/70 md:justify-self-end">
          The full catalogue, in one place. Cut in small runs and built to be
          worn hard &mdash; when a size is gone, it is gone.
        </p>
      </div>

      <PaginatedResourceSection
        connection={products}
        ariaLabel="All products"
        resourcesClassName="grid grid-cols-2 gap-x-6 gap-y-14 md:gap-x-10 md:gap-y-20 lg:grid-cols-3 lg:gap-x-12"
      >
        {({node: product, index}) => (
          <ProductItem
            key={product.id}
            product={product}
            index={index}
            loading={index < 8 ? 'eager' : undefined}
          />
        )}
      </PaginatedResourceSection>
    </section>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
`;

/** @typedef {import('./+types/collections.all').Route} Route */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
