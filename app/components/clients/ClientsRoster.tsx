/**
 * ============================================================================
 * CLIENT LIST — THE ROSTER
 * ============================================================================
 *
 * Two renderings of the SAME rows, chosen by CSS, never by JavaScript:
 *
 *   - `<ClientsTable>`   a hairline table, sortable on every meaningful column.
 *                        Hidden below `lg`.
 *   - `<ClientsCards>`   the same fields as tall rows with room to breathe.
 *                        Hidden from `lg` up.
 *
 * Squashing eight columns into 390px produces a table nobody can read, and a
 * horizontal scroller is worse — Jesse runs this from his phone. So the phone
 * gets purpose-built rows and the desktop gets the dense grid.
 *
 * Because the switch is pure CSS there is no `window.matchMedia` at render
 * time and therefore no hydration mismatch. Both trees exist in the DOM; the
 * hidden one is `display: none`, which also takes it out of the a11y tree.
 *
 * CLICK TARGET: a whole clickable `<tr>` is not focusable and not announced.
 * Each row therefore carries ONE real `<button>` — the athlete's name in the
 * table, a stretched hit area in the card — and that button is the only
 * interactive thing in the row. Mouse users can click anywhere; keyboard and
 * screen-reader users get a single, properly-labelled control.
 */

import type {ClientRow, SortDir, SortKey} from './filterModel';
import {
  GAP_SHORT,
  SORT_LABEL,
  defaultDirFor,
  formatDateShort,
  formatSince,
} from './filterModel';
import {formatMoney} from '~/lib/ops/types';

interface RosterProps {
  rows: ClientRow[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey, dir: SortDir) => void;
  onOpen: (id: string) => void;
  /** Id of the row whose sheet is open, so it can stay highlighted. */
  openId: string | null;
}

const COLUMNS: {key: SortKey; align?: 'right'; className?: string}[] = [
  {key: 'name'},
  {key: 'level'},
  {key: 'status'},
  {key: 'remaining', align: 'right'},
  {key: 'last', align: 'right'},
  {key: 'ltv', align: 'right'},
  {key: 'balance', align: 'right'},
  {key: 'gaps'},
];

/* ==========================================================================
 * DESKTOP
 * ======================================================================== */

