/**
 * CALENDAR SHELL — state, navigation, gestures, keyboard.
 *
 * Holds the only mutable state on the page: the view mode, the cursor date,
 * the (locally edited) event list and the sheet. Everything below it is a
 * memoised presentational component, so paging a month re-renders the grid and
 * nothing else.
 *
 * DETERMINISM: the first render uses `anchorDate` for "today" and draws no now
 * line. The browser's real clock is read in an effect afterwards, which keeps
 * the server and client markup identical and avoids a hydration mismatch.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CalendarEvent,
  IntegrationStatus,
  IsoDate,
} from '~/lib/ops/types';
import {addDays} from '~/lib/ops/types';
import {ConnectPanel} from './ConnectPanel';
import {EventSheet} from './EventSheet';
import type {SheetMode} from './EventSheet';
import {MonthView} from './MonthView';
import {TimeGrid} from './TimeGrid';
import type {CalendarFormData, SessionDraft, SessionLog} from './sessionModel';
import {availabilityFromEvents, commitSession, emptyDraft} from './sessionModel';
import type {CalendarView} from './layout';
import {
  KIND_LABEL,
  addMonths,
  indexByDate,
  longDate,
  monthMatrix,
  monthTitle,
  startOfWeek,
  weekDates,
  weekTitle,
} from './layout';

const VIEWS: {id: CalendarView; label: string}[] = [
  {id: 'month', label: 'Month'},
  {id: 'week', label: 'Week'},
  {id: 'day', label: 'Day'},
];

/** Horizontal travel, in px, that counts as a page swipe. */
const SWIPE_PX = 56;

const TONE_LEGEND = [
  {tone: 'private', label: KIND_LABEL.private},
  {tone: 'clinic', label: KIND_LABEL.clinic},
  {tone: 'camp', label: KIND_LABEL.camp},
  {tone: 'group', label: KIND_LABEL.group},
  {tone: 'google', label: 'Google (read only)'},
];

interface CalendarShellProps {
  events: CalendarEvent[];
  /** His book's vocabulary for each event, keyed by event id. */
  sessionLogs: Record<string, SessionLog>;
  /** Everything the session form needs, derived from his history server-side. */
  formData: CalendarFormData;
  anchorDate: IsoDate;
  google: IntegrationStatus | null;
  googleCalendarId: string | null;
  connectMessage: string | null;
}

