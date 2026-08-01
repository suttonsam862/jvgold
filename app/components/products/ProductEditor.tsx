/**
 * The editor sheet — add / edit / archive one product.
 *
 * A bottom sheet at 390px, a right-hand drawer from `md` up. It is a real
 * dialog: `role="dialog"` + `aria-modal`, focus moves in on open and returns
 * to whatever opened it on close, Escape closes, and Tab is kept inside.
 *
 * There is deliberately NO server action behind this. Submitting calls
 * `onSave` and the change lives in the page's reducer, because pretending to
 * write to a store that is not connected would be a lie the coach cannot see.
 */

import {useEffect, useId, useRef, useState} from 'react';
import {formatMoney} from '~/lib/ops/types';
import type {ProductCategory, ProductStatus} from '~/lib/ops/types';
import type {OfferingId} from '~/lib/offerings';
import {
  CATEGORY_OPTIONS,
  EMPTY_DRAFT,
  OFFERING_OPTIONS,
  STATUS_OPTIONS,
  firstErrorField,
  handleFromTitle,
  hasErrors,
  isSynced,
  parseDollars,
  parseTags,
  validateDraft,
} from './productsState';
import type {
  DraftErrors,
  DraftField,
  ManagedProduct,
  ProductDraft,
} from './productsState';

interface ProductEditorProps {
  /** The draft being edited. `null` closes the sheet. */
  draft: ProductDraft | null;
  /** Every product, for uniqueness checks on handle and SKU. */
  products: readonly ManagedProduct[];
  /** The record behind the draft, when editing an existing product. */
  original: ManagedProduct | null;
  onSave: (draft: ProductDraft) => void;
  onClose: () => void;
  onArchive: (id: string) => void;
}

