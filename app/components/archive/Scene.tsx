import {useEffect, useRef, type ReactNode, type RefObject} from 'react';

/**
 * Layout primitives for a roadmap scene.
 *
 * A scene is a three-layer composition: a pinned <Stage> (background photo +
 * scrim), oversized <Ghost> type floating in the midground, and a <Flow> of
 * foreground content that scrolls up over the top of both. The Flow is pulled
 * back by exactly one stage height so the first screen of a chapter is the
 * title card sitting on the photograph.
 *
 * Depth comes from three things moving at three speeds. Chromium gets that for
 * free from scroll-driven `animation-timeline: view()`. Everywhere else we
 * publish the same 0→1 progress value as `--ar-p` on the scene element from a
 * single shared, passive, rAF-throttled scroll pass, and the stylesheet reads
 * it back through `@supports not (animation-timeline: view())`. Either way the
 * only animated properties are transform and opacity.
 */

/* ------------------------------------------------ shared progress publisher */

const scopes = new Set<HTMLElement>();
let frame = 0;
let listening = false;

function measure() {
  frame = 0;
  const vh = window.innerHeight || 1;
  scopes.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const span = rect.height + vh;
    const raw = span <= 0 ? 0 : (vh - rect.top) / span;
    const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    el.style.setProperty('--ar-p', p.toFixed(4));
  });
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
}

function unlisten() {
  if (!listening || scopes.size > 0) return;
  listening = false;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

/**
 * Publishes scroll progress for a scene as `--ar-p`. No-ops entirely when the
 * browser drives the same motion natively, or when the visitor asked for less
 * motion — in both cases the stylesheet already resolves to a resting state.
 */
export function useSceneProgress(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()')) {
      return undefined;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    scopes.add(el);
    listen();
    schedule();

    return () => {
      scopes.delete(el);
      el.style.removeProperty('--ar-p');
      unlisten();
    };
  }, [ref]);
}

/* --------------------------------------------------------------- primitives */

interface SceneProps {
  id: string;
  /** 1-based — pairs the scene with its named view-timeline in archive.css. */
  index: number;
  className?: string;
  children: ReactNode;
}

export function Scene({id, index, className = '', children}: SceneProps) {
  const ref = useRef<HTMLElement>(null);
  useSceneProgress(ref);

  return (
    <section
      ref={ref}
      id={id}
      data-scene={index}
      aria-labelledby={`${id}-title`}
      className={`ar-scene ${className}`}
    >
      {children}
    </section>
  );
}

export function Stage({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ar-stage ${className}`}>
      {children}
      <span className="ar-stage__lift" aria-hidden="true" />
    </div>
  );
}

export function Flow({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`ar-flow ${className}`}>{children}</div>;
}

/**
 * Decorative oversized type. Always aria-hidden — the same words exist as real
 * text in the chapter heading, so screen readers should not hear them twice.
 */
export function Ghost({
  className = '',
  drift = true,
  children,
}: {
  className?: string;
  drift?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ar-ghost display ${drift ? 'ar-ghost-drift' : ''} ${className}`}
    >
      {children}
    </span>
  );
}

interface TitleScreenProps {
  id: string;
  chapter: string;
  years: string;
  title: ReactNode;
  standfirst?: string;
  /** Horizontal placement of the title block on its screen. */
  align?: 'left' | 'right' | 'center';
  tone?: 'dark' | 'light';
}

export function TitleScreen({
  id,
  chapter,
  years,
  title,
  standfirst,
  align = 'left',
  tone = 'dark',
}: TitleScreenProps) {
  return (
    <div className="ar-title-screen" data-align={align} data-tone={tone}>
      <div className="ar-container ar-title-screen__inner">
        <p className="ar-title-screen__chapter tag" data-reveal>
          CHAPTER {chapter}
        </p>

        <h2
          id={`${id}-title`}
          data-reveal
          style={{'--reveal-delay': '90ms'} as React.CSSProperties}
          className="ar-title-screen__title display"
        >
          {title}
        </h2>

        <p
          data-reveal
          style={{'--reveal-delay': '180ms'} as React.CSSProperties}
          className="ar-title-screen__years tabular"
        >
          {years}
        </p>

        {standfirst ? (
          <p
            data-reveal
            style={{'--reveal-delay': '260ms'} as React.CSSProperties}
            className="ar-title-screen__standfirst"
          >
            {standfirst}
          </p>
        ) : null}
      </div>
    </div>
  );
}
