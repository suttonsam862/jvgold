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
 * DATA: HIS REAL ROSTER, imported from SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm
 * via `~/lib/ops/history`. This replaced the de-identified `~/lib/ops/seed`
 * preview that used to fill this screen with "Athlete 01".
 *
 * PRIVACY — READ BEFORE EDITING
 * These are real clients and several are minors. The route is coach-gated and,
 * in production, behind row-level security, which is what makes real names
 * correct here and nowhere else. Consequently:
 *   - `meta()` is a generic title plus `robots: noindex`. No name reaches the
 *     document head, a description, an OG image or a sitemap.
 *   - the URL carries FILTER STATE ONLY. The one identifying parameter is
 *     `?client=<slug>`, which the roster itself writes when a row is opened —
 *     never a name, an email or a phone number.
 *   - "Copy as CSV" writes to the clipboard on a deliberate click. It is an
 *     export of real people; it must never become an automatic upload.
 *   - nothing on this screen is passed to an analytics payload or a log line.
 *
 * WHAT HIS BOOK DOES NOT HAVE
 * No competitive level, no date of birth, no email, no school, no waiver
 * status. Those import as `null` and stay `null` — the Level facet and the Age
 * column are therefore empty for everyone, which is the honest render of a
 * column he has never filled in. Nothing here guesses.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Form, Link, useSearchParams} from 'react-router';
import {requireDemoRole} from '~/lib/demoAuth';
import type {DemoAuthContext} from '~/lib/demoAuth';
import {
  HISTORY_ANCHOR_DATE,
  HISTORY_CLIENTS,
  HISTORY_DATE_RANGE,
  HISTORY_IMPORT_REPORT,
  HISTORY_PAYMENTS,
  HISTORY_SESSIONS,
  historyMetaFor,
  type HistoryClient,
  type HistorySession,
} from '~/lib/ops/history';
import type {Client, ClientLevel} from '~/lib/ops/types';
import {ClientDetailSheet} from '~/components/clients/ClientDetailSheet';
import type {LedgerSession} from '~/components/clients/ClientDetailSheet';
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
import {Screen} from '~/components/ops/Screen';
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

/* ==========================================================================
 * HIS BOOK → THE ROSTER'S DOMAIN TYPES
 *
 * `~/lib/ops/history` deliberately exports WIDER types than the roster
 * components accept, because his spreadsheet genuinely does not know some of
 * what `Client` and `TrainingSession` require. Narrowing therefore happens
 * exactly once, here, in the open, with every substitution named. It is not a
 * `??  0` scattered through the JSX.
 *
 * Narrowing is the second choice, though. A gap the UI prints as fact belongs
 * in the component's own type, so the component can draw it as a gap — which
 * is why `session.kind` reaches the detail sheet still `null` rather than
 * wearing a stand-in word. Substitute only where the component has no way to
 * say "unknown".
 * ======================================================================== */

/**
 * His book has no competitive-level column, so `HistoryClient.level` is `null`
 * for all six. `ClientRow.level` is printed verbatim in the table, in the card
 * grid and inside the row's screen-reader label, so `null` would read as an
 * empty cell in one place and the literal word "null" in another.
 *
 * The blank is therefore carried as the words "Not recorded". The cast is
 * deliberate and local: it exists so the UI tells the truth about a column he
 * has never filled in, and this value never re-enters the domain layer or
 * Supabase. The Level facet still lists his four real levels and will count
 * zero against each — which is exactly right.
 */
const LEVEL_NOT_RECORDED = 'Not recorded' as ClientLevel;

/** Drop the import-provenance fields the roster does not model, name the gap. */
function toRosterClient(client: HistoryClient): Client {
  const {
    level: _level,
    sourceSheet: _sourceSheet,
    sourceName: _sourceName,
    packageTypeId: _packageTypeId,
    clubAffiliationRaw: _clubAffiliationRaw,
    sessionCount: _sessionCount,
    loggedSessionCount: _loggedSessionCount,
    paymentCount: _paymentCount,
    ...rest
  } = client;
  return {...rest, level: LEVEL_NOT_RECORDED};
}

/**
 * The detail sheet's ledger has one free-text line per session, and his book
 * has one free-text Notes column, so his note goes there verbatim, prefixed
 * with the Training Type EXACTLY as he typed it ('STRENGTH', 'DRILL',
 * '1-on-1 w Grey Oshiro (partner)') rather than the canonical label.
 *
 * `amountCents: null` means he never priced the row — not that it was free.
 * The sheet renders 0 as an em dash, which is the reading we want; the count of
 * unpriced rows is stated on the screen so the zero is never mistaken for a comp.
 *
 * The two gaps the sheet prints as fact — a blank Training Type cell on nine
 * rows and a missing clock on 25 — are handed over as themselves. `kind` stays
 * `null` and the clock is flagged, and `LedgerSession` renders each as an em
 * dash with the words behind it. Neither is patched into `focus` here: a
 * correction on the title line does not stop the line below it from lying.
 */
