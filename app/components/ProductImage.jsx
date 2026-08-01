import {Image} from '@shopify/hydrogen';

/**
 * The product hero image. Full-bleed inside its column, warm stone plate
 * behind it so an empty or slow-loading image still reads as intentional.
 * @param {{
 *   image: ProductVariantFragment['image'];
 * }}
 */
export function ProductImage({image}) {
  if (!image) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden bg-stone-warm">
        <span className="tag absolute bottom-6 left-6 text-steel">
          IMAGE COMING
        </span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-stone-warm">
      <Image
        alt={image.altText || 'Product image'}
        data={image}
        key={image.id}
        sizes="(min-width: 1024px) 55vw, 100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

/** @typedef {import('storefrontapi.generated').ProductVariantFragment} ProductVariantFragment */
