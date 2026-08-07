/**
 * TIME GRID — the Week and Day views.
 *
 * One scrolling body, an hour gutter, N day columns, a live "now" line, and
 * real column packing so overlapping sessions sit beside each other. Week and
 * Day are the same component with a different `days` array; there is no second
 * implementation to drift.
 *
 * All-day and multi-day events never enter the packer — they live in a fixed
 * rail above the scroller, exactly where Google puts them.
 */

import {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import type {CalendarEvent, IsoDate} from '~/lib/ops/types';
import {weekdayOfIso} from '~/lib/ops/types';
import type {PositionedEvent} from './layout';
import {
  GRID_SCROLL_HOUR,
  MINUTES_IN_DAY,
  WEEKDAY_NARROW,
  WEEKDAY_SHORT,
  formatMinutes,
  hourLabel,
  longDate,
  packDay,
  rangeLabel,
  toneOf,
} from './layout';

const HOURS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23,
];

const EMPTY: CalendarEvent[] = [];

/* -------------------------------------------------------------------------- */

interface BlockProps {
  placed: PositionedEvent;
  selected: boolean;
  locallyEdited: boolean;
  onSelect: (id: string) => void;
}

const Block = memo(function Block({
  placed,
  selected,
  locallyEdited,
  onSelect,
}: BlockProps) {
  const {event, startMin, endMin} = placed;
  const short = endMin - startMin <= 45;
  return (
    <button
      type="button"
      className="cal-block"
      data-tone={toneOf(event)}
      data-readonly={event.readOnly || undefined}
      data-selected={selected || undefined}
      data-short={short || undefined}
      style={{
        top: `${placed.topPct}%`,
        height: `${placed.heightPct}%`,
        left: `calc(${placed.leftPct}% + 1px)`,
        width: `calc(${placed.widthPct}% - 3px)`,
      }}
      aria-label={`${event.title}, ${rangeLabel(startMin, endMin)}${
        event.readOnly ? ', imported from Google Calendar, read only' : ''
      }${locallyEdited ? ', local preview' : ''}`}
      onClick={() => onSelect(event.id)}
    >
      <span className="cal-block-title">
        {locallyEdited ? '· ' : ''}
        {event.title}
      </span>
      <span className="cal-block-meta cal-tabular">
        {formatMinutes(startMin)}
        {short ? '' : ` – ${formatMinutes(endMin)}`}
      </span>
    </button>
  );
});

/* -------------------------------------------------------------------------- */

interface TimeGridProps {
  days: IsoDate[];
  index: Map<IsoDate, CalendarEvent[]>;
  todayDate: IsoDate | null;
  /** Minutes past midnight in the viewer's browser, or null before hydration. */
  nowMinutes: number | null;
  selectedId: string | null;
  localIds: readonly string[];
  onSelectEvent: (id: string) => void;
  onOpenDay: (date: IsoDate) => void;
}

export const TimeGrid = memo(function TimeGrid({
  days,
  index,
  todayDate,
  nowMinutes,
  selectedId,
  localIds,
  onSelectEvent,
  onOpenDay,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  /** Pack every visible day once per (days, events) change — never per paint. */
  const columns = useMemo(
    () =>
      days.map((date) => {
        const all = index.get(date) ?? EMPTY;
        return {
          date,
          placed: packDay(all, date),
          allDay: all.filter((e) => e.allDay),
        };
      }),
    [days, index],
  );

  const hasAllDay = columns.some((c) => c.allDay.length > 0);

  // Open on the working day rather than at midnight. Runs once per mount; the
  // hour height differs between breakpoints, so it is measured, not assumed.
  useEffect(() => {
    if (scrolled.current) return;
    const node = scrollRef.current;
    if (!node) return;
    const gutter = node.querySelector<HTMLElement>('.cal-gutter');
    const hourPx = gutter ? gutter.clientHeight / 24 : 56;
    // Centre on the current hour when today is on screen, otherwise open on
    // the working day. Never a blank 3am.
    const showsToday = todayDate != null && days.includes(todayDate);
    const target =
      showsToday && nowMinutes != null
        ? nowMinutes / 60 - 1.5
        : GRID_SCROLL_HOUR;
    node.scrollTop = Math.max(0, target * hourPx);
    scrolled.current = true;
  }, [nowMinutes, days, todayDate]);

  const handleSelect = useCallback(
    (id: string) => onSelectEvent(id),
    [onSelectEvent],
  );

  const cols = {'--cal-cols': days.length} as React.CSSProperties;

  return (
    <div>
      <div className="cal-timehead" style={cols}>
        <span aria-hidden="true" />
        {days.map((date) => {
          const dow = weekdayOfIso(date);
          return (
            <button
              key={date}
              type="button"
              className="cal-timehead-day"
              data-today={date === todayDate || undefined}
              data-selected={days.length === 1 || undefined}
              aria-label={`Open ${longDate(date)}`}
              onClick={() => onOpenDay(date)}
            >
              <span className="cal-timehead-dow" aria-hidden="true">
                {days.length > 5 ? WEEKDAY_NARROW[dow] : WEEKDAY_SHORT[dow]}
              </span>
              <span className="cal-timehead-num cal-tabular" aria-hidden="true">
                {Number(date.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      {hasAllDay ? (
        <div className="cal-allday" style={cols}>
          <span className="cal-allday-label">All day</span>
          {columns.map((col) => (
            <div key={col.date} className="cal-allday-cell">
              {col.allDay.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="cal-chip cal-allday-chip"
                  data-tone={toneOf(event)}
                  data-readonly={event.readOnly || undefined}
                  onClick={() => handleSelect(event.id)}
                >
                  <span className="cal-chip-title">{event.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="cal-scroll" ref={scrollRef}>
        <div className="cal-body" style={cols}>
          <div className="cal-gutter" aria-hidden="true">
            {HOURS.map((h) => (
              <span
                key={h}
                className="cal-gutter-label"
                style={{top: `${(h / 24) * 100}%`}}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {columns.map((col) => {
            const isToday = col.date === todayDate;
            const dow = weekdayOfIso(col.date);
            return (
              <div
                key={col.date}
                className="cal-col"
                data-today={isToday || undefined}
                data-weekend={dow === 0 || dow === 6 || undefined}
              >
                {col.placed.map((placed) => (
                  <Block
                    key={placed.event.id}
                    placed={placed}
                    selected={placed.event.id === selectedId}
                    locallyEdited={localIds.includes(placed.event.id)}
                    onSelect={handleSelect}
                  />
                ))}

                {isToday && nowMinutes != null ? (
                  <div
                    className="cal-now"
                    style={{top: `${(nowMinutes / MINUTES_IN_DAY) * 100}%`}}
                  >
                    {/* The label sits in the hour gutter, so it is only safe
                        to draw when the today column is the first one. */}
                    {days.length === 1 ? (
                      <span className="cal-now-label cal-tabular">
                        {formatMinutes(nowMinutes)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