function toLedgerSession(session: HistorySession): LedgerSession {
  const meta = historyMetaFor(session.id);
  const rawType = meta?.rawTrainingType.trim() ?? '';

  return {
    ...session,
    amountCents: session.amountCents ?? 0,
    focus: [rawType === '' ? 'Type not recorded' : rawType, session.notes.trim()]
      .filter(Boolean)
      .join(' — '),
    // No provenance row means we cannot vouch for the clock either, so the
    // unknown id falls the same way a blank cell does: say nothing.
    startTimeRecorded: meta?.startTimeRecorded ?? false,
  };
}

const ROSTER_CLIENTS: readonly Client[] = HISTORY_CLIENTS.map(toRosterClient);
const LEDGER_SESSIONS: readonly LedgerSession[] =
  HISTORY_SESSIONS.map(toLedgerSession);

/** Rows he priced at all — the rest are blank, which is not the same as free. */
const UNPRICED_SESSIONS = HISTORY_SESSIONS.filter(
  (session) => session.amountCents === null,
).length;

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only — a /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');
  return {
    // The LAST dated row in his book, not today. Every "days since" figure on
    // this screen counts from here, so the server and the browser agree.
    anchorDate: HISTORY_ANCHOR_DATE,
    clients: ROSTER_CLIENTS,
    sessions: LEDGER_SESSIONS,
    payments: HISTORY_PAYMENTS,
  };
}

/* ==========================================================================
 * ACTION — connecting one client to Shopify
 *
 * The detail sheet's "Connect to Shopify" control posts here. It matches by
 * EMAIL, never by name: two families called Martinez are two customers, and a
 * name match would merge them.
 *
 * WHAT IT CANNOT DO, AND SAYS SO. This roster is read out of the imported
 * workbook, which is a constant in `~/lib/ops/history` and not a table anybody
 * can write to. So a match found here can be REPORTED but not PERSISTED, and
 * this action tells the coach that in words rather than flashing a success and
 * losing the id on the next navigation. When the roster is served out of
 * `jvgold.clients`, this is the one place that changes: the id gets written to
 * `shopify_customer_id` and the sentence goes away.
 *
 * The Admin token and the store domain are read off `context.env` here and go
 * no further — no token, no domain and no raw Shopify body is ever returned.
 * ======================================================================== */

const ADMIN_API_VERSION = '2026-04';

const ADMIN_TOKEN_KEYS = [
  'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_ACCESS_TOKEN',
  'PRIVATE_ADMIN_API_TOKEN',
] as const;

const CUSTOMER_SEARCH = `#graphql
  query JvGoldMatchCustomer($query: String!) {
    customers(first: 2, query: $query) {
      nodes { id email }
    }
  }
`;

export interface ConnectResult {
  ok: boolean;
  clientId: string;
  message: string;
}

