/**
 * ============================================================================
 * CLIENT LIST — FILTER SURFACE
 * ============================================================================
 *
 * Saved views, free-text search, the facet panel, the range inputs and the
 * active-filter chips. This component owns NO state: it is handed the parsed
 * filter state and calls `onChange` with the next state. The route pushes that
 * into the URL, the URL comes back down as props. One direction, always.
 *
 * The facet panel is a single DOM tree at every breakpoint. On phones it is
 * collapsed behind a Filters button; from `lg` up the stylesheet forces it open
 * and hides the button (see `.clients-facets[data-open]` in clients.css). No
 * duplicated markup, no breakpoint-dependent render — which also means no
 * hydration mismatch, because the server has no idea how wide the screen is.
 */

import {useId, useMemo, useState} from 'react';
import type {ClientLevel, ClientSource, ClientStatus, IsoDate} from '~/lib/ops/types';
import {formatMoney} from '~/lib/ops/types';
import type {
  ClientFilterState,
  ClientRow,
  ComplianceGap,
  PackageBucket,
} from './filterModel';
import {
  chipsFor,
  clearChip,
  EMPTY_FILTERS,
  facetCounts,
  GAP_LABEL,
  GAPS,
  LEVELS,
  PACKAGE_BUCKET_LABEL,
  PACKAGE_BUCKETS,
  SAVED_VIEWS,
  SOURCE_LABEL,
  SOURCES,
  STATUSES,
  VALUES,
  activeDimensions,
  viewIsActive,
} from './filterModel';

interface ClientsFiltersProps {
  /** The full, unfiltered roster — facet counts are measured against it. */
  rows: ClientRow[];
  state: ClientFilterState;
  onChange: (next: ClientFilterState) => void;
  anchorDate: IsoDate;
  families: string[];
  tags: string[];
  /** Rows currently surviving every filter. */
  resultCount: number;
}

