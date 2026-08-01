import {useCallback, useEffect, useRef, useState} from 'react';
import {Img} from '~/components/site/Img';

/**
 * A single item in the archive lightbox. Curated milestones carry the extra
 * marker/title/result/story fields; plain archive plates carry only the photo
 * and its caption, so nothing gets invented to fill a template.
 */
export interface ArchivePlate {
  /** Stable id — the photo id doubles as the slug. */
  id: string;
  photoId: string;
  alt: string;
  caption: string;
  /** e.g. "2017–2020 — The Four-Peat" */
  eraLabel: string;
  marker?: string;
  title?: string;
  result?: string;
  story?: string;
}

export interface MilestoneModalProps {
  /** The full, flat ordered set — prev/next walks the whole archive. */
  plates: ArchivePlate[];
  /** Index of the open plate, or null when closed. */
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Accessible milestone lightbox built on the native <dialog> element, which
 * gives us the top layer, ::backdrop, focus containment and Esc-to-close for
 * free. We add: focus restoration to the trigger, body scroll lock, backdrop
 * click, arrow-key gallery navigation and a polite live region so the caption
 * change is announced (arrow navigation never moves focus).
 */
export function MilestoneModal({
  plates,
  index,
  onClose,
  onNavigate,
}: MilestoneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const isOpen = index !== null;

  /* Keep the last opened plate mounted through the close transition, otherwise
     the dialog fades out as an empty box. */
  const [shown, setShown] = useState<{plate: ArchivePlate; index: number} | null>(
    null,
  );

  useEffect(() => {
    if (index === null) return;
    const next = plates[index];
    if (next) setShown({plate: next, index});
  }, [index, plates]);

  const plate = shown?.plate ?? null;
  const shownIndex = shown?.index ?? 0;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* Open / close the real dialog in response to state. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== 'function') return;

    if (isOpen && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  /* Native close (Esc, .close()) — sync state back up and restore focus. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onCloseRef.current();
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger && document.contains(trigger)) trigger.focus();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  /* Lock the page behind the modal without a scrollbar-width jump. */
  useEffect(() => {
    if (!isOpen) return undefined;
    const {body} = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [isOpen]);

  const step = useCallback(
    (delta: number) => {
      if (index === null || plates.length < 2) return;
      onNavigate((index + delta + plates.length) % plates.length);
    },
    [index, plates.length, onNavigate],
  );

  const requestClose = () => dialogRef.current?.close();

  /* jsx-a11y does not classify <dialog> as interactive, but a modal dialog is
     exactly the element that owns backdrop-dismiss and gallery arrow keys.
     Every control inside is a real <button> and Esc is handled natively, so no
     keyboard user depends on the two handlers below. */
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    <dialog
      ref={dialogRef}
      className="ar-dialog"
      aria-labelledby="ar-dialog-heading"
      onClick={(event) => {
        /* Backdrop, and any dead space around the plate, dismisses. */
        const target = event.target as HTMLElement;
        if (target === dialogRef.current || target.dataset.dismiss !== undefined) {
          requestClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      {plate ? (
        <div className="ar-dialog__inner" data-dismiss>
          <header className="ar-dialog__bar">
            <p className="tag text-gold">{plate.marker ?? 'ARCHIVE PLATE'}</p>
            <div className="ar-dialog__nav">
              <span className="ar-dialog__count tabular" aria-hidden="true">
                {pad(shownIndex + 1)} / {pad(plates.length)}
              </span>
              <button
                type="button"
                className="ar-dialog__step"
                onClick={() => step(-1)}
                aria-label="Previous plate"
              >
                <span aria-hidden="true">&larr;</span>
              </button>
              <button
                type="button"
                className="ar-dialog__step"
                onClick={() => step(1)}
                aria-label="Next plate"
              >
                <span aria-hidden="true">&rarr;</span>
              </button>
              <button
                ref={closeRef}
                type="button"
                className="ar-dialog__close"
                onClick={requestClose}
                aria-label="Close"
              >
                <span aria-hidden="true">Close &times;</span>
              </button>
            </div>
          </header>

          <div className="ar-dialog__body" data-dismiss>
            <figure className="ar-dialog__figure">
              <Img
                key={plate.photoId}
                id={plate.photoId}
                alt={plate.alt}
                size="web"
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="ar-dialog__img"
              />
            </figure>

            <div className="ar-dialog__meta" aria-live="polite">
              <p className="tag text-stone/50">{plate.eraLabel}</p>
              <h2
                id="ar-dialog-heading"
                className="display mt-4 text-[clamp(1.6rem,3.4vw,2.6rem)] text-stone"
              >
                {plate.title ?? plate.caption}
              </h2>

              {plate.result ? (
                <p className="ar-dialog__result tabular">{plate.result}</p>
              ) : null}

              {plate.story ? (
                <p className="mt-6 text-sm leading-relaxed text-stone/70">
                  {plate.story}
                </p>
              ) : null}

              <p className="mt-8 border-t rule-light pt-4 text-[0.65rem] uppercase tracking-[0.18em] text-stone/45">
                {plate.caption}
              </p>
            </div>
          </div>

          <p className="ar-dialog__hint">
            Use the arrow keys to move through the archive. Press Escape to
            close.
          </p>
        </div>
      ) : null}
    </dialog>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
}
