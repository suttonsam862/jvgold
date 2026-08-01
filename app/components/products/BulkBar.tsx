/**
 * Multi-select bar. Docks to the bottom of the viewport at 390px (thumb reach)
 * and sits inline under the toolbar from `md` up. Every control is a real
 * button at 44px, and every action it fires is reversible from the notice bar.
 */

import {useEffect, useRef, useState} from 'react';
import type {ProductStatus} from '~/lib/ops/types';

interface BulkBarProps {
  count: number;
  onSetStatus: (status: ProductStatus) => void;
  onAddTag: (tag: string) => void;
  onClear: () => void;
}

export function BulkBar({count, onSetStatus, onAddTag, onClear}: BulkBarProps) {
  const [tag, setTag] = useState('');
  const [tagging, setTagging] = useState(false);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  // Opening the tag field is a deliberate click, so moving focus into it is
  // expected rather than a hijack.
  useEffect(() => {
    if (tagging) tagInputRef.current?.focus();
  }, [tagging]);

  if (count === 0) return null;

  function submitTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = tag.trim();
    if (!value) return;
    onAddTag(value);
    setTag('');
    setTagging(false);
  }

  return (
    <div className="pm-bulk" role="group" aria-label="Bulk actions">
      <p className="pm-bulk-count">
        <span className="tabular pm-bulk-figure">{count}</span>
        <span>{count === 1 ? 'product selected' : 'products selected'}</span>
      </p>

      <div className="pm-bulk-actions">
        <button
          type="button"
          className="pm-ghost pm-ghost-lg"
          onClick={() => onSetStatus('active')}
        >
          Activate
        </button>
        <button
          type="button"
          className="pm-ghost pm-ghost-lg"
          onClick={() => onSetStatus('archived')}
        >
          Archive
        </button>

        {tagging ? (
          <form className="pm-bulk-tag" onSubmit={submitTag}>
            <label className="sr-only" htmlFor="pm-bulk-tag-input">
              Tag to add to the selected products
            </label>
            <input
              id="pm-bulk-tag-input"
              ref={tagInputRef}
              className="pm-input pm-input-inline"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tag name"
              autoComplete="off"
            />
            <button type="submit" className="pm-ghost pm-ghost-lg">
              Add tag
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="pm-ghost pm-ghost-lg"
            onClick={() => setTagging(true)}
          >
            Tag…
          </button>
        )}

        <button type="button" className="pm-ghost pm-ghost-lg" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ notice */

interface UndoNoticeBarProps {
  message: string;
  /** Undo is only offered while a snapshot exists to go back to. */
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoNoticeBar({
  message,
  canUndo,
  onUndo,
  onDismiss,
}: UndoNoticeBarProps) {
  return (
    <div className="pm-notice" role="status" aria-live="polite">
      <p className="pm-notice-text">{message}</p>
      <div className="pm-notice-actions">
        {canUndo ? (
          <button type="button" className="pm-ghost" onClick={onUndo}>
            Undo
          </button>
        ) : null}
        <button type="button" className="pm-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
