/**
 * PRODUCT MANAGEMENT — client-side state, validation and money parsing.
 *
 * The Shopify connector is DISCONNECTED. Nothing in here writes to a server:
 * every edit lives in a `useReducer` for the life of the tab, and the UI says
 * so out loud (see `LocalOnlyNotice` in the route). When the store is linked,
 * the reducer's cases become the shape of the Admin API mutations —
 * `productCreate`, `productUpdate`, `productVariantsBulkUpdate` — and the
 * component tree does not change.
 *
 * Money is INTEGER CENTS everywhere. Dollars exist only inside the editor's
 * text inputs; `parseDollars` is the single boundary that converts, and it
 * never touches a float (`'19.99'` → `19 * 100 + 99`, not `19.99 * 100`).
 */

import type {OfferingId} from '~/lib/offerings';
import {OFFERINGS} from '~/lib/offerings';
import type {
  IsoDate,
  Product,
  ProductCategory,
  ProductStatus,
  ProductVariant,
} from '~/lib/ops/types';
import {DEFAULT_CURRENCY} from '~/lib/ops/types';

/* ==========================================================================
 * 1. THE LOCAL RECORD
 * ======================================================================== */

/**
 * Local edit provenance, so the row can be quietly honest about what has
 * happened in this tab:
 *  - `null`   — exactly as it came from the loader.
 *  - `edited` — changed here; the change exists nowhere else.
 *  - `new`    — created here; it has never existed anywhere else.
 */
export type LocalState = null | 'edited' | 'new';

export interface ManagedProduct extends Product {
  local: LocalState;
}

export function toManaged(products: readonly Product[]): ManagedProduct[] {
  return products.map((p) => ({...p, local: null}));
}

/** Never synced while `shopifyProductId` is null — that null IS the state. */
export function isSynced(product: Product): boolean {
  return product.shopifyProductId !== null;
}

/* ==========================================================================
 * 2. MONEY AT THE INPUT BOUNDARY
 * ======================================================================== */

/** Cents → the string an editor input shows. `20000` → `'200.00'`. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface ParsedMoney {
  /** Integer cents, or null when the field was left empty. */
  cents: number | null;
  /** Human error, or null when the value is usable. */
  error: string | null;
}

/** Nobody sells a session for more than this; a typo is likelier than a sale. */
const MAX_CENTS = 100_000_00;

/**
 * Parse a dollars string typed by a human into integer cents.
 *
 * Accepts `$1,400`, `1400`, `1400.00`, ` 89.5 `. Rejects anything else rather
 * than silently coercing — `Number('12.3.4')` is NaN and `parseFloat('12abc')`
 * is 12, and both of those quietly become a wrong price.
 */
export function parseDollars(raw: string): ParsedMoney {
  const cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return {cents: null, error: null};

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return {
      cents: null,
      error: 'Enter a dollar amount, like 200 or 89.50.',
    };
  }

  const [whole, fraction = ''] = cleaned.split('.');
  // Integer arithmetic only. 89.50 → 8900 + 50, never 89.5 * 100.
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents)) {
    return {cents: null, error: 'That amount is too large.'};
  }
  if (cents > MAX_CENTS) {
    return {cents: null, error: 'Keep the price under $100,000.'};
  }
  return {cents, error: null};
}

/* ==========================================================================
 * 3. THE EDITOR DRAFT
 * ======================================================================== */

export interface ProductDraft {
  /** Null for a brand-new product. */
  id: string | null;
  title: string;
  handle: string;
  description: string;
  /** Dollars as typed. Converted to cents on save, never stored as a float. */
  priceDollars: string;
  compareAtDollars: string;
  sku: string;
  status: ProductStatus;
  category: ProductCategory;
  /** `''` means "not attached to a bookable offering" (merch, digital). */
  offeringId: '' | OfferingId;
  /** Comma-separated, split on save. */
  tags: string;
}

export type DraftField = keyof Omit<ProductDraft, 'id'>;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const EMPTY_DRAFT: ProductDraft = {
  id: null,
  title: '',
  handle: '',
  description: '',
  priceDollars: '',
  compareAtDollars: '',
  sku: '',
  status: 'draft',
  category: 'session',
  offeringId: '',
  tags: '',
};

export function draftFromProduct(product: Product): ProductDraft {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: product.description,
    priceDollars: centsToInput(product.priceCents),
    compareAtDollars: centsToInput(product.compareAtPriceCents),
    sku: product.sku,
    status: product.status,
    category: product.category,
    offeringId: product.offeringId ?? '',
    tags: product.tags.join(', '),
  };
}

/** Title → handle. Used only while the coach has not typed a handle himself. */
export function handleFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function parseTags(raw: string): string[] {
  const seen: string[] = [];
  for (const piece of raw.split(',')) {
    const tag = piece.trim().toLowerCase();
    if (tag && !seen.includes(tag)) seen.push(tag);
  }
  return seen;
}