export function ProductEditor({
  draft,
  products,
  original,
  onSave,
  onClose,
  onArchive,
}: ProductEditorProps) {
  const [values, setValues] = useState<ProductDraft>(draft ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitted, setSubmitted] = useState(false);
  /** Once the coach types a handle himself we stop deriving it from the title. */
  const [handleTouched, setHandleTouched] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();

  const open = draft !== null;
  const isNew = draft?.id === null;

  /* Reset the form whenever a different product is opened. */
  useEffect(() => {
    if (!draft) return;
    setValues(draft);
    setErrors({});
    setSubmitted(false);
    setHandleTouched(draft.handle.length > 0);
  }, [draft]);

  /* Open behaviour: remember focus, move into the sheet, lock the page. */
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => titleRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  /* Escape closes; Tab is trapped inside the sheet. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!draft) return null;

  function set<K extends DraftField>(field: K, value: ProductDraft[K]) {
    const next: ProductDraft = {...values, [field]: value};
    if (field === 'title' && !handleTouched) {
      next.handle = handleFromTitle(String(value));
    }
    setValues(next);
    // Once the form has been submitted once, re-check on every keystroke so an
    // error clears the moment it is fixed rather than on the next submit.
    if (submitted) setErrors(validateDraft(next, products));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateDraft(values, products);
    setErrors(found);
    setSubmitted(true);
    if (hasErrors(found)) {
      const field = firstErrorField(found);
      if (field && sheetRef.current) {
        const el = sheetRef.current.querySelector<HTMLElement>(
          `[data-field="${field}"]`,
        );
        el?.focus();
      }
      return;
    }
    onSave(values);
  }

  const priceCents = parseDollars(values.priceDollars).cents;
  const compareCents = parseDollars(values.compareAtDollars).cents;
  const tagPreview = parseTags(values.tags);
  const synced = original ? isSynced(original) : false;

  return (
    <div className="pm-overlay">
      {/* Scrim. A real button so it is reachable and announced, not a bare div. */}
      <button
        type="button"
        className="pm-scrim"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div
        className="pm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={sheetRef}
      >
        <header className="pm-sheet-head">
          <div>
            <p className="tag text-gold-deep">
              {isNew ? 'New product' : 'Edit product'}
            </p>
            <h2 id={headingId} className="display pm-sheet-title">
              {values.title.trim() || (isNew ? 'Untitled product' : draft.title)}
            </h2>
          </div>
          <button type="button" className="pm-close" onClick={onClose}>
            <span aria-hidden="true">Close</span>
            <span className="sr-only">Close editor</span>
          </button>
        </header>

        <p className="pm-sheet-sync">
          {synced
            ? `Synced · ${original?.shopifyProductId}`
            : 'Not synced — this product will be created in Shopify on connect.'}
        </p>

        <form className="pm-form" onSubmit={handleSubmit} noValidate>
          <Field
            field="title"
            label="Title"
            error={errors.title}
            hint="What the athlete sees on the booking page."
          >
            {(ids) => (
              <input
                {...ids}
                ref={titleRef}
                type="text"
                className="pm-input"
                value={values.title}
                onChange={(e) => set('title', e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>

          <Field
            field="handle"
            label="Handle"
            error={errors.handle}
            hint="The URL slug. Must match the Shopify handle exactly."
          >
            {(ids) => (
              <div className="pm-handle-wrap">
                <span className="pm-handle-prefix" aria-hidden="true">
                  /products/
                </span>
                <input
                  {...ids}
                  type="text"
                  className="pm-input pm-input-handle"
                  value={values.handle}
                  onChange={(e) => {
                    setHandleTouched(true);
                    set('handle', e.target.value);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
          </Field>

          <Field
            field="description"
            label="Description"
            error={errors.description}
            hint={`${values.description.trim().length} of 1,200 characters.`}
          >
            {(ids) => (
              <textarea
                {...ids}
                className="pm-input pm-textarea"
                rows={4}
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
              />
            )}
          </Field>

          <div className="pm-grid-2">
            <Field
              field="priceDollars"
              label="Price"
              error={errors.priceDollars}
              hint={
                priceCents !== null
                  ? `Stored as ${priceCents.toLocaleString('en-US')} cents.`
                  : 'In dollars — 200 or 89.50.'
              }
            >
              {(ids) => (
                <div className="pm-money-wrap">
                  <span className="pm-money-prefix" aria-hidden="true">
                    $
                  </span>
                  <input
                    {...ids}
                    type="text"
                    inputMode="decimal"
                    className="pm-input pm-input-money tabular"
                    value={values.priceDollars}
                    onChange={(e) => set('priceDollars', e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </Field>

            <Field
              field="compareAtDollars"
              label="Compare at"
              error={errors.compareAtDollars}
              hint={
                compareCents !== null && priceCents !== null && compareCents > priceCents
                  ? `Shows a ${formatMoney(compareCents - priceCents)} saving.`
                  : 'Optional — the struck-through old price.'
              }
            >
              {(ids) => (
                <div className="pm-money-wrap">
                  <span className="pm-money-prefix" aria-hidden="true">
                    $
                  </span>
                  <input
                    {...ids}
                    type="text"
                    inputMode="decimal"
                    className="pm-input pm-input-money tabular"
                    value={values.compareAtDollars}
                    onChange={(e) => set('compareAtDollars', e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </Field>
          </div>

          <div className="pm-grid-2">
            <Field
              field="sku"
              label="SKU"
              error={errors.sku}
              hint="Becomes the variant SKU in Shopify."
            >
              {(ids) => (
                <input
                  {...ids}
                  type="text"
                  className="pm-input tabular"
                  value={values.sku}
                  onChange={(e) => set('sku', e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </Field>

            <Field
              field="category"
              label="Category"
              error={errors.category}
              hint="Decides which fields matter on the row."
            >
              {(ids) => (
                <select
                  {...ids}
                  className="pm-input pm-select"
                  value={values.category}
                  onChange={(e) =>
                    set('category', e.target.value as ProductCategory)
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <fieldset className="pm-fieldset">
            <legend className="pm-label">Status</legend>
            <div className="pm-radios">
              {STATUS_OPTIONS.map((option) => (
                <label key={option.id} className="pm-radio">
                  <input
                    type="radio"
                    name="pm-status"
                    value={option.id}
                    checked={values.status === option.id}
                    onChange={() => set('status', option.id as ProductStatus)}
                  />
                  <span className="pm-radio-label">{option.label}</span>
                  <span className="pm-radio-hint">{option.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            field="offeringId"
            label="Attached offering"
            error={errors.offeringId}
            hint="Which bookable offering on /train this product sells."
          >
            {(ids) => (
              <select
                {...ids}
                className="pm-input pm-select"
                value={values.offeringId}
                onChange={(e) =>
                  set('offeringId', e.target.value as '' | OfferingId)
                }
              >
                <option value="">Not a bookable offering</option>
                {OFFERING_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.index} · {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            field="tags"
            label="Tags"
            error={errors.tags}
            hint="Comma separated. Used for Shopify collections on connect."
          >
            {(ids) => (
              <input
                {...ids}
                type="text"
                className="pm-input"
                value={values.tags}
                onChange={(e) => set('tags', e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>

          {tagPreview.length ? (
            <ul className="pm-tags pm-tags-preview">
              {tagPreview.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}

          <div className="pm-sheet-foot">
            <button type="submit" className="pm-primary">
              {isNew ? 'Add product' : 'Save changes'}
            </button>
            <button type="button" className="pm-ghost pm-ghost-lg" onClick={onClose}>
              Cancel
            </button>
            {!isNew && original && original.status !== 'archived' ? (
              <button
                type="button"
                className="pm-ghost pm-ghost-lg pm-danger"
                onClick={() => onArchive(original.id)}
              >
                Archive
              </button>
            ) : null}
          </div>

          <p className="pm-sheet-note">
            Saved changes are held in this browser only. Nothing is written to
            Shopify — the store is not linked yet.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ field */

interface FieldRenderIds {
  id: string;
  'aria-describedby': string;
  'aria-invalid'?: true;
  'data-field': DraftField;
}

interface FieldProps {
  field: DraftField;
  label: string;
  hint: string;
  error?: string;
  children: (ids: FieldRenderIds) => React.ReactNode;
}

/**
 * A labelled control with its hint and error wired to it. The error id is
 * always listed first in `aria-describedby` so a screen reader reads the
 * problem before the help text.
 */
function Field({field, label, hint, error, children}: FieldProps) {
  const base = useId();
  const id = `${base}-input`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const ids: FieldRenderIds = {
    id,
    'aria-describedby': error ? `${errorId} ${hintId}` : hintId,
    'data-field': field,
    ...(error ? {'aria-invalid': true as const} : {}),
  };

  return (
    <div className="pm-field" data-invalid={error ? 'true' : undefined}>
      <label className="pm-label" htmlFor={id}>
        {label}
      </label>
      {children(ids)}
      {error ? (
        <p className="pm-error" id={errorId}>
          {error}
        </p>
      ) : null}
      <p className="pm-hint" id={hintId}>
        {hint}
      </p>
    </div>
  );
}
