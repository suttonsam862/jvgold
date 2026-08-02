import {Img} from '~/components/site/Img';
import type {ArchivePlate} from './MilestoneModal';

interface PlateFigureProps {
  plate: ArchivePlate;
  onOpen: (plate: ArchivePlate) => void;
  /** Tailwind aspect utility for the frame, e.g. "aspect-[3/4]". */
  aspect?: string;
  /** Grid placement / offset utilities. */
  className?: string;
  sizes?: string;
  /** Set for the one or two largest plates in a scene. */
  priority?: boolean;
  /** Hide the printed caption when the composition wants pure image. */
  showCaption?: boolean;
  /**
   * Which part of the frame survives the crop. Defaults to the top, which is
   * right for standing figures; group shots and seated portraits need centre.
   */
  focus?: 'top' | 'center' | 'bottom';
  revealDelay?: number;
}

const FOCUS_CLASS = {
  top: 'object-top',
  center: 'object-center',
  bottom: 'object-bottom',
} as const;

/**
 * An archive plate: a framed photograph that opens the lightbox. The whole
 * frame is a real <button> so it is keyboard reachable and announces itself.
 */
export function PlateFigure({
  plate,
  onOpen,
  aspect = 'aspect-[4/3]',
  className = '',
  sizes = '(min-width: 768px) 33vw, 50vw',
  priority = false,
  showCaption = true,
  focus = 'top',
  revealDelay = 0,
}: PlateFigureProps) {
  return (
    <figure
      className={className}
      data-reveal
      style={{'--reveal-delay': `${revealDelay}ms`} as React.CSSProperties}
    >
      <button
        type="button"
        onClick={() => onOpen(plate)}
        className={`ar-plate ${aspect}`}
        aria-label={`Open archive plate — ${plate.caption}`}
      >
        <Img
          id={plate.photoId}
          alt={plate.alt}
          size={priority ? 'hero' : 'web'}
          sizes={sizes}
          fill
          className={`img-mono ${FOCUS_CLASS[focus]}`}
        />
        <span className="ar-plate__veil" aria-hidden="true" />
        <span className="ar-plate__cue tag" aria-hidden="true">
          VIEW
        </span>
      </button>
      {showCaption ? (
        <figcaption className="ar-plate__caption">{plate.caption}</figcaption>
      ) : null}
    </figure>
  );
}

interface MilestoneMarkerProps {
  plate: ArchivePlate;
  onOpen: (plate: ArchivePlate) => void;
  /** Alternating indentation so the markers read as pins along a road. */
  offset?: boolean;
  revealDelay?: number;
}

/**
 * A marker pinned to the road: thumbnail, marker number, result line, and a
 * control that opens the full story in the lightbox.
 */
export function MilestoneMarker({
  plate,
  onOpen,
  offset = false,
  revealDelay = 0,
}: MilestoneMarkerProps) {
  return (
    <li
      className={`ar-marker-row ${offset ? 'ar-marker-row--offset' : ''}`}
      data-reveal
      style={{'--reveal-delay': `${revealDelay}ms`} as React.CSSProperties}
    >
      <button
        type="button"
        className="ar-marker"
        onClick={() => onOpen(plate)}
        aria-label={`${plate.title ?? plate.caption} — open the full story`}
      >
        <span className="ar-marker__pin" aria-hidden="true" />

        <span className="ar-marker__thumb">
          <Img
            id={plate.photoId}
            alt=""
            size="thumb"
            sizes="180px"
            fill
            className="img-mono"
            aria-hidden="true"
          />
        </span>

        <span className="ar-marker__text">
          <span className="tag ar-marker__label">{plate.marker}</span>
          <span className="display ar-marker__title">
            {plate.title ?? plate.caption}
          </span>
          {plate.result ? (
            <span className="ar-marker__result tabular">{plate.result}</span>
          ) : null}
        </span>

        <span className="ar-marker__cue" aria-hidden="true">
          OPEN
        </span>
      </button>
    </li>
  );
}
