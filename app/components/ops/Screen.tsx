/**
 * ============================================================================
 * OPS — SCREEN
 * ============================================================================
 *
 * The page scaffold that did not exist. Every logged-in operational surface
 * (/private/*, /portal/*) renders through this one component, which owns:
 *
 *   - the register class (`.ops`, plus `.ops-dark` when the page opts out)
 *   - the page measure — 1440px, or 1560px behind the `wide` flag
 *   - the sticky masthead: mark, back link, eyebrow, title, subtitle, actions
 *   - the optional hub nav under the masthead
 *   - the "preview data" banner
 *   - a skip link, because the masthead can carry six focusable things
 *
 * Before this, eight routes each re-declared `min-h-[100svh] bg-onyx-deep
 * text-stone` on their own root element and hand-rolled the same header. A
 * register change now happens here and in the `.ops` block of jvgold.css.
 *
 * React 18 only: no `use()`, no async component, no browser API outside an
 * effect. This renders identically on the server and on first paint.
 */

import type {ReactNode} from 'react';
import {Link} from 'react-router';

export interface ScreenNavItem {
  /** Route path. Passed to <Link to>. */
  to: string;
  /** Visible label. Rendered inside .tag brackets. */
  label: string;
  /** Marks the link aria-current="page" and pins its gold underline. */
  current?: boolean;
}

export interface ScreenProps {
  /** The page <h1>. Required — every screen names itself. */
  title: ReactNode;
  /** Micro-label above the title, e.g. "Management View". Gets [ ] brackets. */
  eyebrow?: ReactNode;
  /** One quiet line under the title. Rendered in --ink-mute. */
  subtitle?: ReactNode;
  /** Leading slot in the masthead — a monogram such as <PrivateMark />. */
  mark?: ReactNode;
  /** Back link above the eyebrow. `label` defaults to "Back". */
  back?: {to: string; label?: string};
  /** Trailing masthead controls: links, a log-out <Form>, a primary button. */
  actions?: ReactNode;
  /** Hub links in a second masthead row. Omit or pass [] to hide the row. */
  nav?: ScreenNavItem[];
  /** Accessible name for the hub nav. Defaults to "Sections". */
  navLabel?: string;
  /** Preview-data banner copy. Omit to hide the banner entirely. */
  notice?: ReactNode;
  /**
   * How the banner announces itself. `status` (default) is right when the copy
   * describes the state of the data on screen; `note` when it is static
   * boilerplate that should not interrupt a screen reader.
   */
  noticeRole?: 'status' | 'note';
  /** 1560px measure instead of 1440px. For the clients table only. */
  wide?: boolean;
  /** Flip the whole screen to the dark register. Light is the default. */
  dark?: boolean;
  /** Extra classes on <main>. Spacing utilities belong here. */
  className?: string;
  /** Extra classes on the root element. */
  rootClassName?: string;
  /** Extra classes on the sticky <header>. */
  headerClassName?: string;
  /** id on <main>; the skip link targets it. Defaults to "ops-main". */
  mainId?: string;
  /** Render the skip link. Default true. */
  skipLink?: boolean;
  children: ReactNode;
}

export function Screen({
  title,
  eyebrow,
  subtitle,
  mark,
  back,
  actions,
  nav,
  navLabel = 'Sections',
  notice,
  noticeRole = 'status',
  wide = false,
  dark = false,
  className = '',
  rootClassName = '',
  headerClassName = '',
  mainId = 'ops-main',
  skipLink = true,
  children,
}: ScreenProps) {
  const hasNav = Boolean(nav && nav.length > 0);

  return (
    <div
      className={[
        'ops',
        'ops-screen',
        dark ? 'ops-dark' : '',
        wide ? 'ops-wide' : '',
        rootClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {skipLink ? (
        <a href={`#${mainId}`} className="ops-skip">
          Skip to content
        </a>
      ) : null}

      <header className={`ops-head ${headerClassName}`.trim()}>
        <div className="ops-shell ops-head-inner">
          <div className="ops-head-id">
            {mark ? <span className="ops-mark">{mark}</span> : null}
            <div className="min-w-0">
              {back ? (
                <Link to={back.to} className="ops-back">
                  <span aria-hidden="true">&larr;</span>
                  {back.label ?? 'Back'}
                </Link>
              ) : null}
              {eyebrow ? <p className="tag ops-eyebrow">{eyebrow}</p> : null}
              <h1 className="display ops-title">{title}</h1>
              {subtitle ? <p className="ops-subtitle">{subtitle}</p> : null}
            </div>
          </div>

          {actions ? <div className="ops-actions">{actions}</div> : null}
        </div>

        {hasNav ? (
          <nav aria-label={navLabel} className="ops-nav">
            <div className="ops-shell ops-nav-inner">
              {nav?.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={item.current ? 'page' : undefined}
                  className="tag ops-nav-link"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      {notice ? (
        <p role={noticeRole} className="ops-banner">
          {notice}
        </p>
      ) : null}

      <main id={mainId} className={`ops-shell ops-main ${className}`.trim()}>
        {children}
      </main>
    </div>
  );
}

export default Screen;
