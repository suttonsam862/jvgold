/**
 * ============================================================================
 * /private/clients — THE CLIENT LIST
 * ============================================================================
 *
 * The full registration roster with, in the client's words, "easy and
 * convenient filtering for any possible form filter he could think of".
 *
 * THE ONE TECHNICAL DECISION THAT MATTERS
 * ---------------------------------------
 * Every filter, every sort and even the open detail sheet live in the URL via
 * `useSearchParams`. There is no `useState` holding a filter anywhere on this
 * page. That single choice buys all of this for free:
 *
 *   - a filtered view is a LINK. Jesse can bookmark "everyone missing a USAW
 *     card with a package running low", or text it to himself;
 *   - refresh keeps the view;
 *   - the browser back button walks back through his filtering, which on a
 *     phone is the gesture he already uses;
 *   - the server and the client agree on what to render, because the URL is
 *     the same on both sides. No hydration mismatch, no flash of unfiltered
 *     roster.
 *
 * Typing in the search box REPLACES the current history entry rather than
 * pushing — otherwise a ten-character query would bury the previous view under
 * ten back presses. Every other change pushes.
 *
 * DATA: read from `~/lib/ops/seed` in the loader and passed down. When Shopify
 * and Supabase are linked, the loader changes and nothing below it does.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Form, Link, useSearchParams} from 'react-router';
import {requireDemoRole} from '~/lib/demoAuth';
import {ANCHOR_DATE, CLIENTS, PAYMENTS, SESSIONS} from '~/lib/ops/seed';
import {ClientDetailSheet} from '~/components/clients/ClientDetailSheet';
import {
  ClientsFilters,
  RosterSummaryRail,
} from '~/components/clients/ClientsFilters';
import {ClientsCards, ClientsTable} from '~/components/clients/ClientsRoster';
import type {
  ClientFilterState,
  SortDir,
  SortKey,
} from '~/components/clients/filterModel';
import {
  CLIENT_PARAM,
  DIMENSION_LABEL,
  EMPTY_FILTERS,
  SORT_KEYS,
  SORT_LABEL,
  activeDimensions,
  buildRows,
  diagnoseEmpty,
  familyGroupsOf,
  filterRows,
  isPristine,
  parseFilters,
  rowsToCsv,
  sortRows,
  summarise,
  tagsOf,
  writeFilters,
} from '~/components/clients/filterModel';
import styles from '~/styles/clients.css?url';
import type {Route} from './+types/private.clients';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Clients — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only — a /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');
  return {
    anchorDate: ANCHOR_DATE,
    clients: CLIENTS,
    sessions: SESSIONS,
    payments: PAYMENTS,
  };
}

type CopyState = 'idle' | 'copied' | 'failed';

export default function PrivateClientsPage({loaderData}: Route.ComponentProps) {
  const {anchorDate, clients, sessions, payments} = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const state = parseFilters(searchParams);
  const selectedId = searchParams.get(CLIENT_PARAM);

  const rows = useMemo(() => buildRows(clients, anchorDate), [clients, anchorDate]);
  const families = useMemo(() => familyGroupsOf(rows), [rows]);
  const tags = useMemo(() => tagsOf(rows), [rows]);

  const matched = useMemo(() => filterRows(rows, state), [rows, state]);
  const visible = useMemo(
    () => sortRows(matched, state.sort, state.dir),
    [matched, state.sort, state.dir],
  );
  const summary = useMemo(() => summarise(visible), [visible]);

  /**
   * The only writer. `replace` collapses history for keystroke-rate changes;
   * `preventScrollReset` stops the page jumping to the top every time a facet
   * is ticked, which on a phone would throw away Jesse's place in the list.
   */
  const commit = useCallback(
    (next: ClientFilterState, replace: boolean) => {
      setSearchParams(writeFilters(next, searchParams), {
        replace,
        preventScrollReset: true,
      });
    },
    [searchParams, setSearchParams],
  );

  const onFiltersChange = useCallback(
    (next: ClientFilterState) => {
      // Only the free-text box changed → replace, so ten keystrokes are not ten
      // history entries. Anything else is a deliberate act worth going back to.
      const onlyQueryChanged =
        next.q !== state.q &&
        writeFilters({...next, q: ''}).toString() ===
          writeFilters({...state, q: ''}).toString();
      commit(next, onlyQueryChanged);
    },
    [commit, state],
  );

  const onSort = useCallback(
    (sort: SortKey, dir: SortDir) => commit({...state, sort, dir}, false),
    [commit, state],
  );

  const openClient = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(CLIENT_PARAM, id);
      setSearchParams(next, {preventScrollReset: true});
    },
    [searchParams, setSearchParams],
  );

  const closeClient = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(CLIENT_PARAM);
    setSearchParams(next, {preventScrollReset: true});
  }, [searchParams, setSearchParams]);

  /* ------------------------------------------------------------ CSV EXPORT */

  const [copyState, setCopyState] = useState<CopyState>('idle');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const flash = useCallback((next: CopyState) => {
    setCopyState(next);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2600);
  }, []);

  /**
   * Copy the CURRENTLY FILTERED set. `navigator.clipboard` needs a secure
   * context and a user gesture and is absent in some in-app browsers, so the
   * old `execCommand` route stands behind it. If both fail we say so rather
   * than pretending it worked.
   */
  const copyCsv = useCallback(async () => {
    const csv = rowsToCsv(visible);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(csv);
        flash('copied');
        return;
      }
    } catch {
      // Fall through to the legacy path.
    }
    try {
      const area = document.createElement('textarea');
      area.value = csv;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      flash(ok ? 'copied' : 'failed');
    } catch {
      flash('failed');
    }
  }, [visible, flash]);

  /* ---------------------------------------------------------- DETAIL SHEET */

  const selected = selectedId
    ? (clients.find((client) => client.id === selectedId) ?? null)
    : null;

  const selectedSessions = useMemo(() => {
    if (!selected) return [];
    return sessions.filter((session) => session.athleteIds.includes(selected.id));
  }, [sessions, selected]);

  const selectedPayments = useMemo(() => {
    if (!selected) return [];
    return payments
      .filter((payment) => payment.clientId === selected.id)
      .slice()
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [payments, selected]);

  /* A URL pointing at a client who no longer exists should not leave a ghost
     param behind. Clean it up once, on the client. */
  useEffect(() => {
    if (selectedId && !selected) closeClient();
  }, [selectedId, selected, closeClient]);

  const culprits = visible.length === 0 ? diagnoseEmpty(rows, state) : [];

  return (
    <div className="clients-page bg-onyx-deep text-stone">
      <header className="clients-header border-b rule-light">
        <div className="clients-header-inner">
          <div className="clients-header-id">
            <Link to="/private/dashboard" className="clients-back">
              <span aria-hidden="true">←</span> Management view
            </Link>
            <h1 className="display clients-title">Clients</h1>
            <p className="clients-subtitle">
              Every registration, filterable on anything. The view you are
              looking at is in the address bar — bookmark it.
            </p>
          </div>
          <Form method="post" action="/private/logout">
            <button type="submit" className="tag clients-logout">
              Log Out
            </button>
          </Form>
        </div>
      </header>

      <p role="status" className="clients-notice">
        Seed data — de-identified preview. The production roster reads live from
        Supabase and Shopify.
      </p>

      <main className="clients-main">
        <RosterSummaryRail
          count={summary.count}
          total={rows.length}
          lifetimeCents={summary.lifetimeCents}
          balanceCents={summary.balanceCents}
          owing={summary.owing}
          sessionsRemaining={summary.sessionsRemaining}
          gapCount={summary.gapCount}
          statusBars={summary.statusBars}
        />

        <ClientsFilters
          rows={rows}
          state={state}
          onChange={onFiltersChange}
          anchorDate={anchorDate}
          families={families}
          tags={tags}
          resultCount={visible.length}
        />

        {/* ------------------------------------------------------ RESULT BAR */}
        <div className="clients-resultbar">
          <p className="clients-count" aria-live="polite">
            <span className="tabular clients-count-figure">{visible.length}</span>
            <span className="clients-count-of">of {rows.length} clients</span>
            {!isPristine(state) ? (
              <span className="clients-count-note">filtered</span>
            ) : null}
          </p>

          <div className="clients-resultbar-tools">
            {/* Column headers do the sorting on desktop; phones get this. */}
            <div className="clients-sortpicker">
              <label htmlFor="clients-sort-key" className="sr-only">
                Sort by
              </label>
              <select
                id="clients-sort-key"
                className="clients-select"
                value={state.sort}
                onChange={(event) =>
                  onSort(event.currentTarget.value as SortKey, state.dir)
                }
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="clients-dirtoggle"
                onClick={() => onSort(state.sort, state.dir === 'asc' ? 'desc' : 'asc')}
              >
                <span aria-hidden="true">{state.dir === 'asc' ? '↑' : '↓'}</span>
                <span className="sr-only">
                  {state.dir === 'asc'
                    ? 'Sorted ascending. Switch to descending.'
                    : 'Sorted descending. Switch to ascending.'}
                </span>
              </button>
            </div>

            <button
              type="button"
              className="clients-copy"
              onClick={() => void copyCsv()}
            >
              {copyState === 'copied'
                ? 'Copied'
                : copyState === 'failed'
                  ? 'Copy blocked'
                  : 'Copy as CSV'}
            </button>
          </div>
        </div>
        <p className="sr-only" role="status">
          {copyState === 'copied'
            ? `${visible.length} clients copied to the clipboard as CSV.`
            : copyState === 'failed'
              ? 'This browser blocked clipboard access. Nothing was copied.'
              : ''}
        </p>

        {/* ---------------------------------------------------------- ROSTER */}
        {visible.length > 0 ? (
          <div className="clients-roster" data-reveal>
            <ClientsTable
              rows={visible}
              sort={state.sort}
              dir={state.dir}
              onSort={onSort}
              onOpen={openClient}
              openId={selectedId}
            />
            <ClientsCards rows={visible} onOpen={openClient} openId={selectedId} />
          </div>
        ) : (
          <div className="clients-empty" data-reveal>
            <p className="tag text-gold-deep">No matches</p>
            <p className="display clients-empty-title">
              Nothing survives this combination.
            </p>
            {culprits.length ? (
              <>
                <p className="clients-empty-body">
                  Drop one of these and the roster comes back:
                </p>
                <ul className="clients-empty-list">
                  {culprits.map((culprit) => (
                    <li key={culprit.dimension}>
                      <span className="clients-empty-dim">{culprit.label}</span>
                      <span className="tabular clients-empty-count">
                        {culprit.wouldShow} would show
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="clients-empty-body">
                  Every filter above is narrowing at once. Remove a chip, or
                  clear them all and start again.
                </p>
              </>
            ) : (
              <p className="clients-empty-body">
                No single filter explains it — several are narrowing together.
                Clear them all and rebuild the view one facet at a time.
                {state.q.trim()
                  ? ` The search “${state.q.trim()}” requires every word to match.`
                  : ''}
              </p>
            )}
            <button
              type="button"
              className="clients-empty-reset"
              onClick={() =>
                commit(
                  {...EMPTY_FILTERS, sort: state.sort, dir: state.dir},
                  false,
                )
              }
            >
              Clear all filters
            </button>
            <p className="clients-empty-foot">
              Active: {activeLabels(state).join(' · ') || 'none'}
            </p>
          </div>
        )}
      </main>

      {selected ? (
        <ClientDetailSheet
          client={selected}
          sessions={selectedSessions}
          payments={selectedPayments}
          anchorDate={anchorDate}
          onClose={closeClient}
        />
      ) : null}
    </div>
  );
}

/** Human list of the dimensions currently narrowing the roster. */
function activeLabels(state: ClientFilterState): string[] {
  return activeDimensions(state).map((dimension) => DIMENSION_LABEL[dimension]);
}
