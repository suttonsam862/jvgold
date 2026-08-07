/**
 * PRODUCT MANAGEMENT — /private/products
 *
 * Everything Jesse sells, in one dense ledger: the six bookable offerings from
 * `~/lib/offerings.ts`, the add-on catalogue, and a focused editor sheet for
 * adding, editing and archiving.
 *
 * WHY THERE IS NO ACTION EXPORT
 * -----------------------------
 * The Shopify store is not linked. A `POST` here could only write to memory
 * and then tell the coach his change was "saved", which is the one thing this
 * page must never do. Instead every mutation runs through the reducer in
 * `~/components/products/productsState`, and the UI says plainly — on the
 * page, on the row, and in the sheet — that the change is held in this browser
 * only. When the Admin API is wired up, each reducer case maps onto one
 * mutation (`productCreate`, `productUpdate`, `productVariantsBulkUpdate`) and
 * this component tree does not change.
 */

import {useMemo, useReducer, useState} from 'react';
import {requireDemoRole} from '~/lib/demoAuth';
import {ANCHOR_DATE, INTEGRATIONS, PRODUCTS} from '~/lib/ops/seed';
import {formatMoney} from '~/lib/ops/types';
import type {ProductStatus} from '~/lib/ops/types';
import {BulkBar, UndoNoticeBar} from '~/components/products/BulkBar';
import {
  ConnectPanel,
  OfferingCoveragePanel,
} from '~/components/products/ConnectPanel';
import {ProductEditor} from '~/components/products/ProductEditor';
import {ProductRow} from '~/components/products/ProductRow';
import {
  EMPTY_DRAFT,
  STATUS_FILTERS,
  coverageForOfferings,
  draftFromProduct,
  filterProducts,
  initProductsState,
  productsReducer,
  summarise,
} from '~/components/products/productsState';
import type {
  ManagedProduct,
  ProductDraft,
  StatusFilter,
} from '~/components/products/productsState';
import {Screen} from '~/components/ops/Screen';
import styles from '~/styles/products.css?url';
import type {Route} from './+types/private.products';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Products — JV Gold Management'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only — a /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');

  return {
    products: PRODUCTS,
    anchorDate: ANCHOR_DATE,
    shopify: INTEGRATIONS.find((i) => i.id === 'shopify') ?? null,
  };
}

