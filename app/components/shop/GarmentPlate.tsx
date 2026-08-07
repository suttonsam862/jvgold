/**
 * The garment on its plate.
 *
 * The mockup is a 600×750 file and it is NOT in app/lib/photos.ts, so this is
 * a plain <img> with explicit intrinsic dimensions. It is never blown up past
 * its native width — `.sh-garment` caps it at 480px and the plate does the
 * rest of the work, which is why the tee reads as an object on paper rather
 * than a soft, upscaled JPEG stretched across a full-bleed band.
 */

const SRC = '/shop/wrestle-and-rave-tee.webp';
const NATURAL_WIDTH = 600;
const NATURAL_HEIGHT = 750;

interface GarmentPlateProps {
  alt: string;
  /** Renders the plate in the onyx register instead of warm paper. */
  dark?: boolean;
  /** `eager` for the product page hero, `lazy` everywhere else. */
  loading?: 'eager' | 'lazy';
  className?: string;
  /** Extra padding class for the plate itself. */
  padding?: string;
}

export function GarmentPlate({
  alt,
  dark = false,
  loading = 'lazy',
  className = '',
  padding = 'px-6 py-10 md:px-12 md:py-16',
}: GarmentPlateProps) {
  return (
    <div
      className={`sh-plate ${dark ? 'sh-plate-dark' : ''} ${padding} ${className}`.trim()}
    >
      <img
        src={SRC}
        alt={alt}
        width={NATURAL_WIDTH}
        height={NATURAL_HEIGHT}
        loading={loading}
        decoding="async"
        className="sh-garment"
      />
    </div>
  );
}
