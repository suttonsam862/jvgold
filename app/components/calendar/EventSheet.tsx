/**
 * EVENT SHEET — bottom sheet on a phone, side panel from 768px.
 *
 * Three modes share one shell: `view` (detail), `edit`, `create`. The shell
 * traps focus, closes on Escape and on a scrim tap, and restores focus to
 * whatever opened it.
 *
 * WHAT THE SHEET SHOWS
 * --------------------
 * A JV Gold block is a SESSION, so `view` prints his book's columns — package,
 * training type, sessions used, paid, method, owed, stream — and where a value
 * was reached through an alias it prints his verbatim cell underneath. `edit`
 * and `create` are the same <SessionForm>, so there is exactly one way to enter
 * a session and one way to change it.
 *
 * An imported Google event Jesse has not claimed stays READ ONLY: it renders in
 * full and offers no edit control, because writing back before two-way sync
 * exists would silently diverge from the copy on his phone.
 *
 * HONESTY RULE: there is no backend. Saving writes to client state only and the
 * UI says so in words. Nothing here ever claims a server accepted anything.
 */

import {memo, useEffect, useId, useMemo, useRef} from 'react';
import type {CalendarEvent, IsoDate} from '~/lib/ops/types';
import {SessionForm} from './SessionForm';
import type {
  CalendarFormData,
  SessionDraft,
  SessionLog,
} from './sessionModel';
import {
  centsLabel,
  draftFromEvent,
  emptyDraft,
  logLines,
} from './sessionModel';
import {KIND_LABEL, longDate, minutesOf, rangeLabel, toneOf} from './layout';

export type SheetMode = 'view' | 'edit' | 'create';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* -------------------------------------------------------------------------- */

interface EventSheetProps {
  mode: SheetMode;
  event: CalendarEvent | null;
  /** The book row behind the event, when there is one. */
  log: SessionLog | null;
  /** Date a newly logged session lands on. */
  defaultDate: IsoDate;
  /** The browser's real date, read in an effect by the shell. */
  todayDate: IsoDate;
  data: CalendarFormData;
  /** True when this record only exists in this browser tab. */
  isLocal: boolean;
  onClose: () => void;
  onRequestEdit: () => void;
  onSave: (draft: SessionDraft) => void;
  onRemove: (id: string) => void;
}

