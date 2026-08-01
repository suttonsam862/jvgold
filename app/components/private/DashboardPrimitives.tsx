/**
 * Shared layout primitives for the private management dashboard. Hairlines
 * and negative space instead of cards — nothing here casts a shadow.
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
      style={delay ? ({'--reveal-delay': delay} as React.CSSProperties) : undefined}
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
        className={`display private-figure text-[clamp(2.25rem,7vw,3.25rem)] ${
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
