/**
 * ============================================================================
 * OPS — PRIMITIVES
 * ============================================================================
 *
 * ONE canonical Panel and Figure, reconciling the three copies that used to
 * live in private/DashboardPrimitives, portal/PortalPrimitives and
 * finance/primitives. Every prop any of those call sites passed is supported
 * here, so imports can be repointed without touching the JSX around them.
 *
 * The visual language is unchanged: hairlines and negative space instead of
 * cards. Nothing here casts a shadow, nothing here has four borders, and no
 * component sets its own outer margin — vertical rhythm stays the caller's.
 *
 * Colour comes exclusively from the `.ops` register tokens (--ink, --ink-mute,
 * --ink-accent, --line…), so these render correctly on the stone ground and,
 * inside an `.ops-dark` subtree, on the near-black one. No component in this
 * file names a colour.
 *
 * React 18 only. Pure render — no effects, no browser APIs, no `use()`.
 */

import {useId, type ReactNode} from 'react';

/* ==========================================================================
 * SECTION HEADING
 * ======================================================================== */

export interface SectionHeadingProps {
  /** Micro-label; the [ ] brackets come from the .tag class. */
  label: ReactNode;
  /** Right-aligned context line — counts, ranges, totals. */
  meta?: ReactNode;
  /** Controls that sit beside the meta line (a filter chip, a link). */
  actions?: ReactNode;
  /** id on the heading, so a section can point aria-labelledby at it. */
  id?: string;
  /** Heading level. 2 by default; drop to 3/4 when nesting under a Panel. */
  level?: 2 | 3 | 4;
  className?: string;
}

/**
 * The label / hairline / meta band that opens every block on these screens.
 * Panel renders one internally; export it for the places that need the band
 * without the surrounding <section>.
 */