const HANDLE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Real validation — every message is written to be read next to the field it
 * belongs to, and every one of them is wired up with `aria-describedby`.
 */
export function validateDraft(
  draft: ProductDraft,
  others: readonly ManagedProduct[],
): DraftErrors {
  const errors: DraftErrors = {};
  const rest = others.filter((p) => p.id !== draft.id);

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = 'Give the product a title.';
  } else if (title.length < 3) {
    errors.title = 'Titles are at least 3 characters.';
  } else if (title.length > 90) {
    errors.title = 'Keep the title under 90 characters.';
  }

  const handle = draft.handle.trim();
  if (handle.length === 0) {
    errors.handle = 'A handle is required — it becomes the Shopify URL.';
  } else if (!HANDLE_RE.test(handle)) {
    errors.handle = 'Lowercase letters, numbers and single hyphens only.';
  } else if (rest.some((p) => p.handle === handle)) {
    errors.handle = 'Another product already uses that handle.';
  }

  if (draft.description.trim().length > 1200) {
    errors.description = 'Keep the description under 1,200 characters.';
  }

  const price = parseDollars(draft.priceDollars);
  if (draft.priceDollars.trim() === '') {
    errors.priceDollars = 'A price is required.';
  } else if (price.error) {
    errors.priceDollars = price.error;
  } else if (price.cents === 0 && draft.status === 'active') {
    errors.priceDollars = 'An active product cannot be $0. Save it as a draft.';
  }

  const compare = parseDollars(draft.compareAtDollars);
  if (compare.error) {
    errors.compareAtDollars = compare.error;
  } else if (
    compare.cents !== null &&
    price.cents !== null &&
    compare.cents <= price.cents
  ) {
    errors.compareAtDollars =
      'Compare-at is the old price — it has to be higher than the price.';
  }

  const sku = draft.sku.trim();
  if (sku.length === 0) {
    errors.sku = 'A SKU is required to create the variant in Shopify.';
  } else if (!SKU_RE.test(sku)) {
    errors.sku = 'Letters, numbers, dot, dash and underscore only.';
  } else if (rest.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
    errors.sku = 'Another product already uses that SKU.';
  }

  if (parseTags(draft.tags).length > 12) {
    errors.tags = 'Twelve tags is plenty — trim the list.';
  }

  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** First field with an error, in visual order — what we focus on submit. */
export const FIELD_ORDER: DraftField[] = [
  'title',
  'handle',
  'description',
  'priceDollars',
  'compareAtDollars',
  'sku',
  'status',
  'category',
  'offeringId',
  'tags',
];

export function firstErrorField(errors: DraftErrors): DraftField | null {
  return FIELD_ORDER.find((f) => errors[f]) ?? null;
}

/* ==========================================================================
 * 4. REDUCER
 * ======================================================================== */

export interface UndoNotice {
  /** "3 products archived" — already pluralised. */
  message: string;
  /** Bumped on every notice so the live region re-announces identical text. */
  key: number;
}

export interface ProductsState {
  products: ManagedProduct[];
  /** Ids of the rows currently multi-selected. */
  selected: string[];
  /** Single-step undo: the product list as it was before the last mutation. */
  undoStack: ManagedProduct[] | null;
  notice: UndoNotice | null;
  /** Deterministic id counter for locally-created products. Never random. */
  seq: number;
  /** The dataset's anchor date — used for createdAt/updatedAt, never Date.now. */
  anchorDate: IsoDate;
}

export type ProductsAction =
  | {type: 'save'; draft: ProductDraft}
  | {type: 'set-status'; ids: string[]; status: ProductStatus}
  | {type: 'add-tag'; ids: string[]; tag: string}
  | {type: 'toggle-select'; id: string}
  | {type: 'select-many'; ids: string[]}
  | {type: 'clear-selection'}
  | {type: 'undo'}
  | {type: 'dismiss-notice'};

