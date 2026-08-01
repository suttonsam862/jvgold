/**
 * ============================================================================
 * RANKED BARS — revenue by source, top clients, top session types
 * ============================================================================
 *
 * A horizontal ranked bar set, deliberately NOT a pie chart: a ranked list is
 * the only honest way to compare eight shares, and it puts the label, the
 * money and the percentage on one line where they can be read rather than
 * decoded from a legend.
 *
 * ACCESSIBILITY: the bar itself is `aria-hidden` because it carries no
 * information the row's own text does not already state — every row prints its
 * label, its money and its share of total as real text. Nothing here is
 * available to sighted users only, which is why this component needs no
 * companion data table.
 *
 * PRIVACY: `label` arrives already de-identified from the model layer
 * ("Account 07"). Never render a client's name on a finance screen.
 */

import {formatMoney} from '~/lib/ops/types';
import type {RankedRow} from './model';

export interface RankedBarsProps {
  rows: RankedRow[];
  animate: boolean;
  entered: boolean;
  intro: boolean;
  /** Noun for the count column, e.g. "payments" or "sessions". */
  unit: string;
  /** Entrance delay applied before the per-row stagger. */
  baseDelay?: number;
  /** Sentence printed above the list for screen readers and everyone else. */
  summary: string;
  emptyMessage?: string;
}

export function RankedBars({
  rows,
  animate,
  entered,
  intro,
  unit,
  baseDelay = 0,
  summary,
  emptyMessage = 'No revenue recorded in this period.',
}: RankedBarsProps) {
  const max = Math.max(1, ...rows.map((r) => r.grossCents));

  if (!rows.length) {
    return <p className="text-sm text-steel">{emptyMessage}</p>;
  }

  return (
    <div>
      <p className="fin-summary">{summary}</p>
      <ol className="fin-rank">
        {rows.map((row, i) => {
          const scale = Math.max(0, Math.min(1, row.grossCents / max));
          return (
            <li key={row.key} className="fin-rank-row">
              <span className="tabular fin-rank-index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="fin-rank-main">
                <div className="fin-rank-head">
                  <span className="fin-rank-label">{row.label}</span>
                  <span className="tabular fin-rank-value">
                    {formatMoney(row.grossCents)}
                  </span>
                </div>
                <svg
                  className="fin-rank-track"
                  viewBox="0 0 100 4"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect
                    className="fin-rank-rail"
                    x="0"
                    y="1.25"
                    width="100"
                    height="1.5"
                  />
                  <rect
                    className={`fin-rank-fill ${entered ? 'is-in' : ''} ${
                      i === 0 ? 'is-best' : ''
                    }`}
                    x="0"
                    y="1.25"
                    width="100"
                    height="1.5"
                    style={
                      {
                        // True value always — the no-JS document still draws.
                        '--fin-scale': scale,
                        transitionDelay:
                          animate && intro
                            ? `${baseDelay + i * 60}ms`
                            : `${i * 20}ms`,
                      } as React.CSSProperties
                    }
                  />
                </svg>
                <div className="fin-rank-meta">
                  <span>
                    <span className="tabular">{row.count}</span> {unit}
                  </span>
                  <span className="tabular fin-rank-share">
                    {row.share.toFixed(1)}% of total
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