export default function PrivateProducts({loaderData}: Route.ComponentProps) {
  const {products: seedProducts, anchorDate, shopify} = loaderData;

  const [state, dispatch] = useReducer(
    productsReducer,
    undefined,
    () => initProductsState(seedProducts, anchorDate),
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  const visible = useMemo(
    () => filterProducts(state.products, statusFilter, query),
    [state.products, statusFilter, query],
  );
  const summary = useMemo(() => summarise(state.products), [state.products]);
  const coverage = useMemo(
    () => coverageForOfferings(state.products),
    [state.products],
  );
  const maxRevenueCents = useMemo(
    () => state.products.reduce((max, p) => Math.max(max, p.revenueCents), 0),
    [state.products],
  );

  const visibleIds = visible.map((p) => p.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => state.selected.includes(id));

  const editingOriginal: ManagedProduct | null =
    draft?.id != null
      ? state.products.find((p) => p.id === draft.id) ?? null
      : null;

  /* ------------------------------------------------------------- handlers */

  function openNew() {
    setDraft({...EMPTY_DRAFT});
  }

  function openEdit(product: ManagedProduct) {
    setDraft(draftFromProduct(product));
  }

  function save(next: ProductDraft) {
    dispatch({type: 'save', draft: next});
    setDraft(null);
  }

  function quickStatus(id: string, status: ProductStatus) {
    dispatch({type: 'set-status', ids: [id], status});
  }

  function archiveFromSheet(id: string) {
    dispatch({type: 'set-status', ids: [id], status: 'archived'});
    setDraft(null);
  }

  return (
    /* The masthead, the measure and the "held in this browser" banner are
       <Screen>'s, not this route's. `.pm-page` stays on the root purely as the
       token scope — every --pm-* value the sheet, the rows and the editor read
       is declared on it, and the editor renders inside this element. */
    <Screen
      rootClassName="pm-page"
      eyebrow="Catalogue"
      title="Products"
      back={{to: '/private/dashboard', label: 'Management view'}}
      actions={
        <button type="button" className="pm-primary" onClick={openNew}>
          New product
        </button>
      }
      notice="Seed catalogue · Shopify not linked · changes held in this browser only"
    >
      <>
        {/* -------------------------------------------------------- figures */}
        <section className="pm-stats" data-reveal aria-label="Catalogue summary">
          <Stat
            label="In catalogue"
            value={String(summary.total)}
            sub={`${summary.active} active · ${summary.draft} draft · ${summary.archived} archived`}
          />
          <Stat
            label="Active price total"
            value={formatMoney(summary.activeValueCents)}
            sub="Sum of every active list price"
            accent
          />
          <Stat
            label="Trailing revenue"
            value={formatMoney(summary.revenueCents, {compact: true})}
            sub="Across the catalogue, seed figures"
          />
          <Stat
            label="Awaiting Shopify"
            value={String(summary.notSynced)}
            sub={
              summary.pendingLocal
                ? `${summary.pendingLocal} changed in this browser`
                : 'None synced — store not linked'
            }
          />
          <CompositionBar
            active={summary.active}
            draft={summary.draft}
            archived={summary.archived}
          />
        </section>

        {/* -------------------------------------------------------- toolbar */}
        <section className="pm-toolbar" aria-label="Filter products">
          <div className="pm-filters" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="pm-filter"
                aria-pressed={statusFilter === filter.id}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="pm-search">
            <label className="sr-only" htmlFor="pm-search-input">
              Search products by title, handle, SKU or tag
            </label>
            <input
              id="pm-search-input"
              className="pm-input pm-input-inline"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, SKU, tag…"
              autoComplete="off"
            />
          </div>
        </section>

        {state.notice ? (
          <UndoNoticeBar
            key={state.notice.key}
            message={state.notice.message}
            canUndo={state.undoStack !== null}
            onUndo={() => dispatch({type: 'undo'})}
            onDismiss={() => dispatch({type: 'dismiss-notice'})}
          />
        ) : null}

        <BulkBar
          count={state.selected.length}
          onSetStatus={(status) =>
            dispatch({type: 'set-status', ids: state.selected, status})
          }
          onAddTag={(tag) =>
            dispatch({type: 'add-tag', ids: state.selected, tag})
          }
          onClear={() => dispatch({type: 'clear-selection'})}
        />

        {/* ----------------------------------------------------------- list */}
        <section className="pm-list-section" aria-label="Product catalogue">
          <div className="pm-list-head">
            <span className="pm-check">
              <input
                id="pm-select-all"
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  dispatch({
                    type: 'select-many',
                    ids: allVisibleSelected ? [] : visibleIds,
                  })
                }
                disabled={visibleIds.length === 0}
              />
              <label htmlFor="pm-select-all" className="sr-only">
                Select all shown products
              </label>
            </span>
            <p className="pm-list-head-label">Product</p>
            <p className="tabular pm-list-head-meta">
              {visible.length} shown of {summary.total}
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="pm-empty">
              Nothing matches that filter. Clear the search or choose another
              status.
            </p>
          ) : (
            <ul className="pm-list">
              {visible.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  selected={state.selected.includes(product.id)}
                  maxRevenueCents={maxRevenueCents}
                  onToggleSelect={(id) => dispatch({type: 'toggle-select', id})}
                  onEdit={openEdit}
                  onQuickStatus={quickStatus}
                />
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------------------- lower panels */}
        <div className="pm-panels">
          <OfferingCoveragePanel rows={coverage} />
          <ConnectPanel
            notSynced={summary.notSynced}
            total={summary.total}
            shopify={shopify}
          />
        </div>

        <ProductEditor
          draft={draft}
          products={state.products}
          original={editingOriginal}
          onSave={save}
          onClose={() => setDraft(null)}
          onArchive={archiveFromSheet}
        />
      </>
    </Screen>
  );
}

/* ------------------------------------------------------------------ stats */

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="pm-stat">
      <p className="pm-stat-label">{label}</p>
      <p className={`display tabular pm-stat-value${accent ? ' pm-stat-accent' : ''}`}>
        {value}
      </p>
      <p className="pm-stat-sub">{sub}</p>
    </div>
  );
}

/**
 * Catalogue composition — a hand-rolled SVG hairline, no chart library. Three
 * segments on one 1px rule: active, draft, archived.
 */
function CompositionBar({
  active,
  draft,
  archived,
}: {
  active: number;
  draft: number;
  archived: number;
}) {
  const total = Math.max(active + draft + archived, 1);
  const w = (n: number) => (n / total) * 100;
  const activeW = w(active);
  const draftW = w(draft);
  const archivedW = w(archived);

  return (
    <div className="pm-composition">
      <p className="pm-stat-label">Composition</p>
      <svg
        className="pm-composition-svg"
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${active} active, ${draft} draft, ${archived} archived`}
      >
        <rect x="0" y="1" width="100" height="2" className="pm-seg-track" />
        <rect x="0" y="0" width={activeW} height="4" className="pm-seg-active" />
        <rect
          x={activeW}
          y="1"
          width={draftW}
          height="2"
          className="pm-seg-draft"
        />
        <rect
          x={activeW + draftW}
          y="1.5"
          width={archivedW}
          height="1"
          className="pm-seg-archived"
        />
      </svg>
      <ul className="pm-legend">
        <li>
          <span className="pm-legend-mark" data-seg="active" aria-hidden="true" />
          <span className="tabular">{active}</span> active
        </li>
        <li>
          <span className="pm-legend-mark" data-seg="draft" aria-hidden="true" />
          <span className="tabular">{draft}</span> draft
        </li>
        <li>
          <span className="pm-legend-mark" data-seg="archived" aria-hidden="true" />
          <span className="tabular">{archived}</span> archived
        </li>
      </ul>
    </div>
  );
}