export function ClientsTable({rows, sort, dir, onSort, onOpen, openId}: RosterProps) {
  return (
    <div className="clients-table-wrap">
      <table className="clients-table">
        <caption className="sr-only">
          Client roster. Use the column buttons to sort; open an athlete for
          packages, sessions, compliance and payments.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const isSorted = sort === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  data-align={column.align ?? 'left'}
                  aria-sort={
                    isSorted
                      ? dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className="clients-sort"
                    data-active={isSorted ? 'true' : 'false'}
                    onClick={() =>
                      onSort(
                        column.key,
                        isSorted
                          ? dir === 'asc'
                            ? 'desc'
                            : 'asc'
                          : defaultDirFor(column.key),
                      )
                    }
                  >
                    <span>{SORT_LABEL[column.key]}</span>
                    <span aria-hidden="true" className="clients-sort-caret">
                      {isSorted ? (dir === 'asc' ? '↑' : '↓') : '·'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="clients-row"
              data-open={openId === row.id ? 'true' : 'false'}
              onClick={() => onOpen(row.id)}
            >
              <th scope="row" data-align="left">
                <button
                  type="button"
                  className="clients-name"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  <span
                    className="clients-swatch"
                    data-color={row.client.colorIndex}
                    aria-hidden="true"
                  />
                  <span className="clients-name-text">
                    <span className="display clients-name-main">{row.name}</span>
                    <span className="clients-name-sub">
                      {row.guardian ?? row.accountLabel}
                      {row.school ? ` · ${row.school}` : ''}
                    </span>
                  </span>
                </button>
              </th>
              <td data-align="left">
                <span className="clients-level">{row.level}</span>
                {row.age !== null ? (
                  <span className="tabular clients-age">{row.age}</span>
                ) : null}
              </td>
              <td data-align="left">
                <span className="clients-status" data-status={row.status}>
                  <span className="clients-status-dot" aria-hidden="true" />
                  {row.status}
                </span>
              </td>
              <td data-align="right">
                <PackageMeter row={row} />
              </td>
              <td data-align="right">
                <span className="tabular clients-cell-main">
                  {formatDateShort(row.lastSessionAt)}
                </span>
                <span className="clients-cell-sub">
                  {formatSince(row.daysSinceSeen)}
                </span>
              </td>
              <td data-align="right">
                <span className="tabular clients-cell-main">
                  {formatMoney(row.lifetimeValueCents)}
                </span>
              </td>
              <td data-align="right">
                <span
                  className={`tabular clients-cell-main ${
                    row.balanceCents > 0 ? 'clients-owing' : 'text-steel'
                  }`}
                >
                  {row.balanceCents > 0 ? formatMoney(row.balanceCents) : '—'}
                </span>
              </td>
              <td data-align="left">
                <CompliancePips row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
 * MOBILE
 * ======================================================================== */

export function ClientsCards({rows, onOpen, openId}: Omit<RosterProps, 'sort' | 'dir' | 'onSort'>) {
  return (
    <ul className="clients-cards">
      {rows.map((row) => (
        <li
          key={row.id}
          className="clients-card"
          data-open={openId === row.id ? 'true' : 'false'}
        >
          {/* The single focusable control, stretched over the whole card. */}
          <button
            type="button"
            className="clients-card-hit"
            onClick={() => onOpen(row.id)}
          >
            <span className="sr-only">
              {`Open ${row.name} — ${row.status}, ${row.level}, ${
                row.remaining
              } sessions left, lifetime ${formatMoney(row.lifetimeValueCents)}`}
            </span>
          </button>

          <div className="clients-card-body">
            <div className="clients-card-head">
              <span
                className="clients-swatch"
                data-color={row.client.colorIndex}
                aria-hidden="true"
              />
              <div className="clients-card-id">
                <p className="display clients-card-name">{row.name}</p>
                <p className="clients-card-sub">
                  {row.guardian ?? row.accountLabel}
                  {row.school ? ` · ${row.school}` : ''}
                </p>
              </div>
              <span className="clients-status" data-status={row.status}>
                <span className="clients-status-dot" aria-hidden="true" />
                {row.status}
              </span>
            </div>

            <dl className="clients-card-grid">
              <div>
                <dt>Level</dt>
                <dd className="tabular">
                  {row.level}
                  {row.age !== null ? ` · ${row.age}` : ''}
                </dd>
              </div>
              <div>
                <dt>Sessions left</dt>
                <dd className="tabular" data-bucket={row.packageBucket}>
                  {row.packageBucket === 'none' ? '—' : row.remaining}
                </dd>
              </div>
              <div>
                <dt>Last session</dt>
                <dd className="tabular">{formatSince(row.daysSinceSeen)}</dd>
              </div>
              <div>
                <dt>Lifetime</dt>
                <dd className="tabular">
                  {formatMoney(row.lifetimeValueCents, {compact: true})}
                </dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd
                  className={`tabular ${row.balanceCents > 0 ? 'clients-owing' : ''}`}
                >
                  {row.balanceCents > 0 ? formatMoney(row.balanceCents) : '—'}
                </dd>
              </div>
              <div>
                <dt>Family</dt>
                <dd>{row.familyGroup ?? 'Billed alone'}</dd>
              </div>
            </dl>

            <div className="clients-card-foot">
              <CompliancePips row={row} />
              {row.tags.length ? (
                <p className="clients-card-tags">{row.tags.join(' · ')}</p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ==========================================================================
 * SHARED CELL PARTS
 * ======================================================================== */

/**
 * Sessions left, with a hairline burn-down behind the figure. `purchased` can
 * be 0 (no package was ever sold), so the width is guarded rather than divided
 * blindly.
 */
function PackageMeter({row}: {row: ClientRow}) {
  const share =
    row.purchased > 0
      ? Math.max(0, Math.min(100, (row.remaining / row.purchased) * 100))
      : 0;

  return (
    <span className="clients-meter" data-bucket={row.packageBucket}>
      <span className="tabular clients-meter-value">
        {row.packageBucket === 'none' ? '—' : row.remaining}
      </span>
      <span className="clients-meter-track" aria-hidden="true">
        <span className="clients-meter-fill" style={{width: `${share}%`}} />
      </span>
      <span className="clients-cell-sub">
        {row.packageBucket === 'none'
          ? 'No package'
          : `of ${row.purchased || row.remaining}`}
      </span>
    </span>
  );
}

/** Three-letter paperwork pips: filled = on file, hollow = missing. */
function CompliancePips({row}: {row: ClientRow}) {
  const items: {key: 'usaw' | 'insurance' | 'waiver'; ok: boolean}[] = [
    {key: 'usaw', ok: !row.gaps.includes('usaw')},
    {key: 'insurance', ok: !row.gaps.includes('insurance')},
    {key: 'waiver', ok: !row.gaps.includes('waiver')},
  ];
  const missing = items.filter((item) => !item.ok).length;

  return (
    <span className="clients-pips">
      {items.map((item) => (
        <span
          key={item.key}
          className="clients-pip"
          data-ok={item.ok ? 'true' : 'false'}
          aria-hidden="true"
        >
          {GAP_SHORT[item.key]}
        </span>
      ))}
      <span className="sr-only">
        {missing === 0
          ? 'Paperwork complete'
          : `${missing} paperwork item${missing === 1 ? '' : 's'} missing`}
      </span>
    </span>
  );
}
