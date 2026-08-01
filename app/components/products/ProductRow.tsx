/**
 * One catalogue row. Hairlines, not cards — the rule under the row is the only
 * chrome it gets. At 390px the row is two stacked bands (identity, then the
 * ledger strip); from `md` up it becomes a six-column grid that lines the
 * figures up down the page.
 */

import {Img} from '~/components/site/Img';
import {formatMoney} from '~/lib/ops/types';
import type {ProductStatus} from '~/lib/ops/types';
import type {ManagedProduct} from './productsState';
import {isSynced, offeringName} from './productsState';

/* ------------------------------------------------------------------ badges */

const STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
};

export function StatusDot({status}: {status: ProductStatus}) {
  return (
    <span className="pm-status" data-status={status}>
      <span className="pm-status-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The honest sync state. `shopifyProductId === null` is the whole signal —
 * there is no faked gid anywhere in this page.
 */
export function SyncBadge({
  product,
  compact = false,
}: {
  product: ManagedProduct;
  compact?: boolean;
}) {
  if (isSynced(product)) {
    return (
      <span className="pm-sync" data-sync="synced">
        <span className="pm-sync-mark" aria-hidden="true" />
        Synced
        <span className="tabular pm-sync-id">{product.shopifyProductId}</span>
      </span>
    );
  }
  return (
    <span className="pm-sync" data-sync="pending">
      <span className="pm-sync-mark" aria-hidden="true" />
      {compact ? (
        <>
          Not synced
          {/* The full sentence is always available to a screen reader; the row
              only has room for the short form. */}
          <span className="sr-only">
            {' '}
            — will be created in Shopify on connect
          </span>
        </>
      ) : (
        'Not synced — will be created in Shopify on connect'
      )}
    </span>
  );
}

/** Quiet marker for a change that exists only in this browser tab. */
export function LocalMarker({local}: {local: ManagedProduct['local']}) {
  if (!local) return null;
  return (
    <span className="pm-local">
      {local === 'new' ? 'Added here' : 'Edited here'} · not saved
    </span>
  );
}

/* -------------------------------------------------------------- image slot */

function Plate({product}: {product: ManagedProduct}) {
  const image = product.images[0];
  if (!image) {
    return (
      <span className="pm-plate pm-plate-empty" aria-hidden="true">
        <span className="pm-plate-glyph" />
      </span>
    );
  }
  return (
    <span className="pm-plate">
      <Img
        id={image.photoId}
        alt=""
        size="thumb"
        sizes="72px"
        className="pm-plate-img"
      />
    </span>
  );
}

/* --------------------------------------------------------------- the meter */

/**
 * Trailing-window revenue as a share of the best-selling product. A hairline,
 * not a bar chart — it reads as a ledger rule that happens to carry weight.
 */
function RevenueMeter({
  revenueCents,
  maxCents,
}: {
  revenueCents: number;
  maxCents: number;
}) {
  const share = maxCents > 0 ? Math.round((revenueCents / maxCents) * 100) : 0;
  return (
    <span
      className="pm-meter"
      role="img"
      aria-label={`${formatMoney(revenueCents)} trailing revenue`}
    >
      <span className="pm-meter-fill" style={{width: `${share}%`}} />
    </span>
  );
}

/* ----------------------------------------------------------------- the row */

interface ProductRowProps {
  product: ManagedProduct;
  selected: boolean;
  maxRevenueCents: number;
  onToggleSelect: (id: string) => void;
  onEdit: (product: ManagedProduct) => void;
  onQuickStatus: (id: string, status: ProductStatus) => void;
}

export function ProductRow({
  product,
  selected,
  maxRevenueCents,
  onToggleSelect,
  onEdit,
  onQuickStatus,
}: ProductRowProps) {
  const offering = offeringName(product.offeringId);
  const checkboxId = `pm-select-${product.id}`;
  const onSale =
    product.compareAtPriceCents !== null &&
    product.compareAtPriceCents > product.priceCents;

  return (
    <li className="pm-row" data-selected={selected ? 'true' : undefined}>
      <div className="pm-row-lead">
        <span className="pm-check">
          <input
            id={checkboxId}
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
          />
          <label htmlFor={checkboxId} className="sr-only">
            Select {product.title}
          </label>
        </span>

        <Plate product={product} />

        <div className="pm-identity">
          <button
            type="button"
            className="pm-title"
            onClick={() => onEdit(product)}
          >
            {product.title}
            <span className="sr-only"> — edit product</span>
          </button>
          <p className="pm-sub">
            <span className="tabular">{product.sku}</span>
            <span className="pm-dot" aria-hidden="true" />
            <span className="tabular">/{product.handle}</span>
            {offering ? (
              <>
                <span className="pm-dot" aria-hidden="true" />
                <span className="pm-offering">{offering}</span>
              </>
            ) : null}
          </p>
          {product.tags.length ? (
            <ul className="pm-tags">
              {product.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="pm-price-block">
          <p className="tabular pm-price">{formatMoney(product.priceCents)}</p>
          {onSale ? (
            <p className="tabular pm-compare">
              <span className="sr-only">Compare at </span>
              {formatMoney(product.compareAtPriceCents ?? 0)}
            </p>
          ) : null}
          {product.inventory !== null ? (
            <p className="tabular pm-inventory">
              {product.inventory} in stock
            </p>
          ) : (
            <p className="pm-inventory pm-inventory-untracked">
              Inventory not tracked
            </p>
          )}
        </div>
      </div>

      <div className="pm-row-meta">
        <div className="pm-meta-left">
          <StatusDot status={product.status} />
          <SyncBadge product={product} compact />
          <LocalMarker local={product.local} />
        </div>

        <div className="pm-meta-figures">
          <span className="tabular pm-figure">
            {product.unitsSold}
            <span className="pm-figure-label">sold</span>
          </span>
          <span className="tabular pm-figure">
            {formatMoney(product.revenueCents, {compact: true})}
            <span className="pm-figure-label">revenue</span>
          </span>
          <RevenueMeter
            revenueCents={product.revenueCents}
            maxCents={maxRevenueCents}
          />
        </div>

        <div className="pm-row-actions">
          <button
            type="button"
            className="pm-ghost"
            onClick={() => onEdit(product)}
          >
            Edit
          </button>
          {product.status === 'archived' ? (
            <button
              type="button"
              className="pm-ghost"
              onClick={() => onQuickStatus(product.id, 'active')}
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              className="pm-ghost"
              onClick={() => onQuickStatus(product.id, 'archived')}
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