export function SectionHeading({
  label,
  meta,
  actions,
  id,
  level = 2,
  className = '',
}: SectionHeadingProps) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';

  return (
    <div className={`ops-panel-head ${className}`.trim()}>
      <Heading id={id} className="tag ops-panel-label">
        {label}
      </Heading>
      {meta || actions ? (
        <div className="ops-panel-aside">
          {meta ? <p className="tabular ops-panel-meta">{meta}</p> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * PANEL
 * ======================================================================== */

export interface PanelProps {
  /** Micro-label; the [ ] brackets come from the .tag class. */
  label: ReactNode;
  /** Optional right-aligned context line (counts, ranges, totals). */
  meta?: ReactNode;
  /** Controls beside the meta line. */
  actions?: ReactNode;
  /**
   * Entrance stagger, e.g. `'240ms'`. Neutralised under reduced motion by the
   * register's own media query — never gate it in JS.
   */
  delay?: string;
  /**
   * Controlled entrance. OMIT IT and the panel joins the shared scroll reveal
   * ([data-reveal]) like the dashboards do. PASS IT and the panel is driven by
   * your page's own `entered` flag instead (`.ops-rise` / `.is-in`), which is
   * what the finance screen needs so a period switch morphs immediately rather
   * than crawling in again.
   */
  entered?: boolean;
  /**
   * id for the heading. Supply one when you want a stable, linkable id;
   * otherwise a unique one is generated so the <section> is ALWAYS named.
   */
  headingId?: string;
  /** Heading level for the label. Default 2. */
  level?: 2 | 3 | 4;
  /** Classes on the <section>. Put the outer spacing here (`mt-16`…). */
  className?: string;
  /** Classes on the inner body wrapper. */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Hairline-framed block. Rules over cards — no border box, no shadow, no fill.
 * The label sits above a single hairline and the content hangs off it.
 */
export function Panel({
  label,
  meta,
  actions,
  delay,
  entered,
  headingId,
  level = 2,
  className = '',
  bodyClassName = '',
  children,
}: PanelProps) {
  const autoId = useId();
  const id = headingId ?? autoId;

  // `entered` undefined => scroll-observer reveal. Defined => caller-driven.
  const controlled = entered !== undefined;

  const style = delay
    ? ({
        '--reveal-delay': delay,
        '--ops-delay': delay,
      } as React.CSSProperties)
    : undefined;

  return (
    <section
      aria-labelledby={id}
      className={[
        controlled ? 'ops-rise' : '',
        controlled && entered ? 'is-in' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-reveal={controlled ? undefined : ''}
      style={style}
    >
      <SectionHeading id={id} label={label} meta={meta} actions={actions} level={level} />
      <div className={`ops-panel-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

/* ==========================================================================
 * FIGURE
 * ======================================================================== */

export type FigureTone = 'default' | 'accent' | 'mute' | 'warn';

export interface FigureProps {
  /** The number itself. Already formatted — Figure does no maths. */
  value: ReactNode;
  /** What the number is. */
  label: ReactNode;
  /** Optional third line, set in small caps. */
  sub?: ReactNode;
  /**
   * Exactly one figure per group should be accented. Legacy alias kept from
   * the private/portal copies; identical to `tone="accent"`.
   */
  accent?: boolean;
  /**
   * Colour role. `'owing'` is a legacy alias for `'warn'`, kept so the clients
   * sheet can repoint without editing its call sites.
   */
  tone?: FigureTone | 'owing';
  /** Type scale. `lg` is the dashboard hero figure and the default. */
  size?: 'lg' | 'md' | 'sm';
  /**
   * `'block'` (default) renders <div><p><p>. `'definition'` renders a
   * <div><dt><dd> triple for use inside a <dl>.
   */
  variant?: 'block' | 'definition';
  className?: string;
  valueClassName?: string;
}

const TONE_CLASS: Record<FigureTone, string> = {
  default: '',
  accent: 'ops-figure-accent',
  mute: 'ops-figure-mute',
  warn: 'ops-figure-warn',
};

const SIZE_CLASS = {
  lg: '',
  md: 'ops-figure-md',
  sm: 'ops-figure-sm',
} as const;

/**
 * A single large number with its caption. Accent is bronze (--ink-accent) on
 * the light ground and gold inside .ops-dark, so the same call site is legible
 * in either register.
 */
export function Figure({
  value,
  label,
  sub,
  accent = false,
  tone,
  size = 'lg',
  variant = 'block',
  className = '',
  valueClassName = '',
}: FigureProps) {
  const resolved: FigureTone =
    tone === 'owing' ? 'warn' : (tone ?? (accent ? 'accent' : 'default'));

  const valueClasses = [
    'display',
    'tabular',
    'ops-figure-value',
    SIZE_CLASS[size],
    TONE_CLASS[resolved],
    valueClassName,
  ]
    .filter(Boolean)
    .join(' ');

  if (variant === 'definition') {
    return (
      <div className={className}>
        <dt className="tag ops-panel-label">{label}</dt>
        <dd className={`mt-2 ${valueClasses}`}>{value}</dd>
        {sub ? <dd className="mt-1 ops-figure-sub">{sub}</dd> : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className={valueClasses}>{value}</p>
      <p className="mt-3 ops-figure-label">{label}</p>
      {sub ? <p className="mt-1 ops-figure-sub">{sub}</p> : null}
    </div>
  );
}

/* ==========================================================================
 * ROW
 * ======================================================================== */

export interface RowProps {
  /** Element to render. `li` by default — these are almost always lists. */
  as?: 'li' | 'div' | 'tr';
  /**
   * Suppress the leading hairline. Pass `index === 0`, which replaces the
   * `index === 0 ? '' : 'border-t rule-light'` ternary these screens repeat
   * about twenty times.
   */
  first?: boolean;
  /** Vertical rhythm lives here — Row deliberately sets no padding. */
  className?: string;
  /** Forwarded to the element, for `aria-current` and friends. */
  ariaCurrent?: 'date' | 'page' | 'true' | false;
  children: ReactNode;
}

export function Row({
  as = 'li',
  first = false,
  className = '',
  ariaCurrent,
  children,
}: RowProps) {
  const Element = as;
  return (
    <Element
      aria-current={ariaCurrent || undefined}
      className={['ops-row', first ? 'ops-row-first' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Element>
  );
}

/* ==========================================================================
 * SMALL SHARED PIECES
 * ======================================================================== */

/** Status dot. Decorative by definition — the text beside it carries meaning. */
export function Dot({
  tone = 'mute',
  className = '',
}: {
  tone?: 'accent' | 'mute' | 'ink' | 'warn';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ops-dot ops-dot-${tone} ${className}`.trim()}
    />
  );
}

/** Screen-reader-only text. For summaries that duplicate a visual. */
export function VisuallyHidden({children}: {children: ReactNode}) {
  return <span className="ops-sr">{children}</span>;
}

export interface MeterProps {
  /** Amount consumed. */
  used: number;
  /** Amount available. */
  total: number;
  /** Accessible name — what this bar is measuring. */
  label: string;
  /** Overrides the spoken value. Defaults to "N of M". */
  valueText?: string;
  className?: string;
}

/**
 * A quiet progress hairline: a 2px track with a gold fill. Announced as a
 * progressbar rather than left as decoration, because the remaining count is
 * usually the whole point of the panel it sits in.
 */
export function Meter({
  used,
  total,
  label,
  valueText,
  className = '',
}: MeterProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(Math.max((used / safeTotal) * 100, 0), 100);

  return (
    <div
      className={`ops-meter ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={used}
      aria-valuetext={valueText ?? `${used} of ${total}`}
    >
      <span
        className="ops-meter-fill"
        style={{'--ops-meter': `${percent}%`} as React.CSSProperties}
      />
    </div>
  );
}

/**
 * The collapsible data table that belongs under every chart. Non-negotiable:
 * no figure on these screens is available to sighted users only.
 */
export function ChartData({
  summary,
  children,
  className = '',
}: {
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`ops-data ${className}`.trim()}>
      <summary className="tag ops-mute">{summary}</summary>
      <div className="ops-data-scroll">{children}</div>
    </details>
  );
}
