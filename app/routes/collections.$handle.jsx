import {redirect, useLoaderData, Link} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import styles from '~/styles/commerce.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `${data?.collection.title ?? 'Collection'} — JV GOLD`}];
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
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {handle, ...paginationVariables},
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
  };
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
  const {collection} = useLoaderData();

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
          <h1 className="display mt-4 text-[clamp(2.4rem,7vw,5.5rem)]">
            {collection.title}
          </h1>
        </div>
        {collection.description ? (
          <p className="max-w-md leading-relaxed text-onyx/70 md:justify-self-end">
            {collection.description}
          </p>
        ) : null}
      </div>

      <PaginatedResourceSection
        connection={collection.products}
        ariaLabel={`${collection.title} products`}
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

      {collection.products?.nodes?.length === 0 ? (
        <p className="max-w-lg text-lg leading-relaxed text-onyx/70">
          Nothing is hanging in this collection right now. The next run is
          already being cut &mdash; check the{' '}
          <Link
            to="/collections/all"
            prefetch="intent"
            className="text-gold-deep underline underline-offset-4"
          >
            full catalogue
          </Link>{' '}
          in the meantime.
        </p>
      ) : null}
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </section>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
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
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