export function initProductsState(
  products: readonly Product[],
  anchorDate: IsoDate,
): ProductsState {
  return {
    products: toManaged(products),
    selected: [],
    undoStack: null,
    notice: null,
    seq: 1,
    anchorDate,
  };
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const STATUS_VERB: Record<ProductStatus, string> = {
  active: 'activated',
  draft: 'moved to draft',
  archived: 'archived',
};

/**
 * Apply a saved draft on top of a product, keeping every field the editor
 * does not own (variants beyond the first, images, trailing stats, Shopify
 * ids) exactly as it was.
 */
function applyDraft(
  product: ManagedProduct,
  draft: ProductDraft,
  anchorDate: IsoDate,
): ManagedProduct {
  const priceCents = parseDollars(draft.priceDollars).cents ?? 0;
  const compareAtPriceCents = parseDollars(draft.compareAtDollars).cents;
  const sku = draft.sku.trim();

  const variants: ProductVariant[] = product.variants.length
    ? product.variants.map((v, i) =>
        i === 0 ? {...v, priceCents, compareAtPriceCents, sku} : v,
      )
    : [defaultVariant(product.id, sku, priceCents, compareAtPriceCents)];

  return {
    ...product,
    title: draft.title.trim(),
    handle: draft.handle.trim(),
    description: draft.description.trim(),
    status: draft.status,
    category: draft.category,
    offeringId: draft.offeringId === '' ? null : draft.offeringId,
    priceCents,
    compareAtPriceCents,
    sku,
    tags: parseTags(draft.tags),
    variants,
    updatedAt: anchorDate,
    local: product.local === 'new' ? 'new' : 'edited',
  };
}

function defaultVariant(
  productId: string,
  sku: string,
  priceCents: number,
  compareAtPriceCents: number | null,
): ProductVariant {
  return {
    id: `${productId}-default`,
    title: 'Default',
    sku,
    priceCents,
    compareAtPriceCents,
    currency: DEFAULT_CURRENCY,
    inventoryQuantity: null,
    inventoryPolicy: 'continue',
    shopifyVariantId: null,
  };
}

function blankProduct(
  id: string,
  anchorDate: IsoDate,
  offeringId: OfferingId | null,
): ManagedProduct {
  const offering = OFFERINGS.find((o) => o.id === offeringId) ?? null;
  return {
    id,
    title: '',
    handle: '',
    description: '',
    status: 'draft',
    category: 'session',
    offeringId,
    priceCents: 0,
    compareAtPriceCents: null,
    currency: DEFAULT_CURRENCY,
    sku: '',
    inventory: null,
    variants: [],
    // A locally-created product has no art yet; the row draws an empty plate.
    images: offering ? [{photoId: offering.photoId, altText: offering.name}] : [],
    tags: [],
    vendor: 'JV Gold',
    productType: '',
    shopifyProductId: null,
    shopifyVariantId: null,
    unitsSold: 0,
    revenueCents: 0,
    conversionRate: 0,
    createdAt: anchorDate,
    updatedAt: anchorDate,
    local: 'new',
  };
}

export function productsReducer(
  state: ProductsState,
  action: ProductsAction,
): ProductsState {
  switch (action.type) {
    case 'save': {
      const {draft} = action;
      const snapshot = state.products;

      if (draft.id === null) {
        const id = `local-${state.seq}`;
        const created = applyDraft(
          blankProduct(
            id,
            state.anchorDate,
            draft.offeringId === '' ? null : draft.offeringId,
          ),
          draft,
          state.anchorDate,
        );
        return {
          ...state,
          products: [created, ...snapshot],
          seq: state.seq + 1,
          undoStack: snapshot,
          notice: {
            message: `“${created.title}” added — held in this browser only`,
            key: state.seq + 1,
          },
        };
      }

      const products = snapshot.map((p) =>
        p.id === draft.id ? applyDraft(p, draft, state.anchorDate) : p,
      );
      return {
        ...state,
        products,
        undoStack: snapshot,
        notice: {
          message: `“${draft.title.trim()}” updated — held in this browser only`,
          key: state.seq + 1,
        },
        seq: state.seq + 1,
      };
    }

    case 'set-status': {
      if (action.ids.length === 0) return state;
      const snapshot = state.products;
      const products = snapshot.map((p) =>
        action.ids.includes(p.id) && p.status !== action.status
          ? {
              ...p,
              status: action.status,
              updatedAt: state.anchorDate,
              local: p.local === 'new' ? 'new' : ('edited' as LocalState),
            }
          : p,
      );
      return {
        ...state,
        products,
        selected: [],
        undoStack: snapshot,
        notice: {
          message: `${plural(action.ids.length, 'product', 'products')} ${STATUS_VERB[action.status]}`,
          key: state.seq + 1,
        },
        seq: state.seq + 1,
      };
    }

    case 'add-tag': {
      const tag = action.tag.trim().toLowerCase();
      if (!tag || action.ids.length === 0) return state;
      const snapshot = state.products;
      const products = snapshot.map((p) =>
        action.ids.includes(p.id) && !p.tags.includes(tag)
          ? {
              ...p,
              tags: [...p.tags, tag],
              updatedAt: state.anchorDate,
              local: p.local === 'new' ? 'new' : ('edited' as LocalState),
            }
          : p,
      );
      return {
        ...state,
        products,
        selected: [],
        undoStack: snapshot,
        notice: {
          message: `Tagged ${plural(action.ids.length, 'product', 'products')} “${tag}”`,
          key: state.seq + 1,
        },
        seq: state.seq + 1,
      };
    }

    case 'toggle-select': {
      const selected = state.selected.includes(action.id)
        ? state.selected.filter((id) => id !== action.id)
        : [...state.selected, action.id];
      return {...state, selected};
    }

    case 'select-many':
      return {...state, selected: action.ids};

    case 'clear-selection':
      return {...state, selected: []};

    case 'undo': {
      if (!state.undoStack) return state;
      return {
        ...state,
        products: state.undoStack,
        undoStack: null,
        selected: [],
        notice: {message: 'Change undone', key: state.seq + 1},
        seq: state.seq + 1,
      };
    }

    case 'dismiss-notice':
      return {...state, notice: null};

    default:
      return state;
  }
}

/* ==========================================================================
 * 5. DERIVED VIEWS
 * ======================================================================== */

export type StatusFilter = 'all' | ProductStatus;

export const STATUS_FILTERS: {id: StatusFilter; label: string}[] = [
  {id: 'all', label: 'All'},
  {id: 'active', label: 'Active'},
  {id: 'draft', label: 'Draft'},
  {id: 'archived', label: 'Archived'},
];

export const CATEGORY_OPTIONS: {id: ProductCategory; label: string}[] = [
  {id: 'session', label: 'Session'},
  {id: 'package', label: 'Package'},
  {id: 'camp', label: 'Camp'},
  {id: 'clinic', label: 'Clinic'},
  {id: 'apparel', label: 'Apparel'},
  {id: 'gear', label: 'Gear'},
  {id: 'digital', label: 'Digital'},
];

export const STATUS_OPTIONS: {id: ProductStatus; label: string; hint: string}[] =
  [
    {id: 'active', label: 'Active', hint: 'Sellable the moment the store links'},
    {id: 'draft', label: 'Draft', hint: 'Held back — created but not published'},
    {id: 'archived', label: 'Archived', hint: 'Off the catalogue, history kept'},
  ];

/** The six real bookable offerings, as select options. */
export const OFFERING_OPTIONS: {id: OfferingId; label: string; index: string}[] =
  OFFERINGS.map((o) => ({id: o.id, label: o.name, index: o.index}));

export function offeringName(id: OfferingId | null): string | null {
  if (!id) return null;
  return OFFERINGS.find((o) => o.id === id)?.name ?? null;
}

export function filterProducts(
  products: readonly ManagedProduct[],
  status: StatusFilter,
  query: string,
): ManagedProduct[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    if (status !== 'all' && p.status !== status) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.handle.includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q))
    );
  });
}