export function ClientsFilters({
  rows,
  state,
  onChange,
  anchorDate,
  families,
  tags,
  resultCount,
}: ClientsFiltersProps) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const panelId = useId();

  const active = activeDimensions(state);
  const chips = chipsFor(state);

  // One pass per faceted dimension, each with its own dimension held out so a
  // selection never zeroes out its own siblings.
  const counts = useMemo(
    () => ({
      level: facetCounts(rows, state, 'level', VALUES.level),
      status: facetCounts(rows, state, 'status', VALUES.status),
      source: facetCounts(rows, state, 'source', VALUES.source),
      tags: facetCounts(rows, state, 'tags', VALUES.tags),
      family: facetCounts(rows, state, 'family', VALUES.family),
      gaps: facetCounts(rows, state, 'gaps', VALUES.gaps),
      pkg: facetCounts(rows, state, 'pkg', VALUES.pkg),
    }),
    [rows, state],
  );

  /** Add or remove one value from a multi-select dimension. */
  function toggle<K extends 'level' | 'status' | 'source' | 'tags' | 'family' | 'gaps' | 'pkg'>(
    key: K,
    value: ClientFilterState[K][number],
  ) {
    const current = state[key] as string[];
    const next = current.includes(value as string)
      ? current.filter((v) => v !== value)
      : [...current, value as string];
    onChange({...state, [key]: next} as ClientFilterState);
  }

  function setField(key: keyof ClientFilterState, value: string) {
    onChange({...state, [key]: value} as ClientFilterState);
  }

  return (
    <section className="clients-filters" aria-label="Filter the roster">
      {/* ------------------------------------------------------ SAVED VIEWS */}
      <div className="clients-views" role="group" aria-label="Saved views">
        <p className="tag shrink-0 text-gold-deep">Saved views</p>
        <div className="clients-views-track">
          {SAVED_VIEWS.map((view) => {
            const isActive = viewIsActive(view, state, anchorDate);
            return (
              <button
                key={view.id}
                type="button"
                title={view.hint}
                aria-pressed={isActive}
                className="clients-view-chip"
                onClick={() =>
                  onChange(
                    isActive
                      ? {...EMPTY_FILTERS}
                      : {...EMPTY_FILTERS, ...view.build(anchorDate)},
                  )
                }
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------- SEARCH */}
      <div className="clients-search-row">
        <div className="clients-search">
          <label htmlFor={searchId} className="tag text-gold-deep">
            Search
          </label>
          <input
            id={searchId}
            type="search"
            className="clients-input clients-search-input"
            value={state.q}
            placeholder="Name, guardian, email, phone, school, tag…"
            autoComplete="off"
            aria-describedby={`${searchId}-hint`}
            onChange={(event) => setField('q', event.currentTarget.value)}
          />
          <p id={`${searchId}-hint`} className="clients-hint">
            Every word has to match. Searches name, account, guardian, email,
            phone, school, family, tags and coach notes.
          </p>
        </div>

        <button
          type="button"
          className="clients-facets-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span>Filters</span>
          <span className="tabular clients-facets-count">
            {active.length ? active.length : '—'}
          </span>
        </button>
      </div>

      {/* ------------------------------------------------------------ CHIPS */}
      {chips.length > 0 ? (
        <div className="clients-chips" aria-label="Active filters" role="group">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="clients-chip"
              onClick={() => onChange(clearChip(state, chip))}
            >
              <span className="clients-chip-prefix">{chip.prefix}</span>
              <span className="clients-chip-value">{chip.label}</span>
              <span aria-hidden="true" className="clients-chip-x">
                ×
              </span>
              <span className="sr-only">— remove this filter</span>
            </button>
          ))}
          <button
            type="button"
            className="clients-chip clients-chip-clear"
            onClick={() => onChange({...EMPTY_FILTERS, sort: state.sort, dir: state.dir})}
          >
            Clear all
          </button>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- FACETS */}
      <div
        id={panelId}
        className="clients-facets"
        data-open={open ? 'true' : 'false'}
      >
        <Facet
          legend="Level"
          options={LEVELS.map((value) => ({
            value,
            label: value,
            count: counts.level[value] ?? 0,
          }))}
          selected={state.level as string[]}
          onToggle={(value) => toggle('level', value as ClientLevel)}
        />

        <Facet
          legend="Status"
          options={STATUSES.map((value) => ({
            value,
            label: value,
            count: counts.status[value] ?? 0,
          }))}
          selected={state.status as string[]}
          onToggle={(value) => toggle('status', value as ClientStatus)}
        />

        <Facet
          legend="Package state"
          options={PACKAGE_BUCKETS.map((value) => ({
            value,
            label: PACKAGE_BUCKET_LABEL[value],
            count: counts.pkg[value] ?? 0,
          }))}
          selected={state.pkg as string[]}
          onToggle={(value) => toggle('pkg', value as PackageBucket)}
        />

        <Facet
          legend="Compliance gaps"
          hint="Matches anyone missing any ticked item."
          options={GAPS.map((value) => ({
            value,
            label: GAP_LABEL[value],
            count: counts.gaps[value] ?? 0,
          }))}
          selected={state.gaps as string[]}
          onToggle={(value) => toggle('gaps', value as ComplianceGap)}
        />

        <Facet
          legend="Source"
          options={SOURCES.map((value) => ({
            value,
            label: SOURCE_LABEL[value],
            count: counts.source[value] ?? 0,
          }))}
          selected={state.source as string[]}
          onToggle={(value) => toggle('source', value as ClientSource)}
        />

        <Facet
          legend="Tags"
          options={tags.map((value) => ({
            value,
            label: value,
            count: counts.tags[value] ?? 0,
          }))}
          selected={state.tags}
          onToggle={(value) => toggle('tags', value)}
        />

        <Facet
          legend="Family group"
          options={families.map((value) => ({
            value,
            label: value,
            count: counts.family[value] ?? 0,
          }))}
          selected={state.family}
          onToggle={(value) => toggle('family', value)}
        />

        <RangeFacet
          legend="Joined"
          type="date"
          fromLabel="On or after"
          toLabel="On or before"
          from={state.joinedFrom}
          to={state.joinedTo}
          onFrom={(value) => setField('joinedFrom', value)}
          onTo={(value) => setField('joinedTo', value)}
        />

        <RangeFacet
          legend="Last session"
          hint="Athletes who have never trained count as infinitely stale — they pass “on or before”."
          type="date"
          fromLabel="On or after"
          toLabel="On or before"
          from={state.seenFrom}
          to={state.seenTo}
          onFrom={(value) => setField('seenFrom', value)}
          onTo={(value) => setField('seenTo', value)}
        />

        <RangeFacet
          legend="Lifetime value"
          hint="Whole dollars."
          type="number"
          prefix="$"
          fromLabel="Minimum"
          toLabel="Maximum"
          from={state.ltvMin}
          to={state.ltvMax}
          onFrom={(value) => setField('ltvMin', digits(value))}
          onTo={(value) => setField('ltvMax', digits(value))}
        />

        <RangeFacet
          legend="Sessions remaining"
          type="number"
          fromLabel="Minimum"
          toLabel="Maximum"
          from={state.remMin}
          to={state.remMax}
          onFrom={(value) => setField('remMin', digits(value))}
          onTo={(value) => setField('remMax', digits(value))}
        />

        <p className="clients-facets-foot tabular" aria-live="polite">
          {resultCount} matching
        </p>
      </div>
    </section>
  );
}

/** Numeric boxes accept digits only, so the URL never carries junk. */
function digits(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 9);
}

/* -------------------------------------------------------------------------- */

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

