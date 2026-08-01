/**
 * Period switcher. Real <button> elements in a labelled group, each carrying
 * `aria-pressed` so assistive tech reports which window is active. Touch
 * targets are 44px minimum — Jesse runs this from his phone.
 *
 * The gold underline slides between buttons on a transform, so the indicator
 * is one element rather than a border that pops between four.
 */

import {PERIODS, type PeriodId} from './model';

export interface PeriodSwitcherProps {
  value: PeriodId;
  onChange: (id: PeriodId) => void;
  /** Real date range of the current selection, e.g. "Feb 1 — Aug 1". */
  rangeLabel: string;
}

export function PeriodSwitcher({
  value,
  onChange,
  rangeLabel,
}: PeriodSwitcherProps) {
  const index = Math.max(
    0,
    PERIODS.findIndex((p) => p.id === value),
  );

  return (
    <div className="fin-switcher-shell">
      <div
        className="fin-switcher"
        role="group"
        aria-label="Reporting period"
        style={
          {
            '--fin-tabs': PERIODS.length,
            '--fin-tab-index': index,
          } as React.CSSProperties
        }
      >
        <span className="fin-switcher-indicator" aria-hidden="true" />
        {PERIODS.map((period) => (
          <button
            key={period.id}
            type="button"
            className={`fin-switcher-btn ${
              period.id === value ? 'is-active' : ''
            }`}
            aria-pressed={period.id === value}
            onClick={() => onChange(period.id)}
          >
            {period.label}
            <span className="fin-sr"> — {period.caption}</span>
          </button>
        ))}
      </div>
      <p className="tabular fin-switcher-range">{rangeLabel}</p>
    </div>
  );
}