export function CalendarShell({
  events: seedEvents,
  sessionLogs,
  formData,
  anchorDate,
  google,
  googleCalendarId,
  connectMessage,
}: CalendarShellProps) {
  const [events, setEvents] = useState<CalendarEvent[]>(seedEvents);
  const [logs, setLogs] = useState<Record<string, SessionLog>>(sessionLogs);
  /** Ids touched in this tab — drives the "saved on this device" marker. */
  const [localIds, setLocalIds] = useState<string[]>([]);
  const [localSeq, setLocalSeq] = useState(1);

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState<IsoDate>(anchorDate);
  const [focusedDate, setFocusedDate] = useState<IsoDate>(anchorDate);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [paneKey, setPaneKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  /** Real clock, read only in the browser. */
  const [todayDate, setTodayDate] = useState<IsoDate>(anchorDate);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  const paneRef = useRef<HTMLDivElement>(null);
  /** Set by keyboard navigation only, so a re-render never steals focus. */
  const pendingFocus = useRef<IsoDate | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      setTodayDate(`${y}-${m}-${d}`);
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* --- derived ---------------------------------------------------------- */

  const index = useMemo(() => indexByDate(events), [events]);
  const monthKey = cursor.slice(0, 7);
  const cells = useMemo(() => monthMatrix(cursor), [cursor]);
  const week = useMemo(() => weekDates(startOfWeek(cursor)), [cursor]);
  const days = useMemo(() => (view === 'day' ? [cursor] : week), [view, cursor, week]);

  const title =
    view === 'month'
      ? monthTitle(cursor)
      : view === 'week'
        ? weekTitle(week[0])
        : longDate(cursor);

  const selectedEvent = useMemo(
    () => (selectedId ? (events.find((e) => e.id === selectedId) ?? null) : null),
    [events, selectedId],
  );

  /**
   * The form's data, with the availability recomputed off the LIVE event list.
   *
   * The loader's copy is what the first render uses, and it has to stay the
   * loader's copy or the server and the browser would disagree. But the moment
   * a lesson is logged in this tab it becomes a real conflict for the next one,
   * and a ruling computed from a list that is one save out of date would let
   * him double-book the same hour. `now` is carried across untouched — it is
   * the anchor, not a clock.
   */
  const formDataLive = useMemo<CalendarFormData>(
    () => ({
      ...formData,
      availability: availabilityFromEvents(
        events,
        formData.availability.googleConnected,
        formData.availability.now,
      ),
    }),
    [events, formData],
  );

  /* --- navigation ------------------------------------------------------- */

  const shift = useCallback(
    (delta: number) => {
      const next =
        view === 'month'
          ? addMonths(cursor, delta)
          : addDays(cursor, delta * (view === 'week' ? 7 : 1));
      setDirection(delta > 0 ? 'next' : 'prev');
      setPaneKey((k) => k + 1);
      setCursor(next);
      setFocusedDate(next);
    },
    [view, cursor],
  );

  const goToday = useCallback(() => {
    setDirection(todayDate >= cursor ? 'next' : 'prev');
    setPaneKey((k) => k + 1);
    setCursor(todayDate);
    setFocusedDate(todayDate);
  }, [todayDate, cursor]);

  const openDay = useCallback((date: IsoDate) => {
    setDirection('next');
    setPaneKey((k) => k + 1);
    setCursor(date);
    setFocusedDate(date);
    setView('day');
  }, []);

  const changeView = useCallback((next: CalendarView) => {
    setPaneKey((k) => k + 1);
    setView(next);
  }, []);

  /* --- keyboard (month grid) -------------------------------------------- */

  /** Move the focused day and remember to put real DOM focus on it. */
  const focusDate = useCallback(
    (next: IsoDate) => {
      setFocusedDate(next);
      // Stepping off the visible month pages the grid with it.
      if (next.slice(0, 7) !== cursor.slice(0, 7)) setCursor(next);
      pendingFocus.current = next;
    },
    [cursor],
  );

  const moveFocus = useCallback(
    (delta: number) => focusDate(addDays(focusedDate, delta)),
    [focusDate, focusedDate],
  );

  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-7);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(7);
          break;
        case 'Home':
          e.preventDefault();
          focusDate(startOfWeek(focusedDate));
          break;
        case 'End':
          e.preventDefault();
          focusDate(addDays(startOfWeek(focusedDate), 6));
          break;
        case 'PageUp':
          e.preventDefault();
          shift(-1);
          break;
        case 'PageDown':
          e.preventDefault();
          shift(1);
          break;
        default:
          break;
      }
    },
    [focusDate, focusedDate, moveFocus, shift],
  );

  // Move real DOM focus to the newly focused day cell, but only after a key
  // press — never on a plain re-render, which would steal focus from the sheet.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    paneRef.current
      ?.querySelector<HTMLElement>(`[data-date="${target}"]`)
      ?.focus();
  });

  /* --- touch (swipe to page) -------------------------------------------- */

  const touch = useRef<{x: number; y: number; valid: boolean} | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Multi-touch is a pinch/zoom, not a page swipe. Mouse input never fires
    // touch events at all, so desktop can't trip this handler.
    if (e.touches.length !== 1) {
      touch.current = null;
      return;
    }
    const t = e.touches[0];
    touch.current = {x: t.clientX, y: t.clientY, valid: true};
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touch.current;
    if (!start || e.touches.length !== 1) return;
    const t = e.touches[0];
    // Once the gesture is clearly vertical, let it scroll and stop watching.
    if (Math.abs(t.clientY - start.y) > Math.abs(t.clientX - start.x) * 1.4) {
      start.valid = false;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touch.current;
      touch.current = null;
      if (!start || !start.valid) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      shift(dx < 0 ? 1 : -1);
    },
    [shift],
  );

  /* --- sheet + local edits ---------------------------------------------- */

  const openEvent = useCallback((id: string) => {
    setSelectedId(id);
    setSheet('view');
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const openCreate = useCallback(() => {
    setSelectedId(null);
    setSheet('create');
  }, []);

  /**
   * Both writes on this page go through `commitSession` and nothing else. It
   * resolves against the browser today and says so; when Supabase lands, that
   * one function changes and everything here stays put.
   */
  const saveDraft = useCallback(
    (draft: SessionDraft) => {
      const existing = draft.id
        ? (events.find((e) => e.id === draft.id) ?? null)
        : null;
      const clientName =
        formData.clients.find((c) => c.id === draft.clientId)?.name ?? 'Session';
      const newId = `local-${localSeq}`;

      void commitSession({
        op: 'save',
        draft,
        existing,
        clientName,
        newId,
      }).then((result) => {
        if (!result.ok || !result.event) return;
        const saved = result.event;
        setEvents((prev) =>
          prev.some((e) => e.id === saved.id)
            ? prev.map((e) => (e.id === saved.id ? saved : e))
            : [...prev, saved],
        );
        if (result.log) {
          setLogs((prev) => ({...prev, [saved.id]: result.log as SessionLog}));
        }
        if (!existing) setLocalSeq((n) => n + 1);
        setLocalIds((prev) =>
          prev.includes(saved.id) ? prev : [...prev, saved.id],
        );
        setSelectedId(saved.id);
        setSheet('view');
      });
    },
    [events, formData.clients, localSeq],
  );

  const removeEvent = useCallback(
    (id: string) => {
      const existing = events.find((e) => e.id === id) ?? null;
      if (!existing) return;
      void commitSession({
        op: 'delete',
        draft: {...emptyDraft(existing.start.slice(0, 10)), id},
        existing,
        clientName: '',
        newId: id,
      }).then((result) => {
        if (!result.ok || !result.removedId) return;
        const removed = result.removedId;
        setEvents((prev) => prev.filter((event) => event.id !== removed));
        setLogs((prev) => {
          if (!(removed in prev)) return prev;
          const next = {...prev};
          delete next[removed];
          return next;
        });
        setLocalIds((prev) =>
          prev.includes(removed) ? prev : [...prev, removed],
        );
        setSelectedId(null);
        setSheet(null);
      });
    },
    [events],
  );

  const importedCount = useMemo(
    () => events.filter((e) => e.source === 'google').length,
    [events],
  );

  const dayCount = (index.get(focusedDate) ?? []).length;

  /* --- render ------------------------------------------------------------ */

  return (
    <div className="cal">
      <Toolbar
        title={title}
        view={view}
        onView={changeView}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={goToday}
      />

      <p className="sr-only" aria-live="polite">
        {title}. {view} view.
      </p>

      <div
        ref={paneRef}
        className="mt-4 select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onKeyDown={view === 'month' ? onGridKeyDown : undefined}
      >
        <div key={paneKey} className="cal-pane" data-dir={direction}>
          {view === 'month' ? (
            <MonthView
              cells={cells}
              monthKey={monthKey}
              index={index}
              todayDate={todayDate}
              focusedDate={focusedDate}
              onOpenDay={openDay}
            />
          ) : (
            <TimeGrid
              days={days}
              index={index}
              todayDate={todayDate}
              nowMinutes={nowMinutes}
              selectedId={selectedId}
              localIds={localIds}
              onSelectEvent={openEvent}
              onOpenDay={openDay}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-[color:var(--cal-line)] pt-4">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {TONE_LEGEND.map((item) => (
            <li
              key={item.tone}
              className="flex items-center gap-1.5 text-[0.5625rem] uppercase tracking-[0.18em] text-steel"
            >
              <span className="cal-dot" data-tone={item.tone} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <p className="cal-tabular text-[0.5625rem] uppercase tracking-[0.18em] text-steel">
          {focusedDate} · {dayCount === 1 ? '1 event' : `${dayCount} events`}
          {localIds.length > 0
            ? ` · ${localIds.length} saved on this device`
            : ''}
        </p>
      </div>

      <div className="mt-12">
        <ConnectPanel
          status={google}
          calendarId={googleCalendarId}
          importedCount={importedCount}
          message={connectMessage}
        />
      </div>

      <button
        type="button"
        className="cal-fab"
        onClick={openCreate}
        aria-label={`Log a session on ${longDate(focusedDate)}`}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 3v14M3 10h14"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>

      {sheet ? (
        <EventSheet
          mode={sheet}
          event={sheet === 'create' ? null : selectedEvent}
          log={
            sheet !== 'create' && selectedId ? (logs[selectedId] ?? null) : null
          }
          defaultDate={focusedDate}
          todayDate={todayDate}
          data={formDataLive}
          isLocal={selectedId ? localIds.includes(selectedId) : false}
          onClose={closeSheet}
          onRequestEdit={() => setSheet('edit')}
          onSave={saveDraft}
          onRemove={removeEvent}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Toolbar
 * ------------------------------------------------------------------------ */

interface ToolbarProps {
  title: string;
  view: CalendarView;
  onView: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const Toolbar = memo(function Toolbar({
  title,
  view,
  onView,
  onPrev,
  onNext,
  onToday,
}: ToolbarProps) {
  const activeIndex = VIEWS.findIndex((v) => v.id === view);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cal-icon-btn"
          onClick={onPrev}
          aria-label={`Previous ${view}`}
        >
          <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true">
            <path
              d="M8 1L2 7l6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </button>
        <button
          type="button"
          className="cal-icon-btn"
          onClick={onNext}
          aria-label={`Next ${view}`}
        >
          <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true">
            <path
              d="M1 1l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </svg>
        </button>
        <h1 className="display ml-1 text-[1.0625rem] leading-none sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="cal-text-btn" onClick={onToday}>
          Today
        </button>
        {/* A segmented switcher, not a tablist — there are no tab panels, so
            aria-pressed on real buttons is the honest mapping. */}
        <div className="cal-seg" role="group" aria-label="Calendar view">
          <span
            className="cal-seg-thumb"
            aria-hidden="true"
            style={{
              width: 'calc((100% - 6px) / 3)',
              transform: `translateX(calc(${activeIndex} * 100% + 3px))`,
            }}
          />
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="cal-seg-btn"
              aria-pressed={item.id === view}
              onClick={() => onView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