function Facet({
  legend,
  hint,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  hint?: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const hintId = useId();
  if (!options.length) return null;

  return (
    <fieldset className="clients-facet">
      <legend className="tag text-gold-deep">{legend}</legend>
      {hint ? (
        <p id={hintId} className="clients-hint">
          {hint}
        </p>
      ) : null}
      <ul className="clients-facet-list">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <li key={option.value}>
              <label
                className="clients-option"
                data-checked={checked ? 'true' : 'false'}
                data-empty={option.count === 0 && !checked ? 'true' : 'false'}
              >
                <input
                  type="checkbox"
                  className="clients-option-input"
                  checked={checked}
                  aria-describedby={hint ? hintId : undefined}
                  onChange={() => onToggle(option.value)}
                />
                <span className="clients-option-mark" aria-hidden="true" />
                <span className="clients-option-label">{option.label}</span>
                <span className="tabular clients-option-count">{option.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */

function RangeFacet({
  legend,
  hint,
  type,
  prefix,
  fromLabel,
  toLabel,
  from,
  to,
  onFrom,
  onTo,
}: {
  legend: string;
  hint?: string;
  type: 'date' | 'number';
  prefix?: string;
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const base = useId();
  const hintId = `${base}-hint`;

  return (
    <fieldset className="clients-facet">
      <legend className="tag text-gold-deep">{legend}</legend>
      {hint ? (
        <p id={hintId} className="clients-hint">
          {hint}
        </p>
      ) : null}
      <div className="clients-range">
        <div className="clients-range-field">
          <label htmlFor={`${base}-from`} className="clients-range-label">
            {fromLabel}
          </label>
          <div className="clients-range-shell">
            {prefix ? (
              <span aria-hidden="true" className="clients-range-prefix">
                {prefix}
              </span>
            ) : null}
            <input
              id={`${base}-from`}
              className="clients-input tabular"
              type={type === 'date' ? 'date' : 'text'}
              inputMode={type === 'number' ? 'numeric' : undefined}
              value={from}
              aria-describedby={hint ? hintId : undefined}
              onChange={(event) => onFrom(event.currentTarget.value)}
            />
          </div>
        </div>
        <div className="clients-range-field">
          <label htmlFor={`${base}-to`} className="clients-range-label">
            {toLabel}
          </label>
          <div className="clients-range-shell">
            {prefix ? (
              <span aria-hidden="true" className="clients-range-prefix">
                {prefix}
              </span>
            ) : null}
            <input
              id={`${base}-to`}
              className="clients-input tabular"
              type={type === 'date' ? 'date' : 'text'}
              inputMode={type === 'number' ? 'numeric' : undefined}
              value={to}
              aria-describedby={hint ? hintId : undefined}
              onChange={(event) => onTo(event.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

/* ==========================================================================
 * SUMMARY RAIL — the filtered set, as figures
 * ======================================================================== */

export function RosterSummaryRail({
  count,
  total,
  lifetimeCents,
  balanceCents,
  owing,
  sessionsRemaining,
  gapCount,
  statusBars,
}: {
  count: number;
  total: number;
  lifetimeCents: number;
  balanceCents: number;
  owing: number;
  sessionsRemaining: number;
  gapCount: number;
  statusBars: {status: ClientStatus; count: number; share: number}[];
}) {
  return (
    <div className="clients-summary" data-reveal>
      <dl className="clients-summary-grid">
        <SummaryFigure
          label="In view"
          value={`${count}`}
          sub={`of ${total} clients`}
          accent
        />
        <SummaryFigure
          label="Lifetime value"
          value={formatMoney(lifetimeCents, {compact: true})}
          sub="Collected, net of refunds"
        />
        <SummaryFigure
          label="Outstanding"
          value={formatMoney(balanceCents)}
          sub={`${owing} account${owing === 1 ? '' : 's'} carrying a balance`}
        />
        <SummaryFigure
          label="Sessions banked"
          value={`${sessionsRemaining}`}
          sub="Remaining across packages"
        />
        <SummaryFigure
          label="Compliance gaps"
          value={`${gapCount}`}
          sub="Athletes missing paperwork"
        />
      </dl>

      {statusBars.length > 0 ? (
        <div className="clients-statusbar-wrap">
          <div
            className="clients-statusbar"
            role="img"
            aria-label={statusBars
              .map((bar) => `${bar.status}: ${bar.count}`)
              .join(', ')}
          >
            {statusBars.map((bar) => (
              <span
                key={bar.status}
                className="clients-statusbar-seg"
                data-status={bar.status}
                style={{width: `${bar.share}%`}}
              />
            ))}
          </div>
          <ul className="clients-statusbar-key">
            {statusBars.map((bar) => (
              <li key={bar.status}>
                <span
                  className="clients-statusbar-dot"
                  data-status={bar.status}
                  aria-hidden="true"
                />
                {bar.status}
                <span className="tabular clients-statusbar-num">{bar.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SummaryFigure({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="clients-summary-cell">
      <dt className="tag text-steel">{label}</dt>
      <dd>
        <p
          className={`display tabular clients-summary-value ${
            accent ? 'text-gold' : 'text-stone'
          }`}
        >
          {value}
        </p>
        <p className="clients-summary-sub">{sub}</p>
      </dd>
    </div>
  );
}
