/**
 * Week-by-week sparkline for the KPI row. Hand-rolled SVG — the CSP is
 * same-origin only, so there is no chart library and never will be.
 *
 * The viewBox is a fixed 100x30 stretched with `preserveAspectRatio="none"`,
 * which means the geometry is pure percentages and the component fits any
 * column width without a resize observer. `vector-effect="non-scaling-stroke"`
 * keeps the hairline exactly 1px however far it is stretched.
 */

import {useEffect, useState} from 'react';
import {formatMoney} from '~/lib/ops/types';
import type {SparkBucket} from './model';
import {shortDate} from './model';

export interface SparklineProps {
  points: SparkBucket[];
  /** Accessible name — the chart is decorative only if it has one. */
  label: string;
  animate: boolean;
  /** Bucket noun for the summary sentence, e.g. "week". */
  bucketLabel: string;
}

export function Sparkline({
  points,
  label,
  animate,
  bucketLabel,
}: SparklineProps) {
  const [drawn, setDrawn] = useState(false);

  const values = points.map((p) => p.cents);
  const max = Math.max(1, ...values);
  const count = Math.max(1, points.length - 1);

  // 100 wide, 30 tall. y is inverted: 0 is the top.
  const coords = points.map((p, i) => {
    const x = count === 0 ? 0 : (i / count) * 100;
    const y = 28 - (p.cents / max) * 26;
    return {x, y};
  });

  const line = coords.length
    ? coords
        .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
        .join(' ')
    : 'M0 28 L100 28';

  const area = coords.length
    ? `${line} L100 30 L0 30 Z`
    : 'M0 28 L100 28 L100 30 L0 30 Z';

  const last = coords.length ? coords[coords.length - 1] : {x: 100, y: 28};

  /* Re-run the stroke draw whenever the shape changes (a period switch).
   * The dash offset is reset to 1, a frame is allowed to paint, then it is
   * released to 0 and CSS eases it home. */
  useEffect(() => {
    if (!animate) {
      setDrawn(true);
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
  }, [animate, line]);

  const total = values.reduce((sum, v) => sum + v, 0);
  const peak = points.reduce(
    (best, p) => (p.cents > best.cents ? p : best),
    points[0] ?? {start: '', cents: 0},
  );

  const summary = points.length
    ? `${points.length} ${bucketLabel} buckets. Best ${bucketLabel} beginning ${shortDate(peak.start)} at ${formatMoney(peak.cents)}. Total ${formatMoney(total)}.`
    : 'No payments in this period.';

  return (
    <div className="fin-spark">
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}. ${summary}`}
        focusable="false"
      >
        <path className="fin-spark-area" d={area} />
        <path
          className={`fin-spark-line ${drawn ? 'is-drawn' : ''}`}
          d={line}
          pathLength={1}
          vectorEffect="non-scaling-stroke"
          fill="none"
        />
      </svg>
      <span
        className="fin-spark-dot"
        style={{left: `${last.x}%`, top: `${(last.y / 30) * 100}%`}}
        aria-hidden="true"
      />
    </div>
  );
}
