/**
 * ============================================================================
 * KPI ROW
 * ============================================================================
 *
 * Five figures, one of them gold. Restraint is the design: gross revenue for
 * the selected period is the only emphasised number on the screen, and
 * everything else is stone on onyx.
 *
 * Every figure counts up on arrival and morphs between periods. Every figure
 * carries `.tabular` so the digits never reflow while they move.
 */

import {formatMoney, type KpiDirection} from '~/lib/ops/types';
import {useCountUp} from './primitives';
import {Sparkline} from './Sparkline';
import type {FinanceView} from './model';

/* ==========================================================================
 * TILE
 * ======================================================================== */

interface TileProps {
  label: string;
  /** Raw value — cents for money, a plain integer for counts. */
  value: number;
  /** How to turn the animated integer into the string on screen. */
  render: (value: number) => string;
  caption: string;
  animate: boolean;
  entered: boolean;
  delay: string;
  className?: string;
  emphasis?: boolean;
  children?: React.ReactNode;
}

function Tile({
  label,
  value,
  render,
  caption,
  animate,
  entered,
  delay,
  className = '',
  emphasis = false,
  children,
}: TileProps) {
  const shown = useCountUp(value, animate);

  return (
    <div
      className={`fin-tile fin-rise ${entered ? 'is-in' : ''} ${className}`}
      style={{'--fin-delay': delay} as React.CSSProperties}
    >
      <p className="tag text-steel">{label}</p>
      <p
        className={`display tabular fin-figure ${
          emphasis ? 'text-gold' : 'text-stone'
        }`}
      >
        {render(shown)}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-steel">
        {caption}
      </p>
      {children}
    </div>
  );
}

/* ==========================================================================
 * DELTA CHIP
 * ======================================================================== */

function Delta({
  percent,
  direction,
  inverse = false,
}: {
  percent: number | null;
  direction: KpiDirection;
  inverse?: boolean;
}) {
  if (percent === null) {
    return (
      <span className="fin-delta is-flat tabular">
        <span aria-hidden="true">—</span>
        <span className="fin-sr">No comparison period available</span>
      </span>
    );
  }

  // Colour on meaning, never on the arrow: falling debt is a good day.
  const good = direction === 'flat' ? null : (direction === 'up') !== inverse;
  const tone = good === null ? 'is-flat' : good ? 'is-good' : 'is-bad';
  const glyph = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—';
  const word = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat';
  const magnitude = Math.abs(percent).toFixed(1);

  return (
    <span className={`fin-delta tabular ${tone}`}>
      <span aria-hidden="true">
        {glyph} {magnitude}%
      </span>
      <span className="fin-sr">
        {word} {magnitude} percent versus the previous period
      </span>
    </span>
  );
}

/* ==========================================================================
 * ROW
 * ======================================================================== */

export interface KpiRowProps {
  view: FinanceView;
  animate: boolean;
  entered: boolean;
}

export function KpiRow({view, animate, entered}: KpiRowProps) {
  const packageCaption =
    view.activePackages === 1
      ? `${view.bankedSessions} sessions banked on 1 package`
      : `${view.bankedSessions} sessions banked across ${view.activePackages} athletes`;

  return (
    <div className="fin-kpis">
      {/* -------------------------------------------------- HERO: revenue */}
      <Tile
        label="Revenue"
        value={view.grossCents}
        render={(v) => formatMoney(v)}
        caption={`Gross · ${view.rangeLabel}`}
        animate={animate}
        entered={entered}
        delay="0ms"
        className="fin-tile-hero"
        emphasis
      >
        <div className="mt-6 flex items-center gap-4">
          <Delta percent={view.deltaPercent} direction={view.direction} />
          <p className="text-[0.8125rem] text-steel">
            vs{' '}
            <span className="tabular">{formatMoney(view.prevGrossCents)}</span>{' '}
            prior
          </p>
        </div>
        <div className="mt-7 border-t rule-light pt-5">
          <Sparkline
            points={view.spark}
            label={`Revenue by ${view.period.bucketLabel}, ${view.rangeLabel}`}
            bucketLabel={view.period.bucketLabel}
            animate={animate}
          />
          <p className="mt-3 text-[0.6875rem] uppercase tracking-[0.16em] text-steel">
            By {view.period.bucketLabel}
          </p>
        </div>
      </Tile>

      {/* ------------------------------------------------------ net taken */}
      <Tile
        label="Net Collected"
        value={view.netCents}
        render={(v) => formatMoney(v)}
        caption={`After ${formatMoney(view.refundedCents)} refunded and ${formatMoney(view.feeCents)} in fees`}
        animate={animate}
        entered={entered}
        delay="90ms"
      />

      {/* ---------------------------------------------------- outstanding */}
      <Tile
        label="Outstanding"
        value={view.outstandingCents}
        render={(v) => formatMoney(v)}
        caption={`${view.outstandingAccounts} accounts carrying a balance today`}
        animate={animate}
        entered={entered}
        delay="180ms"
      />

      {/* ------------------------------------------------- avg session $$ */}
      <Tile
        label="Avg Session"
        value={view.avgSessionCents}
        render={(v) => formatMoney(v, {cents: true})}
        caption={`Across ${view.sessionCount} billed sessions`}
        animate={animate}
        entered={entered}
        delay="270ms"
      />

      {/* ------------------------------------------------ active packages */}
      <Tile
        label="Active Packages"
        value={view.activePackages}
        render={(v) => String(v)}
        caption={packageCaption}
        animate={animate}
        entered={entered}
        delay="360ms"
      />
    </div>
  );
}
