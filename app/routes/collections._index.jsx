import {useLoaderData, Link} from 'react-router';
import {getPaginationVariables, Image} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import styles from '~/styles/commerce.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `The Shop — JV GOLD`}];
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
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 4,
  });

  const [{collections}] = await Promise.all([
    context.storefront.query(COLLECTIONS_QUERY, {
      variables: paginationVariables,
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {collections};
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

export default function Collections() {
  /** @type {LoaderReturnData} */
  const {collections} = useLoaderData();

  return (
    <section className="mx-auto max-w-[1440px] px-5 pt-16 pb-28 md:px-10 md:pt-24 md:pb-36">
      <div className="mb-16 grid gap-8 border-b rule pb-10 md:mb-24 md:grid-cols-[1.1fr_0.9fr] md:items-end md:gap-16">
        <div>
          <p className="tag text-gold-deep">THE SHOP</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,7.5vw,6rem)]">
            Coll<span className="text-gold-deep">e</span>ctions
          </h1>
        </div>
        <p className="max-w-md leading-relaxed text-onyx/70 md:justify-self-end">
          Small runs, made for the room and the road. Every piece is chosen the
          same way a lineup is — nothing here that would not earn its place.
        </p>
      </div>

      <PaginatedResourceSection
        connection={collections}
        ariaLabel="Collections"
        resourcesClassName="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-24"
      >
        {({node: collection, index}) => (
          <CollectionItem
            key={collection.id}
            collection={collection}
            index={index}
          />
        )}
      </PaginatedResourceSection>
    </section>
  );
}

/**
 * @param {{
 *   collection: CollectionFragment;
 *   index: number;
 * }}
 */
function CollectionItem({collection, index}) {
  return (
    <Link
      className="group block focus:outline-none"
      key={collection.id}
      to={`/collections/${collection.handle}`}
      prefetch="intent"
      data-reveal
      style={{'--reveal-delay': `${Math.min(index, 6) * 90}ms`}}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stone-warm group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-gold">
        {collection?.image ? (
          <Image
            alt={collection.image.altText || collection.title}
            data={collection.image}
            loading={index < 3 ? 'eager' : undefined}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.98] contrast-[1.08] grayscale transition-[transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:grayscale-0"
          />
        ) : null}
        <span className="tag absolute bottom-5 left-5 bg-onyx-deep/80 px-3 py-2 text-stone">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-6 border-t rule pt-4">
        <h2 className="display text-[1.05rem] leading-tight transition-colors duration-500 group-hover:text-gold-deep md:text-[1.25rem]">
          {collection.title}
        </h2>
        <span className="shrink-0 text-[0.7rem] uppercase tracking-[0.18em] text-steel transition-colors duration-500 group-hover:text-gold-deep">
          View
        </span>
      </div>
    </Link>
  );
}

const COLLECTIONS_QUERY = `#graphql
  fragment Collection on Collection {
    id
    title
    handle
    image {
      id
      url
      altText
      width
      height
    }
  }
  query StoreCollections(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    collections(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...Collection
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

/** @typedef {import('./+types/collections._index').Route} Route */
/** @typedef {import('storefrontapi.generated').CollectionFragment} CollectionFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
