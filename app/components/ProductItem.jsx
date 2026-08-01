import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';

/**
 * A single tile in the lookbook grid: tall monochrome image that warms and
 * drifts a hair on hover, then a hairline rule with the name and the price.
 * @param {{
 *   product:
 *     | CollectionItemFragment
 *     | ProductItemFragment
 *     | RecommendedProductFragment;
 *   loading?: 'eager' | 'lazy';
 *   index?: number;
 * }}
 */
export function ProductItem({product, loading, index = 0}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;

  return (
    <Link
      className="group block focus:outline-none"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
      data-reveal
      style={{'--reveal-delay': `${Math.min(index, 7) * 80}ms`}}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-warm group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-gold">
        {image ? (
          <Image
            alt={image.altText || product.title}
            data={image}
            loading={loading}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.98] contrast-[1.08] grayscale transition-[transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.02] group-hover:grayscale-0"
          />
        ) : (
          <span className="tag absolute bottom-5 left-5 text-steel">
            NO IMAGE
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-6 border-t rule pt-4">
        <h3 className="display text-[0.95rem] leading-tight transition-colors duration-500 group-hover:text-gold-deep md:text-[1.05rem]">
          {product.title}
        </h3>
        <Money
          as="span"
          data={product.priceRange.minVariantPrice}
          className="tabular shrink-0 text-sm text-gold-deep"
        />
      </div>
    </Link>
  );
}

/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {import('storefrontapi.generated').RecommendedProductFragment} RecommendedProductFragment */
