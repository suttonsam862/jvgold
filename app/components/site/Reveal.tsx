import {useEffect} from 'react';

/**
 * Adds .is-visible to every [data-reveal] element as it enters the viewport.
 * Mounted once in the site shell; CSS in jvgold.css does the animating, and
 * elements only start hidden when the .js class is present, so no-JS renders
 * the finished state.
 */
export function RevealObserver() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)'),
    );
    if (reduce) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      {rootMargin: '0px 0px -12% 0px', threshold: 0.05},
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  });

  return null;
}
