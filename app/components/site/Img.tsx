/**
 * Static-art image. Hydrogen's <Image> is for Storefront CDN media only, and
 * there is no next/image here — so we point at the three pre-generated sizes
 * in /public/img and let the browser pick.
 */
export type ImgSize = 'hero' | 'web' | 'thumb';

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  id: string;
  alt: string;
  /** Largest size this image is ever displayed at. */
  size?: ImgSize;
  sizes?: string;
  fill?: boolean;
}

export function Img({
  id,
  alt,
  size = 'web',
  sizes = '100vw',
  fill = false,
  className = '',
  ...rest
}: ImgProps) {
  const srcSet = [
    `/img/thumb/${id}.jpg 640w`,
    `/img/web/${id}.jpg 1400w`,
    ...(size === 'hero' ? [`/img/hero/${id}.jpg 2560w`] : []),
  ].join(', ');

  return (
    <img
      src={`/img/${size}/${id}.jpg`}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={size === 'hero' ? 'eager' : 'lazy'}
      decoding="async"
      className={`${fill ? 'absolute inset-0 h-full w-full object-cover' : ''} ${className}`}
      {...rest}
    />
  );
}
