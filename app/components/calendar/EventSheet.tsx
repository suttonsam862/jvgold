/**
 * EVENT SHEET — bottom sheet on a phone, side panel from 768px.
 *
 * Three modes share one shell: `view` (detail), `edit`, `create`. The shell
 * traps focus, closes on Escape and on a scrim tap, and restores focus to
 * whatever opened it.
 *
 * HONESTY RULE: there is no backend. Saving writes to client state only, and
 * the UI says so in words — a "local preview" marker on the record and on the
 * submit button. Nothing here ever claims a server accepted anything.
 */

import {memo, useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import type {CalendarEvent, IsoDate, SessionKind} from '~/lib/ops/types';
import {formatMoney} from '~/lib/ops/types';
import type {RosterEntry} from './layout';
import {
  KIND_LABEL,
  inputTimeToMinutes,
  longDate,
  minutesOf,
  minutesToInputTime,
  rangeLabel,
  toneOf,
} from './layout';

export type SheetMode = 'view' | 'edit' | 'create';

/** The shape the form hands back. Times are `HH:MM`, dates `YYYY-MM-DD`. */
export interface EventDraft {
  id: string | null;
  title: string;
  date: IsoDate;
  startTime: string;
  endTime: string;
  allDay: boolean;
  kind: SessionKind;
  location: string;
  athleteIds: string[];
  notes: string;
}

const KINDS: SessionKind[] = [
  'private',
  'partner',
  'clinic',
  'workout',
  'camp',
  'group',
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function draftFrom(
  event: CalendarEvent | null,
  fallbackDate: IsoDate,
): EventDraft {
  if (!event) {
    return {
      id: null,
      title: '',
      date: fallbackDate,
      startTime: '16:00',
      endTime: '17:00',
      allDay: false,
      kind: 'private',
      location: 'Riverside Mat Room',
      athleteIds: [],
      notes: '',
    };
  }
  return {
    id: event.id,
    title: event.title,
    date: event.start.slice(0, 10),
    startTime: minutesToInputTime(minutesOf(event.start)),
    endTime: minutesToInputTime(minutesOf(event.end)),
    allDay: event.allDay,
    kind: event.kind ?? 'group',
    location: event.location ?? '',
    athleteIds: event.athleteIds,
    notes: event.description ?? '',
  };
}

/* -------------------------------------------------------------------------- */

interface EventSheetProps {
  mode: SheetMode;
  event: CalendarEvent | null;
  /** Date a newly created event lands on. */
  defaultDate: IsoDate;
  roster: RosterEntry[];
  /** True when this record only exists in this browser tab. */
  isLocal: boolean;
  onClose: () => void;
  onRequestEdit: () => void;
  onSave: (draft: EventDraft) => void;
  onRemove: (id: string) => void;
}

export function EventSheet({
  mode,
  event,
  defaultDate,
  roster,
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

  const heading =
    mode === 'create'
      ? 'New event'
      : mode === 'edit'
        ? 'Edit event'
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
              {mode === 'view' ? 'Event' : mode === 'edit' ? 'Editing' : 'Create'}
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

        {mode === 'view' && event ? (
          <EventDetail
            event={event}
            roster={roster}
            isLocal={isLocal}
            onRequestEdit={onRequestEdit}
            onRemove={onRemove}
            onClose={onClose}
          />
        ) : (
          <EventForm
            key={event?.id ?? 'new'}
            initial={draftFrom(event, defaultDate)}
            roster={roster}
            isCreate={mode === 'create'}
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
  roster: RosterEntry[];
  isLocal: boolean;
  onRequestEdit: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const EventDetail = memo(function EventDetail({
  event,
  roster,
  isLocal,
  onRequestEdit,
  onRemove,
}: DetailProps) {
  const names = useMemo(
    () =>
      event.athleteIds
        .map((id) => roster.find((r) => r.id === id)?.name ?? id)
        .join(', '),
    [event.athleteIds, roster],
  );

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

        <p className="cal-tabular mt-3 text-[0.9375rem]">
          {longDate(event.start.slice(0, 10))}
        </p>
        <p className="cal-tabular text-sm text-[color:var(--cal-dim)]">
          {event.allDay
            ? 'All day'
            : rangeLabel(minutesOf(event.start), minutesOf(event.end))}
        </p>

        {isLocal ? (
          <p className="cal-local mt-3">Local preview · not saved anywhere</p>
        ) : null}

        <dl className="mt-6 text-sm">
          <Row label="Location" value={event.location ?? '—'} />
          <Row label="Athletes" value={names || '—'} />
          <Row
            label="Value"
            value={
              event.amountCents != null ? formatMoney(event.amountCents) : '—'
            }
            tabular
          />
          {event.recurrence ? (
            <Row label="Repeats" value={event.recurrence.label} />
          ) : null}
          {event.attendees.length > 0 ? (
            <Row
              label="Attendees"
              value={event.attendees
                .map(
                  (a) =>
                    `${a.displayName}${
                      a.responseStatus === 'accepted' ? '' : ` (${a.responseStatus})`
                    }`,
                )
                .join(', ')}
            />
          ) : null}
          {event.syncedAt ? (
            <Row
              label="Last pulled"
              value={`${event.syncedAt.slice(0, 10)} ${event.syncedAt.slice(11, 16)}`}
              tabular
            />
          ) : null}
          <Row label="Notes" value={event.description || '—'} />
        </dl>

        {event.readOnly ? (
          <p className="mt-6 border-t border-[color:var(--cal-line)] pt-4 text-xs leading-relaxed text-[color:var(--cal-dim)]">
            This event was imported from Google Calendar and is read-only. Two-way
            sync is not configured, so editing it here would silently diverge from
            the copy on your phone. Connect Google Calendar with write scope to
            edit it.
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
          {event.readOnly ? 'Read only' : 'Edit'}
        </button>
        {event.readOnly ? null : (
          <button
            type="button"
            className="cal-ghost"
            onClick={() => onRemove(event.id)}
          >
            Remove
          </button>
        )}
      </div>
    </>
  );
});

function Row({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
}) {
  return (
    <div className="flex gap-4 border-b border-[color:var(--cal-line)] py-2.5">
      <dt className="w-24 flex-none text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
        {label}
      </dt>
      <dd className={`min-w-0 flex-1 break-words ${tabular ? 'cal-tabular' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Form
 * ------------------------------------------------------------------------ */

interface FormProps {
  initial: EventDraft;
  roster: RosterEntry[];
  isCreate: boolean;
  onSave: (draft: EventDraft) => void;
  onCancel: () => void;
}

function EventForm({initial, roster, isCreate, onSave, onCancel}: FormProps) {
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [errors, setErrors] = useState<{title?: string; time?: string}>({});
  const ids = useId();

  const set = useCallback(
    <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
      setDraft((d) => ({...d, [key]: value})),
    [],
  );

  const toggleAthlete = useCallback((id: string) => {
    setDraft((d) => ({
      ...d,
      athleteIds: d.athleteIds.includes(id)
        ? d.athleteIds.filter((a) => a !== id)
        : [...d.athleteIds, id],
    }));
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: {title?: string; time?: string} = {};
    if (!draft.title.trim()) next.title = 'Give the event a title.';
    if (!draft.allDay) {
      const start = inputTimeToMinutes(draft.startTime);
      const end = inputTimeToMinutes(draft.endTime);
      if (start == null || end == null) next.time = 'Enter a valid start and end time.';
      else if (end <= start) next.time = 'The end time has to be after the start.';
    }
    setErrors(next);
    if (next.title || next.time) return;
    onSave({...draft, title: draft.title.trim()});
  };

  return (
    <form onSubmit={submit} className="contents">
      <div className="cal-sheet-body">
        <label className="cal-field">
          <span className="cal-label">Title</span>
          <input
            data-autofocus
            className="cal-input"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids}-title-err` : undefined}
          />
          {errors.title ? (
            <span id={`${ids}-title-err`} className="cal-error" role="alert">
              {errors.title}
            </span>
          ) : null}
        </label>

        <label className="cal-field">
          <span className="cal-label">Date</span>
          <input
            type="date"
            className="cal-input"
            value={draft.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </label>

        <label className="mb-4 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
            style={{width: 18, height: 18, accentColor: '#c8a25b'}}
          />
          <span>All day</span>
        </label>

        {draft.allDay ? null : (
          <div className="flex gap-3">
            <label className="cal-field flex-1">
              <span className="cal-label">Start</span>
              <input
                type="time"
                className="cal-input"
                value={draft.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                aria-invalid={errors.time ? true : undefined}
                aria-describedby={errors.time ? `${ids}-time-err` : undefined}
              />
            </label>
            <label className="cal-field flex-1">
              <span className="cal-label">End</span>
              <input
                type="time"
                className="cal-input"
                value={draft.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                aria-invalid={errors.time ? true : undefined}
                aria-describedby={errors.time ? `${ids}-time-err` : undefined}
              />
            </label>
          </div>
        )}
        {errors.time ? (
          <p id={`${ids}-time-err`} className="cal-error -mt-2 mb-3" role="alert">
            {errors.time}
          </p>
        ) : null}

        <label className="cal-field">
          <span className="cal-label">Kind</span>
          <select
            className="cal-select"
            value={draft.kind}
            onChange={(e) => set('kind', e.target.value as SessionKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="cal-field">
          <span className="cal-label">Location</span>
          <input
            className="cal-input"
            value={draft.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </label>

        <fieldset className="cal-field">
          <legend className="cal-label">Athletes</legend>
          <div className="cal-pills">
            {roster.map((r) => (
              <button
                key={r.id}
                type="button"
                className="cal-pill"
                aria-pressed={draft.athleteIds.includes(r.id)}
                onClick={() => toggleAthlete(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="cal-field">
          <span className="cal-label">Notes</span>
          <textarea
            className="cal-textarea"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>

        <p className="cal-local">Saves to this browser only</p>
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--cal-dim)]">
          There is no calendar backend wired up yet. Changes stay in this tab as a
          preview and disappear on reload — nothing is written to Shopify, Supabase
          or Google.
        </p>
      </div>

      <div className="cal-sheet-foot">
        <button type="submit" className="cal-primary">
          {isCreate ? 'Add locally' : 'Update locally'}
        </button>
        <button type="button" className="cal-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