export function EventSheet({
  mode,
  event,
  log,
  defaultDate,
  todayDate,
  data,
  isLocal,
  onClose,
  onRequestEdit,
  onSave,
  onRemove,
}: EventSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /* --- focus trap, Escape, scroll lock, focus restore ------------------- */
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Nothing is autofocused into a text field on purpose: on a phone that
    // raises the keyboard over the form the moment the sheet opens.
    const first =
      node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      // Clicking inert copy inside a dialog drops focus to <body>; pull it
      // back rather than letting Tab escape into the page behind.
      if (!node.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? lastEl : firstEl).focus();
      } else if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    // Listened for on the document, not the panel: Escape has to work even
    // when a click on non-focusable copy has parked focus on <body>.
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [onClose]);

  const initialDraft = useMemo<SessionDraft>(
    () =>
      mode === 'create' || !event
        ? emptyDraft(defaultDate)
        : draftFromEvent(event, log),
    [defaultDate, event, log, mode],
  );

  /**
   * READ-ONLY IS ENFORCED HERE, not just on the button that opens the form.
   *
   * An unclaimed Google event is a mirror of a row on Jesse's phone. Editing it
   * before two-way sync exists would silently diverge from that copy, so the
   * form is not reachable for one by ANY route — a stale `edit` mode, a
   * restored history entry, a future caller — and the detail view is shown
   * instead. The disabled button below is the courtesy; this is the rule.
   */
  const readOnly = mode !== 'create' && event?.readOnly === true;
  const showForm = mode === 'create' || (mode === 'edit' && !readOnly);

  const heading =
    mode === 'create'
      ? 'Log a lesson'
      : mode === 'edit' && !readOnly
        ? 'Edit lesson'
        : (event?.title ?? 'Event');

  return (
    <>
      <div className="cal-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="cal-sheet"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span className="cal-sheet-grab" aria-hidden="true" />
        <div className="cal-sheet-head">
          <div className="min-w-0">
            <p className="tag text-gold-deep">
              {readOnly
                ? 'Imported · read only'
                : mode === 'view'
                  ? 'Lesson'
                  : mode === 'edit'
                    ? 'Editing'
                    : 'New'}
            </p>
            <h2
              id={titleId}
              className="display mt-1 text-[1.0625rem] leading-tight"
            >
              {heading}
            </h2>
          </div>
          <button
            type="button"
            className="cal-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.25"
                fill="none"
              />
            </svg>
          </button>
        </div>

        {!showForm && event ? (
          <EventDetail
            event={event}
            log={log}
            data={data}
            isLocal={isLocal}
            onRequestEdit={onRequestEdit}
            onRemove={onRemove}
          />
        ) : (
          <SessionForm
            key={event?.id ?? 'new'}
            initial={initialDraft}
            data={data}
            todayDate={todayDate}
            focusedDate={defaultDate}
            isCreate={mode === 'create'}
            isLocal={isLocal}
            onSave={onSave}
            onCancel={onClose}
          />
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------
 * Detail
 * ------------------------------------------------------------------------ */

interface DetailProps {
  event: CalendarEvent;
  log: SessionLog | null;
  data: CalendarFormData;
  isLocal: boolean;
  onRequestEdit: () => void;
  onRemove: (id: string) => void;
}

const EventDetail = memo(function EventDetail({
  event,
  log,
  data,
  isLocal,
  onRequestEdit,
  onRemove,
}: DetailProps) {
  const clientName = useMemo(() => {
    const id = log?.clientId ?? event.athleteIds[0] ?? null;
    if (!id) return null;
    return data.clients.find((c) => c.id === id)?.name ?? null;
  }, [data.clients, event.athleteIds, log]);

  const lines = useMemo(() => (log ? logLines(log) : []), [log]);

  return (
    <>
      <div className="cal-sheet-body">
        <div className="flex items-center gap-2">
          <span
            className="cal-dot"
            data-tone={toneOf(event)}
            style={{width: 8, height: 8}}
            aria-hidden="true"
          />
          <span className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
            {event.source === 'google'
              ? event.claimed
                ? 'Google · claimed'
                : 'Google · read only'
              : `JV Gold${event.kind ? ` · ${KIND_LABEL[event.kind]}` : ''}`}
          </span>
        </div>

        {clientName ? (
          <p className="display mt-3 text-[1.0625rem] leading-tight">
            {clientName}
          </p>
        ) : null}

        <p className="cal-tabular mt-2 text-[0.9375rem]">
          {longDate(event.start.slice(0, 10))}
        </p>
        <p className="cal-tabular text-sm text-[color:var(--cal-dim)]">
          {/* An all-day JV Gold block is a session whose clock he never wrote
              down. It is never printed as "12:00 AM". */}
          {event.allDay
            ? event.source === 'jvgold'
              ? 'Time not recorded'
              : 'All day'
            : rangeLabel(minutesOf(event.start), minutesOf(event.end))}
        </p>

        {isLocal ? (
          <p className="cal-local mt-3">Saved on this device · not synced</p>
        ) : null}

        {lines.length > 0 ? (
          <dl className="mt-6 text-sm">
            {lines.map((line) => (
              <Row
                key={line.label}
                label={line.label}
                value={line.value}
                raw={line.raw}
                tabular={line.tabular}
              />
            ))}
          </dl>
        ) : null}

        <dl className={lines.length > 0 ? 'text-sm' : 'mt-6 text-sm'}>
          <Row label="Location" value={event.location ?? '—'} raw={null} />
          {lines.length === 0 ? (
            <Row
              label="Value"
              value={
                event.amountCents != null ? centsLabel(event.amountCents) : '—'
              }
              raw={null}
              tabular
            />
          ) : null}
          {event.recurrence ? (
            <Row label="Repeats" value={event.recurrence.label} raw={null} />
          ) : null}
          {event.attendees.length > 0 ? (
            <Row
              label="Attendees"
              value={event.attendees
                .map(
                  (a) =>
                    `${a.displayName}${
                      a.responseStatus === 'accepted'
                        ? ''
                        : ` (${a.responseStatus})`
                    }`,
                )
                .join(', ')}
              raw={null}
            />
          ) : null}
          {event.syncedAt ? (
            <Row
              label="Last pulled"
              value={`${event.syncedAt.slice(0, 10)} ${event.syncedAt.slice(
                11,
                16,
              )}`}
              raw={null}
              tabular
            />
          ) : null}
          <Row label="Notes" value={event.description || '—'} raw={null} />
        </dl>

        {event.readOnly ? (
          <p className="mt-6 border-t border-[color:var(--cal-line)] pt-4 text-xs leading-relaxed text-[color:var(--cal-dim)]">
            This event was imported from Google Calendar and is read-only.
            Two-way sync is not configured, so editing it here would silently
            diverge from the copy on your phone. Connect Google Calendar with
            write scope to edit it.
          </p>
        ) : null}
      </div>

      <div className="cal-sheet-foot">
        <button
          type="button"
          className="cal-primary"
          disabled={event.readOnly}
          onClick={onRequestEdit}
        >
          {event.readOnly ? 'Read only' : log ? 'Edit session' : 'Log as session'}
        </button>
        {event.readOnly ? null : (
          <button
            type="button"
            className="cal-ghost"
            onClick={() => onRemove(event.id)}
          >
            Delete
          </button>
        )}
      </div>
    </>
  );
});

function Row({
  label,
  value,
  raw,
  tabular = false,
}: {
  label: string;
  value: string;
  /** His verbatim cell, printed under the canonical label when they differ. */
  raw: string | null;
  tabular?: boolean;
}) {
  return (
    <div className="flex gap-4 border-b border-[color:var(--cal-line)] py-2.5">
      <dt className="w-24 flex-none text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
        {label}
      </dt>
      <dd className={`min-w-0 flex-1 break-words ${tabular ? 'cal-tabular' : ''}`}>
        {value}
        {raw ? (
          <span className="cal-raw mt-0.5 block">
            your book: “{raw}”
          </span>
        ) : null}
      </dd>
    </div>
  );
}
