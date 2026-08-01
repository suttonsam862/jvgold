/**
 * Future Champions logo art.
 *
 * The delivered PNGs are ink-on-transparent, so on the night register they
 * have to be recoloured. Two techniques, picked per mark:
 *
 *   tone="light"  — CSS invert. Interior whites fall back into the void, which
 *                   is exactly the brand's white-on-void one-color version.
 *                   Safe for the crest, which has opaque white detailing.
 *   tone="green"  — alpha mask filled with Champion Green. Only correct for
 *                   solid silhouette marks (monogram, wordmark, lockup).
 *   tone="art"    — as delivered. Day register / light grounds only.
 */

export type FcMarkName =
  | 'crest-color'
  | 'crest-mono'
  | 'monogram'
  | 'monogram-bloom'
  | 'wordmark'
  | 'wordmark-bloom'
  | 'fcwc-lockup';

/** Intrinsic pixel dimensions, so the layout never shifts on load. */
const ART: Record<FcMarkName, {file: string; w: number; h: number}> = {
  'crest-color': {file: 'fc-crest-color', w: 1095, h: 1184},
  'crest-mono': {file: 'fc-crest-mono', w: 697, h: 777},
  monogram: {file: 'fc-monogram', w: 488, h: 656},
  'monogram-bloom': {file: 'fc-monogram-bloom', w: 432, h: 584},
  wordmark: {file: 'fc-wordmark', w: 648, h: 184},
  'wordmark-bloom': {file: 'fc-wordmark-bloom', w: 736, h: 216},
  'fcwc-lockup': {file: 'fc-fcwc-lockup', w: 848, h: 294},
};

interface FcMarkProps {
  name: FcMarkName;
  /** Empty string marks the art as decorative. */
  alt: string;
  tone?: 'art' | 'light' | 'green';
  /** Adds the single-source green bloom. `tone="light"` only. */
  glow?: boolean;
  className?: string;
  eager?: boolean;
}

export function FcMark({
  name,
  alt,
  tone = 'art',
  glow = false,
  className = '',
  eager = false,
}: FcMarkProps) {
  const art = ART[name];
  const src = `/fc/${art.file}.png`;
  const decorative = alt.length === 0;

  if (tone === 'green') {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
        className={`fc-mask ${className}`}
        style={
          {
            '--fc-mask': `url(${src})`,
            color: 'var(--fc-green)',
            aspectRatio: `${art.w} / ${art.h}`,
          } as React.CSSProperties
        }
      />
    );
  }

  return (
    <img
      src={src}
      width={art.w}
      height={art.h}
      alt={alt}
      aria-hidden={decorative || undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`${tone === 'light' ? (glow ? 'fc-mark-glow' : 'fc-mark-light') : ''} ${className}`}
    />
  );
}
