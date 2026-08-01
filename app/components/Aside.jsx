import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {useId} from 'react';

/**
 * A side bar component with Overlay
 *
 * The drawer chrome (off-canvas transform, 4rem header, 1.25rem main margin)
 * lives in app/styles/jvgold.css. This component owns behavior only —
 * Escape closes, focus moves into the panel on open and is handed back on
 * close, and Tab loops inside the panel so keyboard users cannot wander
 * behind the overlay — plus the few classes that let long content
 * (predictive search results, cart lines) scroll inside the drawer.
 *
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 * @param {{
 *   children?: React.ReactNode;
 *   type: AsideType;
 *   heading: React.ReactNode;
 * }}
 */
export function Aside({children, heading, type}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  const asideRef = useRef(null);
  const lastFocusedRef = useRef(null);

  // Escape closes; Tab stays inside the panel.
  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event) {
          if (event.key === 'Escape') {
            close();
            return;
          }
          if (event.key !== 'Tab' || !asideRef.current) return;

          const focusable = asideRef.current.querySelectorAll(
            'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          if (!focusable.length) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;

          if (!asideRef.current.contains(active)) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded]);

  // Move focus into the panel on open; return it to the opener on close.
  useEffect(() => {
    if (expanded) {
      lastFocusedRef.current =
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const frame = requestAnimationFrame(() => {
        const panel = asideRef.current;
        if (!panel) return;
        const target =
          panel.querySelector('input:not([type="hidden"])') ||
          panel.querySelector('a[href], button:not([disabled])') ||
          panel;
        if (typeof target.focus === 'function') target.focus();
      });
      return () => cancelAnimationFrame(frame);
    }

    const previous = lastFocusedRef.current;
    lastFocusedRef.current = null;
    if (previous && document.contains(previous)) {
      previous.focus();
    }
    return undefined;
  }, [expanded]);

  return (
    <div
      aria-modal={expanded}
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button
        className="close-outside"
        onClick={close}
        aria-hidden="true"
        tabIndex={-1}
      />
      <aside ref={asideRef} tabIndex={-1} className="outline-none">
        <header>
          <h3 id={id} className="tag text-steel">
            {heading}
          </h3>
          <button
            className="close reset -mr-2 flex h-9 w-9 items-center justify-center text-xl! leading-none text-onyx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            onClick={close}
            aria-label="Close"
          >
            &times;
          </button>
        </header>
        <main className="max-h-[calc(100dvh-4rem-2.5rem)] overflow-y-auto overscroll-contain">
          {children}
        </main>
      </aside>
    </div>
  );
}

const AsideContext = createContext(null);

Aside.Provider = function AsideProvider({children}) {
  const [type, setType] = useState('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}

/** @typedef {'search' | 'cart' | 'mobile' | 'closed'} AsideType */
/**
 * @typedef {{
 *   type: AsideType;
 *   open: (mode: AsideType) => void;
 *   close: () => void;
 * }} AsideContextValue
 */

/** @typedef {import('react').ReactNode} ReactNode */
