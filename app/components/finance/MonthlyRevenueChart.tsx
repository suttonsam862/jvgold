/**
 * ============================================================================
 * MONTHLY REVENUE — hand-rolled SVG bar chart
 * ============================================================================
 *
 * WHY THE GEOMETRY LOOKS LIKE THIS
 * The viewBox is a fixed `0 0 100 100` stretched with
 * `preserveAspectRatio="none"`, so every coordinate is literally a percentage
 * and the chart fits a 350px phone column and a 900px desktop column with no
 * resize observer and no layout thrash. The cost of that trick is that any
 * <text> inside would stretch too — so all the typography (axis values, month
 * labels) is real HTML positioned around the plot, which also means it inherits
 * `.tabular` and the brand type properly.
 *
 * THE DRAW-IN
 * Each bar is a full-height rect scaled with `transform: scaleY()` from a
 * bottom origin. Transforms animate on the compositor, so this is a
 * transform/opacity-only animation as required — and because the bar's height
 * is a *transform* rather than an attribute, a period change morphs the bars
 * smoothly instead of snapping.
 *
 * ALWAYS SIX-PLUS MONTHS
 * Every month the dataset holds is always drawn, whatever period is selected;
 * months outside the window are simply dimmed. The shape of the business is
 * never lost to a filter.
 */

import {formatMoney} from '~/lib/ops/types';
import {ChartData} from './primitives';
import type {MonthBar} from './model';

export interface MonthlyRevenueChartProps {
  months: MonthBar[];
  animate: boolean;
  entered: boolean;
  intro: boolean;
  rangeLabel: string;
}

/** Round a max up to a clean 1/2/5 x 10^n so the gridlines read as money. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export function MonthlyRevenueChart({
  months,
  animate,
  entered,
  intro,
  rangeLabel,
}: MonthlyRevenueChartProps) {
  const count = Math.max(1, months.length);
  const max = niceMax(Math.max(1, ...months.map((m) => m.grossCents)));

  // The best month inside the window gets the gold. Exactly one bar, ever.
  let bestIndex = -1;
  let bestValue = -1;
  months.forEach((m, i) => {
    if (m.inPeriod && m.grossCents > bestValue) {
      bestValue = m.grossCents;
      bestIndex = i;
    }
  });

  const step = 100 / count;
  const barWidth = step * 0.5;

  const inPeriod = months.filter((m) => m.inPeriod);
  const windowTotal = inPeriod.reduce((sum, m) => sum + m.grossCents, 0);
  const best = bestIndex >= 0 ? months[bestIndex] : null;

  const summary = best
    ? `${inPeriod.length} months in the selected window totalling ${formatMoney(windowTotal)}. Strongest month ${best.label} at ${formatMoney(best.grossCents)}.`
    : 'No months fall inside the selected window.';

  const gridlines = [1, 0.75, 0.5, 0.25, 0];

  return (
    <figure className="fin-chart">
      <div className="fin-plot fin-plot-bars">
        {/* Gridlines + axis values are HTML so the type stays crisp. */}
        <div className="fin-grid" aria-hidden="true">
          {gridlines.map((g) => (
            <div
              key={g}
              className={`fin-grid-line ${g === 0 ? 'is-base' : ''}`}
              style={{bottom: `${g * 100}%`}}
            >
              <span className="tabular fin-grid-label">
                {g === 0 ? '$0' : formatMoney(Math.round(max * g), {compact: true})}
              </span>
            </div>
          ))}
        </div>

        <svg
          className="fin-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Monthly gross revenue. ${summary}`}
          focusable="false"
        >
          {months.map((m, i) => {
            const scale = Math.max(0, Math.min(1, m.grossCents / max));
            return (
              <rect
                key={m.month}
                className={`fin-bar ${entered ? 'is-in' : ''} ${
                  m.inPeriod ? 'is-active' : 'is-muted'
                } ${i === bestIndex ? 'is-best' : ''}`}
                x={i * step + (step - barWidth) / 2}
                y={0}
                width={barWidth}
                height={100}
                style={
                  {
                    // Always the true value: the no-JS document must still
                    // draw a real chart. `.is-in` is what CSS animates from.
                    '--fin-scale': scale,
                    transitionDelay:
                      animate && intro ? `${600 + i * 70}ms` : '0ms',
                  } as React.CSSProperties
                }
              />
            );
          })}
        </svg>
      </div>

      {/* Month labels — one column per bar, aligned to the same grid. */}
      <div
        className="fin-axis"
        style={{gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`}}
        aria-hidden="true"
      >
        {months.map((m) => (
          <span
            key={m.month}
            className={`tabular fin-axis-label ${
              m.inPeriod ? 'is-active' : ''
            }`}
          >
            {m.label}
          </span>
        ))}
      </div>

      <figcaption className="fin-caption">
        Gross revenue by month. Months outside {rangeLabel} are dimmed.
      </figcaption>

      <ChartData summary="Monthly revenue — data table">
        <table className="fin-table">
          <caption className="fin-sr">
            Gross and net revenue by month, with session counts
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Gross</th>
              <th scope="col">Net</th>
              <th scope="col">Sessions</th>
              <th scope="col">In window</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{m.label}</th>
                <td className="tabular">{formatMoney(m.grossCents)}</td>
                <td className="tabular">{formatMoney(m.netCents)}</td>
                <td className="tabular">{m.sessions}</td>
                <td>{m.inPeriod ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartData>
    </figure>
  );
}
