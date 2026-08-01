import {useCallback, useEffect, useRef, useState} from 'react';

export interface RailStop {
  /** id of the <section> this stop jumps to. */
  id: string;
  /** "01", "02", … */
  index: string;
  label: string;
  years: string;
}

interface ProgressRailProps {
  stops: RailStop[];
  /** id of the element whose scroll span drives the fill. */
  roadId: string;
}

/**
 * The persistent chapter rail: a vertical spine on desktop, a horizontal chip
 * strip on mobile.
 *
 * Accuracy: progress and active chapter are derived in the *same* rAF pass from
 * the same reading line — the point one third down the viewport — so the gold
 * fill and the highlighted stop can never disagree. Section boundaries are
 * measured, not inferred from IntersectionObserver ratios, which is what makes
 * the fill land exactly on a stop as that chapter takes the screen.
 *
 * Access: stops are real anchors, so they are keyboard reachable, deep-linkable
 * and work with JS off. The active one carries aria-current="step". Arrow keys,
 * Home and End rove focus along the rail the way a menubar does.
 */
export function ProgressRail({stops, roadId}: ProgressRailProps) {
  const [activeId, setActiveId] = useState(stops[0]?.id ?? '');
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef(activeId);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  /* One passive, rAF-throttled pass drives everything the rail knows. */
  useEffect(() => {
    const road = document.getElementById(roadId);
    const nav = navRef.current;
    if (!road || !nav) return undefined;

    const sections = stops
      .map((stop) => document.getElementById(stop.id))
      .filter((el): el is HTMLElement => Boolean(el));

    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const rect = road.getBoundingClientRect();

      /* The reading line: a third of the way down the viewport. Progress is
         how far that line has travelled through the road. */
      const line = vh / 3;
      const span = rect.height - (vh - line);
      const raw = span <= 0 ? 1 : (line - rect.top) / span;
      const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      nav.style.setProperty('--ar-progress', progress.toFixed(4));

      /* Hide the desktop spine while the hero still owns the screen. */
      nav.dataset.engaged = rect.top < vh * 0.55 ? 'true' : 'false';

      /* The last section whose top has crossed the reading line wins. */
      let next = sections[0]?.id ?? '';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) next = section.id;
        else break;
      }
      if (next && next !== activeRef.current) {
        activeRef.current = next;
        setActiveId(next);
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [roadId, stops]);

  /* Keep the active chip visible in the mobile strip, horizontally only. */
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const chip = list.querySelector<HTMLElement>(`[data-stop="${activeId}"]`);
    if (!chip) return;
    const target = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({left: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth'});
  }, [activeId]);

  /* Roving focus along the rail. Bound to each link rather than the list, so
     the handler lives on a genuinely interactive element. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLAnchorElement>) => {
      const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(event.key)) return;

      const list = listRef.current;
      if (!list) return;
      const links = Array.from(
        list.querySelectorAll<HTMLAnchorElement>('.ar-rail__link'),
      );
      if (links.length === 0) return;

      const current = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (current < 0) return;

      let next = current;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = links.length - 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        next = Math.min(links.length - 1, current + 1);
      } else next = Math.max(0, current - 1);

      if (next === current) return;
      event.preventDefault();
      links[next].focus();
    },
    [],
  );

  return (
    <nav ref={navRef} className="ar-rail" aria-label="Career chapters">
      <p className="ar-rail__heading tag">THE ROAD</p>

      <div className="ar-rail__track" aria-hidden="true">
        <span className="ar-rail__fill" />
      </div>

      <ol ref={listRef} className="ar-rail__list">
        {stops.map((stop) => {
          const isActive = stop.id === activeId;
          return (
            <li key={stop.id} className="ar-rail__item">
              <a
                href={`#${stop.id}`}
                data-stop={stop.id}
                data-active={isActive ? 'true' : undefined}
                aria-current={isActive ? 'step' : undefined}
                className="ar-rail__link"
                onKeyDown={onKeyDown}
              >
                <span className="ar-rail__dot" aria-hidden="true" />
                <span className="ar-rail__index tabular">{stop.index}</span>
                <span className="ar-rail__label">{stop.label}</span>
                <span className="ar-rail__years tabular">{stop.years}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
