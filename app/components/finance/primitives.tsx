/**
 * ============================================================================
 * FINANCE — MOTION HOOKS + LAYOUT PRIMITIVES
 * ============================================================================
 *
 * React 18 only. No `use()`, no async components, no `'use client'`. Every
 * browser API is behind `useEffect`, so the server render is a plain, complete,
 * final-value document — the page is fully readable with JavaScript off and
 * fully correct for anyone who has asked for reduced motion.
 */

import {useEffect, useRef, useState, type ReactNode} from 'react';

/* ==========================================================================
 * MOTION GATE
 * ======================================================================== */

export interface MotionState {
  /** False until the browser has been asked about its motion preference. */
  ready: boolean;
  /** True only when motion is measured AND allowed. */
  animate: boolean;
}

/**
 * The single source of truth for "may this page move?".
 *
 * `ready` exists so nothing starts animating before the preference is known.
 * On the server, and on the very first client render, both flags are false —
 * which renders final values and final geometry. That keeps hydration
 * byte-identical and means a reduced-motion visitor never sees a frame of
 * animation start and then get cancelled.
 */
export function useMotion(): MotionState {
  const [state, setState] = useState<MotionState>({
    ready: false,
    animate: false,
  });

  useEffect(() => {
    // Safety valve: `ready` gates the entrance, so if the preference can never
    // be measured the page must still become visible — just without motion.
    if (typeof window.matchMedia !== 'function') {
      setState({ready: true, animate: false});
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setState({ready: true, animate: !query.matches});
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return state;
}

/**
 * True once the page's entrance choreography should begin. Flipped one frame
 * after mount so the CSS transitions actually have a "from" state to leave.
 */
export function useEntered(ready: boolean): boolean {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const outer = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  return entered;
}

/**
 * True while the first-load choreography is still running. Charts use it to
 * apply their staggered entrance delays on arrival and then drop every delay,
 * so a later period switch morphs immediately instead of crawling in again.
 */
export function useIntroWindow(entered: boolean, ms = 2200): boolean {
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    if (!entered) return;
    const timer = window.setTimeout(() => setIntro(false), ms);
    return () => window.clearTimeout(timer);
  }, [entered, ms]);

  return intro;
}

/* ==========================================================================
 * COUNT-UP
 * ======================================================================== */

/**
 * Animate a figure toward `target`.
 *
 * MONEY SAFETY: `target` is integer cents and the returned value is always an
 * integer — every intermediate frame is `Math.round`ed, and the final frame is
 * assigned `target` verbatim rather than being computed. The easing float never
 * touches the money that gets formatted; it only picks which integer to show.
 *
 * When `animate` is false the hook is a pass-through: the exact value, now.
 */
export function useCountUp(target: number, animate: boolean): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const firstRef = useRef(true);

  useEffect(() => {
    if (!animate) {
      fromRef.current = target;
      firstRef.current = false;
      setValue(target);
      return;
    }

    // The very first animated pass counts up from zero; later passes morph
    // from whatever is currently on screen (a period switch).
    const from = firstRef.current ? 0 : fromRef.current;
    firstRef.current = false;

    if (from === target) {
      setValue(target);
      return;
    }

    const duration = 900;
    let raf = 0;
    let startedAt = 0;

    const step = (now: number) => {
      if (!startedAt) startedAt = now;
      const p = Math.min(1, (now - startedAt) / duration);
      // Slow, decelerating, never bouncy.
      const eased = 1 - Math.pow(1 - p, 4);
      if (p >= 1) {
        fromRef.current = target;
        setValue(target);
        return;
      }
      setValue(Math.round(from + (target - from) * eased));
      raf = requestAnimationFrame(step);
    };

    setValue(from);
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, animate]);

  return value;
}

/* ==========================================================================
 * LAYOUT
 * ======================================================================== */

export interface PanelProps {
  label: string;
  meta?: ReactNode;
  /** Entrance delay, e.g. `'240ms'`. Ignored under reduced motion. */
  delay?: string;
  entered: boolean;
  className?: string;
  children: ReactNode;
  /** Renders the panel as a <section> with this accessible name id. */
  headingId?: string;
}

/**
 * Hairline-framed block. Rules over cards — no borders on four sides, no
 * shadows, no fills. The label sits above a single hairline and the content
 * hangs off it.
 */
export function Panel({
  label,
  meta,
  delay,
  entered,
  className = '',
  children,
  headingId,
}: PanelProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={`fin-rise ${entered ? 'is-in' : ''} ${className}`}
      style={delay ? ({'--fin-delay': delay} as React.CSSProperties) : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b rule-light pb-4">
        <h2 id={headingId} className="tag text-gold-deep">
          {label}
        </h2>
        {meta ? (
          <p className="tabular text-[0.6875rem] uppercase tracking-[0.16em] text-steel">
            {meta}
          </p>
        ) : null}
      </div>
      <div className="pt-8">{children}</div>
    </section>
  );
}

/** Screen-reader-only text. Used for chart summaries that are also visible. */
export function VisuallyHidden({children}: {children: ReactNode}) {
  return <span className="fin-sr">{children}</span>;
}

/**
 * The collapsible data table that sits under every chart. Non-negotiable:
 * no figure on this page is available to sighted users only.
 */
export function ChartData({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="fin-data">
      <summary>{summary}</summary>
      <div className="fin-data-scroll">{children}</div>
    </details>
  );
}
