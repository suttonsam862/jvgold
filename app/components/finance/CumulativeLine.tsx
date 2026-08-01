/**
 * ============================================================================
 * CUMULATIVE NET REVENUE — hand-rolled SVG line with a stroke draw-in
 * ============================================================================
 *
 * A monotonically rising line: every dollar collected in the window, stacked.
 * The draw is a `stroke-dashoffset` animation over `pathLength={1}` — that
 * normalisation means the path can be any length in user units and the timing
 * stays identical, which matters because the point count changes with the
 * period.
 *
 * The stroke is `vector-effect="non-scaling-stroke"` so the non-uniform
 * `preserveAspectRatio="none"` stretch cannot smear the hairline. The endpoint
 * marker is an HTML dot positioned in percentages for the same reason — an SVG
 * circle would render as an ellipse under that stretch.
 */

import {useEffect, useState} from 'react';
import {formatMoney} from '~/lib/ops/types';
import {ChartData} from './primitives';
import {shortDate, type CumulativePoint} from './model';

export interface CumulativeLineProps {
  points: CumulativePoint[];
  animate: boolean;
  entered: boolean;
  rangeLabel: string;
}

export function CumulativeLine({
  points,
  animate,
  entered,
  rangeLabel,
}: CumulativeLineProps) {
  const [drawn, setDrawn] = useState(false);

  const max = Math.max(1, ...points.map((p) => p.cents));
  const span = Math.max(1, points.length - 1);

  const coords = points.map((p, i) => ({
    x: (i / span) * 100,
    // 4 units of headroom at the top so the peak never clips the frame.
    y: 96 - (p.cents / max) * 92,
  }));

  const line = coords.length
    ? coords
        .map(
          (c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`,
        )
        .join(' ')
    : '';
  const area = coords.length ? `${line} L100 100 L0 100 Z` : '';
  const last = coords.length ? coords[coords.length - 1] : null;

  /* Re-run the draw whenever the path changes — i.e. on every period switch.
   * Reset to "undrawn", let one frame paint, then release; CSS eases it. */
  useEffect(() => {
    if (!animate || !entered) {
      setDrawn(entered);
      return;
    }
    setDrawn(false);
    let raf = 0;
    const outer = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(raf);
    };
  }, [animate, entered, line]);

  const total = points.length ? points[points.length - 1].cents : 0;

  /* One row per month rather than one per day — a 365-day window would be a
   * 365-row table nobody can read. The month-end running total is the figure
   * that actually answers "where were we by then?". */
  const milestones: CumulativePoint[] = [];
  points.forEach((p, i) => {
    const next = points[i + 1];
    if (!next || next.date.slice(0, 7) !== p.date.slice(0, 7)) {
      milestones.push(p);
    }
  });

  const summary = points.length
    ? `Runs from ${shortDate(points[0].date)} to ${shortDate(points[points.length - 1].date)}, finishing at ${formatMoney(total)} net collected.`
    : 'No payments in this period.';

  return (
    <figure className="fin-chart">
      <div className="fin-plot fin-plot-line">
        <div className="fin-grid" aria-hidden="true">
          {[1, 0.5, 0].map((g) => (
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
          aria-label={`Cumulative net revenue over ${rangeLabel}. ${summary}`}
          focusable="false"
        >
          <defs>
            <linearGradient id="finCumulativeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8a25b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#c8a25b" stopOpacity="0" />
            </linearGradient>
          </defs>
          {area ? (
            <path
              className={`fin-area ${drawn ? 'is-drawn' : ''}`}
              d={area}
              fill="url(#finCumulativeFill)"
            />
          ) : null}
          {line ? (
            <path
              className={`fin-line ${drawn ? 'is-drawn' : ''}`}
              d={line}
              pathLength={1}
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          ) : null}
        </svg>

        {last ? (
          <span
            className={`fin-endpoint ${drawn ? 'is-drawn' : ''}`}
            style={{left: `${last.x}%`, top: `${last.y}%`}}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="fin-axis-ends" aria-hidden="true">
        <span className="tabular">
          {points.length ? shortDate(points[0].date) : '—'}
        </span>
        <span className="tabular">
          {points.length ? shortDate(points[points.length - 1].date) : '—'}
        </span>
      </div>

      <figcaption className="fin-caption">
        Running total of net revenue — gross less refunds and processing fees.
      </figcaption>

      <ChartData summary="Cumulative revenue — data table">
        <table className="fin-table">
          <caption className="fin-sr">
            Running net revenue total at the end of each month in the window
          </caption>
          <thead>
            <tr>
              <th scope="col">As of</th>
              <th scope="col">Cumulative net</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => (
              <tr key={m.date}>
                <th scope="row" className="tabular">
                  {shortDate(m.date)}
                </th>
                <td className="tabular">{formatMoney(m.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartData>
    </figure>
  );
}
