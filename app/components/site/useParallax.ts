import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';

export type ParallaxOptions = {
  /**
   * Total travel in pixels across a full pass through the viewport. Keep it
   * small — 40–90 reads as depth, anything more reads as a gimmick.
   */
  strength?: number;
  /** Flip the direction (element drifts down as you scroll down). */
  invert?: boolean;
  /** Turn the effect off without changing the call site. */
  disabled?: boolean;
};

/**
 * Ambient parallax drift for hero art and layered section imagery.
 *
 * The hook only writes a `--parallax` custom property (a unitless number of
 * pixels) onto the element. The transform itself lives in jvgold.css on
 * `.parallax-layer`, so `prefers-reduced-motion` can neutralise it in CSS and
 * the JS becomes inert on its own as well.
 *
 *   const ref = useParallax<HTMLDivElement>({strength: 70});
 *   <div ref={ref} className="parallax-layer absolute inset-0">
 *     <Img id="…" alt="" fill className="img-mono" />
 *   </div>
 *
 * Everything touching the DOM is inside useEffect, so SSR is safe.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  options: ParallaxOptions = {},
): RefObject<T | null> {
  const {strength = 60, invert = false, disabled = false} = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = false;
    let running = false;

    const clear = () => {
      el.style.removeProperty('--parallax');
    };

    const measure = () => {
      running = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 0;
      if (!vh) return;
      // -1 when the element sits just below the fold, +1 just above it.
      const centre = rect.top + rect.height / 2;
      const progress = (centre - vh / 2) / (vh / 2 + rect.height / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      const offset = clamped * (strength / 2) * (invert ? -1 : 1);
      el.style.setProperty('--parallax', offset.toFixed(2));
    };

    const schedule = () => {
      if (running || !visible) return;
      running = true;
      frame = window.requestAnimationFrame(measure);
    };

    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
              if (visible) schedule();
            },
            {rootMargin: '15% 0px'},
          );

    const start = () => {
      if (media.matches) {
        clear();
        return;
      }
      visible = true;
      io?.observe(el);
      window.addEventListener('scroll', schedule, {passive: true});
      window.addEventListener('resize', schedule, {passive: true});
      schedule();
    };

    const stop = () => {
      io?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      running = false;
      visible = false;
    };

    const onPreferenceChange = () => {
      stop();
      clear();
      start();
    };

    start();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onPreferenceChange);
    }

    return () => {
      stop();
      clear();
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onPreferenceChange);
      }
    };
  }, [strength, invert, disabled]);

  return ref;
}
