/**
 * MONTH VIEW — 6×7 cells, Sunday first.
 *
 * The whole cell is one button: on a phone, a nested chip-button inside a
 * day-button is both invalid HTML and impossible to hit. Tapping a day opens
 * that day's time grid, which is where blocks become individually tappable.
 *
 * Every cell is memoised on the exact values it draws, so paging a month
 * re-renders 42 cheap components rather than re-laying-out the whole month.
 */

import {memo} from 'react';
import type {CalendarEvent, IsoDate} from '~/lib/ops/types';
import {weekdayOfIso} from '~/lib/ops/types';
import {
  MONTH_SHORT,
  WEEKDAY_NARROW,
  WEEKDAY_SHORT,
  formatMinutes,
  longDate,
  minutesOf,
  toneOf,
} from './layout';

/** Chips beyond this collapse into a "+N MORE" line. */
const MAX_CHIPS = 3;

interface DayCellProps {
  date: IsoDate;
  events: CalendarEvent[];
  outside: boolean;
  today: boolean;
  selected: boolean;
  onOpen: (date: IsoDate) => void;
}

const DayCell = memo(function DayCell({
  date,
  events,
  outside,
  today,
  selected,
  onOpen,
}: DayCellProps) {
  const dayNum = Number(date.slice(8, 10));
  const weekend = weekdayOfIso(date) === 0 || weekdayOfIso(date) === 6;
  const shown = events.slice(0, MAX_CHIPS);
  const overflow = events.length - shown.length;

  return (
    <button
      type="button"
      className="cal-day"
      data-date={date}
      data-outside={outside || undefined}
      data-today={today || undefined}
      data-selected={selected || undefined}
      data-weekend={weekend || undefined}
      data-first={dayNum === 1 || undefined}
      tabIndex={selected ? 0 : -1}
      aria-label={`${longDate(date)}, ${
        events.length === 1 ? '1 event' : `${events.length} events`
      }`}
      onClick={() => onOpen(date)}
    >
      <span className="cal-daynum cal-tabular" aria-hidden="true">
        {dayNum === 1
          ? `${MONTH_SHORT[Number(date.slice(5, 7)) - 1]} 1`
          : dayNum}
      </span>

      {/* Under 420px the cells are too narrow for text; CSS swaps to dots. */}
      <span className="cal-dots" aria-hidden="true">
        {events.slice(0, 4).map((event) => (
          <span key={event.id} className="cal-dot" data-tone={toneOf(event)} />
        ))}
      </span>

      {shown.map((event) => (
        <span
          key={event.id}
          className="cal-chip"
          data-tone={toneOf(event)}
          data-readonly={event.readOnly || undefined}
          aria-hidden="true"
        >
          {event.allDay ? null : (
            <span className="cal-chip-time">
              {formatMinutes(minutesOf(event.start)).replace(/:00/, '')}
            </span>
          )}
          <span className="cal-chip-title">{event.title}</span>
        </span>
      ))}

      {overflow > 0 ? (
        <span className="cal-more cal-tabular" aria-hidden="true">
          +{overflow} more
        </span>
      ) : null}
    </button>
  );
});

interface MonthViewProps {
  /** 42 ISO dates from `monthMatrix`. */
  cells: IsoDate[];
  /** `YYYY-MM` of the month in focus — everything else renders dimmed. */
  monthKey: string;
  index: Map<IsoDate, CalendarEvent[]>;
  todayDate: IsoDate | null;
  focusedDate: IsoDate;
  onOpenDay: (date: IsoDate) => void;
}

export const MonthView = memo(function MonthView({
  cells,
  monthKey,
  index,
  todayDate,
  focusedDate,
  onOpenDay,
}: MonthViewProps) {
  return (
    <div>
      <div className="cal-weekhead" aria-hidden="true">
        {WEEKDAY_SHORT.map((label, i) => (
          <span key={label}>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{WEEKDAY_NARROW[i]}</span>
          </span>
        ))}
      </div>
      <div className="cal-month">
        {cells.map((date) => (
          <DayCell
            key={date}
            date={date}
            events={index.get(date) ?? EMPTY}
            outside={date.slice(0, 7) !== monthKey}
            today={date === todayDate}
            selected={date === focusedDate}
            onOpen={onOpenDay}
          />
        ))}
      </div>
    </div>
  );
});

/** One shared empty array — a fresh `[]` per cell would defeat the memo. */
const EMPTY: CalendarEvent[] = [];