export interface CatalogueSummary {
  total: number;
  active: number;
  draft: number;
  archived: number;
  notSynced: number;
  /** Sum of every active product's price, in cents. */
  activeValueCents: number;
  /** Trailing-window revenue across the catalogue, in cents. */
  revenueCents: number;
  /** Locally-changed rows — what would be pushed on connect. */
  pendingLocal: number;
}

export function summarise(
  products: readonly ManagedProduct[],
): CatalogueSummary {
  let active = 0;
  let draft = 0;
  let archived = 0;
  let notSynced = 0;
  let activeValueCents = 0;
  let revenueCents = 0;
  let pendingLocal = 0;

  for (const p of products) {
    if (p.status === 'active') {
      active += 1;
      activeValueCents += p.priceCents;
    }
    if (p.status === 'draft') draft += 1;
    if (p.status === 'archived') archived += 1;
    if (!isSynced(p)) notSynced += 1;
    if (p.local !== null) pendingLocal += 1;
    revenueCents += p.revenueCents;
  }

  return {
    total: products.length,
    active,
    draft,
    archived,
    notSynced,
    activeValueCents,
    revenueCents,
    pendingLocal,
  };
}

/** How each of the six offerings is covered by the catalogue. */
export interface OfferingCoverage {
  offeringId: OfferingId;
  index: string;
  name: string;
  /** What /train advertises, e.g. "$200 per hour". */
  advertised: string;
  productId: string | null;
  productTitle: string | null;
  productStatus: ProductStatus | null;
  priceCents: number | null;
  synced: boolean;
}

export function coverageForOfferings(
  products: readonly ManagedProduct[],
): OfferingCoverage[] {
  return OFFERINGS.map((offering) => {
    const match =
      products.find(
        (p) => p.offeringId === offering.id && p.status !== 'archived',
      ) ?? products.find((p) => p.offeringId === offering.id) ?? null;
    return {
      offeringId: offering.id,
      index: offering.index,
      name: offering.name,
      advertised: `${offering.priceFrom} ${offering.priceUnit}`,
      productId: match?.id ?? null,
      productTitle: match?.title ?? null,
      productStatus: match?.status ?? null,
      priceCents: match?.priceCents ?? null,
      synced: match ? isSynced(match) : false,
    };
  });
}