export async function action({request, context}: Route.ActionArgs) {
  const auth = context as unknown as DemoAuthContext;
  requireDemoRole(auth, 'coach');

  const form = await request.formData();
  const clientId = String(form.get('clientId') ?? '');

  if (String(form.get('intent') ?? '') !== 'connect-shopify') {
    return {ok: false, clientId, message: 'Unknown request. Nothing changed.'};
  }

  const client = ROSTER_CLIENTS.find((entry) => entry.id === clientId) ?? null;
  if (!client) {
    return {ok: false, clientId, message: 'That client is not on the roster.'};
  }

  if (client.shopifyCustomerId) {
    return {
      ok: true,
      clientId,
      message: `Already connected to Shopify customer ${client.shopifyCustomerId}.`,
    };
  }

  if (!client.email) {
    // The real state of these six records: his workbook never had an email
    // column, and email is the only safe key to match a customer on.
    return {
      ok: false,
      clientId,
      message:
        'This record has no email address, and email is the only safe thing to match a Shopify customer on — matching by name would merge two different families. Add the athlete through the intake form, or add an email to this record first.',
    };
  }

  const env = auth.env as unknown as Record<string, string | undefined>;
  const domain = (env.PUBLIC_STORE_DOMAIN ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const tokenKey = ADMIN_TOKEN_KEYS.find((key) => (env[key] ?? '').trim());
  const token = tokenKey ? (env[tokenKey] ?? '').trim() : '';

  if (!domain || domain === 'mock.shop' || !token) {
    return {
      ok: false,
      clientId,
      message:
        'The store is not linked on this environment — PUBLIC_STORE_DOMAIN still points at mock.shop and no Admin API token is set. Nothing was looked up.',
    };
  }

  try {
    const response = await fetch(
      `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({
          query: CUSTOMER_SEARCH,
          variables: {query: `email:"${client.email.replace(/"/g, '')}"`},
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        clientId,
        message: `Shopify refused the lookup (HTTP ${response.status}). Nothing changed.`,
      };
    }

    const payload = (await response.json()) as {
      data?: {customers?: {nodes?: {id?: string}[]}};
      errors?: {message?: string}[];
    };
    if (payload.errors?.length) {
      return {
        ok: false,
        clientId,
        message: `Shopify rejected the lookup: ${payload.errors[0]?.message ?? 'unknown error'}`,
      };
    }

    const match = payload.data?.customers?.nodes?.[0]?.id ?? null;
    if (!match) {
      return {
        ok: false,
        clientId,
        message: `No Shopify customer exists for ${client.email}. Add the athlete through the intake form, which creates one.`,
      };
    }

    return {
      ok: true,
      clientId,
      message: `Found Shopify customer ${match}. It cannot be saved onto this record yet — the roster is read out of the imported workbook, not a table. Re-add through the intake form to store the link.`,
    };
  } catch {
    return {
      ok: false,
      clientId,
      message: 'Could not reach Shopify. Nothing changed.',
    };
  }
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

  /* Newest first — that is the order the detail sheet documents, and the last
     thing he did with an athlete is the thing he is looking for. */
  const selectedSessions = useMemo(() => {
    if (!selected) return [];
    return sessions
      .filter((session) => session.athleteIds.includes(selected.id))
      .slice()
      .sort((a, b) => (a.start > b.start ? -1 : a.start < b.start ? 1 : 0));
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

  /**
   * Intake, carrying the current filter state. `?client=` is dropped — a link
   * to "add somebody new" should not also try to reopen a detail sheet.
   */
  const newClientHref = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete(CLIENT_PARAM);
    const query = next.toString();
    return query ? `/private/clients/new?${query}` : '/private/clients/new';
  }, [searchParams]);

  return (
    /* `wide` is the 1560px measure — the only screen in the hub that gets it,
       because eleven columns of roster at 1440px start truncating names. The
       masthead, the notice and the skip link are <Screen>'s; `.clients-page`
       stays on the root as the scope every --cl-* token is declared on, and
       the detail sheet renders inside it so the sheet inherits them too. */
    <Screen
      rootClassName="clients-page"
      wide
      title="Clients"
      subtitle="Your real roster, filterable on anything. The view you are looking at is in the address bar — bookmark it."
      back={{to: '/private/dashboard', label: 'Management view'}}
      actions={
        <>
          {/* The filter state rides along, so cancelling intake lands him back
              on exactly the view he left rather than on an unfiltered roster. */}
          <Link to={newClientHref} className="tag ops-btn">
            Add athlete
          </Link>
          <Form method="post" action="/private/logout">
            <button type="submit" className="tag ops-btn ops-btn-quiet">
              Log Out
            </button>
          </Form>
        </>
      }
      notice={`Your book, imported from SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm — ${HISTORY_IMPORT_REPORT.clientCount} clients and ${HISTORY_IMPORT_REPORT.importedRowCount} session rows, ${HISTORY_DATE_RANGE.first} to ${HISTORY_DATE_RANGE.last}. Current to the last row in the book. Real names: this screen is coach-only.`}
    >
      <>
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

        {/* Why half the columns are empty. Without this the roster reads as
            broken rather than as an honest picture of a book that has never
            had these columns filled in. */}
        <p className="ops-mute mt-6 max-w-[80ch] text-[0.8125rem] leading-relaxed">
          Your workbook has no column for competitive level, date of birth,
          email, school or waiver status, so Level, Age and every compliance pip
          are blank for everyone — nothing here has been guessed. Status is
          derived from your Owed column: a positive balance reads Owes Balance,
          everyone else reads Active. Sessions used and remaining come straight
          off each client tab; {UNPRICED_SESSIONS} of{' '}
          {HISTORY_SESSIONS.length} session rows were never priced, and an
          unpriced row shows a dash rather than $0.
        </p>

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
            <p className="tag ops-accent">No matches</p>
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

        {selected ? (
          <ClientDetailSheet
            client={selected}
            sessions={selectedSessions}
            payments={selectedPayments}
            anchorDate={anchorDate}
            onClose={closeClient}
          />
        ) : null}
      </>
    </Screen>
  );
}

/** Human list of the dimensions currently narrowing the roster. */
function activeLabels(state: ClientFilterState): string[] {
  return activeDimensions(state).map((dimension) => DIMENSION_LABEL[dimension]);
}
