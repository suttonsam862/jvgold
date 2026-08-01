/**
 * Layout primitives for the /portal parent view. Hairlines and negative space
 * instead of cards — nothing here casts a shadow. Deliberately the same
 * vocabulary as the staff dashboard so the two read as one system.
 */

interface PanelProps {
  /** Micro-label; the [ ] brackets are added by the .tag class. */
  label: string;
  /** Optional right-aligned context line (counts, ranges, totals). */
  meta?: string;
  children: React.ReactNode;
  className?: string;
  /** Stagger for the shared scroll-reveal. */
  delay?: string;
}

export function Panel({
  label,
  meta,
  children,
  className = '',
  delay,
}: PanelProps) {
  return (
    <section
      className={className}
      data-reveal
      style={
        delay ? ({'--reveal-delay': delay} as React.CSSProperties) : undefined
      }
    >
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b rule-light pb-3">
        <h2 className="tag text-gold-deep">{label}</h2>
        {meta ? (
          <p className="tabular text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
            {meta}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

interface FigureProps {
  value: string;
  label: string;
  /** Exactly one figure per group should be accented. */
  accent?: boolean;
  sub?: string;
}

export function Figure({value, label, accent = false, sub}: FigureProps) {
  return (
    <div>
      <p
        className={`display portal-figure text-[clamp(2.25rem,7vw,3.25rem)] ${
          accent ? 'text-gold' : 'text-stone'
        }`}
      >
        {value}
      </p>
      <p className="mt-3 text-sm text-steel">{label}</p>
      {sub ? (
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-steel/70">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

interface MeterProps {
  /** Sessions consumed. */
  used: number;
  /** Sessions purchased. */
  total: number;
  /** Accessible name — what this bar is measuring. */
  label: string;
}

/**
 * A quiet progress hairline: a 2px track with a gold fill that eases in on
 * mount. Announced as a progressbar rather than left as decoration, because
 * the remaining count is the whole point of the panel.
 */
export function Meter({used, total, label}: MeterProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(Math.max((used / safeTotal) * 100, 0), 100);

  return (
    <div
      className="portal-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={used}
      aria-valuetext={`${used} of ${total} sessions used`}
    >
      <span
        className="portal-meter-fill"
        style={{'--portal-meter': `${percent}%`} as React.CSSProperties}
      />
    </div>
  );
}

export type ComplianceState = 'ok' | 'attention' | 'missing';

interface ComplianceFlagProps {
  label: string;
  detail: string;
  state: ComplianceState;
}

/** One line of the compliance strip — a dot, the requirement, the detail. */
export function ComplianceFlag({label, detail, state}: ComplianceFlagProps) {
  const tone =
    state === 'ok'
      ? 'text-steel'
      : state === 'attention'
        ? 'text-gold'
        : 'text-gold';

  return (
    <li className="flex items-baseline gap-3 py-3">
      <span
        className={`portal-dot mt-[0.4rem] shrink-0 ${
          state === 'ok' ? 'text-steel/50' : 'text-gold'
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-sm text-stone">{label}</span>
        <span className={`mt-1 block text-xs leading-relaxed ${tone}`}>
          {state === 'ok' ? detail : `${detail} — action needed`}
        </span>
      </span>
    </li>
  );
}
