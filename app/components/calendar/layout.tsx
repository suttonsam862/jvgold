/**
 * ============================================================================
 * CALENDAR — LAYOUT MATH
 * ============================================================================
 *
 * Pure, allocation-cheap helpers behind the month grid and the time grids.
 * Nothing here touches the DOM, `Date`, `Date.now()` or `Math.random()`: every
 * value is derived from the civil-date integers in `~/lib/ops/types`, so the
 * server and the browser render byte-identical markup.
 *
 * The interesting piece is `packDay` — the column packing that lets two
 * sessions at 4:00 sit side by side instead of on top of each other. That is
 * the difference between a real calendar and a picture of one.
 */

import type {CalendarEvent, IsoDate, IsoDateTime} from '~/lib/ops/types';
import {
  addDays,
  daysFromIso,
  isoFromDays,
  weekdayOfIso,
} from '~/lib/ops/types';

export const MINUTES_IN_DAY = 1440;

/** Which of the three views is on screen. */
export type CalendarView = 'month' | 'week' | 'day';

/** The de-identified roster entries the edit form attaches athletes from. */
export interface RosterEntry {
  id: string;
  name: string;
}

/** Height of one hour row in the time grid, in px. Mirrored in calendar.css. */
export const HOUR_PX = 56;

/** Where the time grid scrolls to on open — 6am, the start of Jesse's day. */
export const GRID_SCROLL_HOUR = 6;

/** Shortest block the grid will draw, so a 15-minute slot stays tappable. */
export const MIN_BLOCK_MINUTES = 30;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/* --------------------------------------------------------------------------
 * Scalars
 * ------------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `'2026-08-01T16:30:00'` → `990`. Minutes past local midnight. */
export function minutesOf(at: IsoDateTime): number {
  return Number(at.slice(11, 13)) * 60 + Number(at.slice(14, 16));
}

/** `('2026-08-01', 990)` → `'2026-08-01T16:30:00'`. Rolls over past midnight. */
export function toDateTime(date: IsoDate, minutes: number): IsoDateTime {
  const dayShift = Math.floor(minutes / MINUTES_IN_DAY);
  const within = minutes - dayShift * MINUTES_IN_DAY;
  const iso = dayShift === 0 ? date : addDays(date, dayShift);
  return `${iso}T${pad2(Math.floor(within / 60))}:${pad2(within % 60)}:00`;
}

/** `990` → `'16:30'`, the value an `<input type="time">` wants. */
export function minutesToInputTime(minutes: number): string {
  const within = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return `${pad2(Math.floor(within / 60))}:${pad2(within % 60)}`;
}

/** `'16:30'` → `990`. Returns `null` for anything malformed. */
export function inputTimeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** `990` → `'4:30 PM'`. No `Intl`, no `Date`. */
export function formatMinutes(minutes: number): string {
  const within = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(within / 60);
  const min = within % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0
    ? `${h12} ${suffix}`
    : `${h12}:${pad2(min)} ${suffix}`;
}

/** Gutter label for hour `h`. Midnight is blank — nothing needs labelling. */
export function hourLabel(h: number): string {
  if (h === 0) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** `'2026-08-01'` → `'Saturday, August 1'`. */
export function longDate(iso: IsoDate): string {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${WEEKDAY_LONG[weekdayOfIso(iso)]}, ${MONTH_LONG[m - 1]} ${d}`;
}

/** `'2026-08-01'` → `'August 2026'`. */
export function monthTitle(iso: IsoDate): string {
  return `${MONTH_LONG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** `'Aug 1 – 7, 2026'`, collapsing the month when the week does not straddle. */
export function weekTitle(startIso: IsoDate): string {
  const end = addDays(startIso, 6);
  const sm = MONTH_SHORT[Number(startIso.slice(5, 7)) - 1];
  const em = MONTH_SHORT[Number(end.slice(5, 7)) - 1];
  const sd = Number(startIso.slice(8, 10));
  const ed = Number(end.slice(8, 10));
  const year = end.slice(0, 4);
  if (sm === em) return `${sm} ${sd} – ${ed}, ${year}`;
  return `${sm} ${sd} – ${em} ${ed}, ${year}`;
}

/* --------------------------------------------------------------------------
 * Ranges
 * ------------------------------------------------------------------------ */

/** Sunday of the week containing `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayOfIso(iso));
}

/** First of the month containing `iso`. */
export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

/** Shift by whole months, clamping the day (Jan 31 → Feb 28). */
export function addMonths(iso: IsoDate, delta: number): IsoDate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  const last = daysInMonth(ny, nm);
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Seven ISO dates, Sunday first. */
export function weekDates(startIso: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const z = daysFromIso(startIso);
  for (let i = 0; i < 7; i++) out.push(isoFromDays(z + i));
  return out;
}

/**
 * The 42-cell month matrix (6 rows × 7 days), Sunday first, padded with the
 * trailing days of the previous month and the leading days of the next. Always
 * 42 so the grid never reflows its row height between months.
 */
export function monthMatrix(iso: IsoDate): IsoDate[] {
  const first = startOfMonth(iso);
  const gridStart = daysFromIso(startOfWeek(first));
  const out: IsoDate[] = [];
  for (let i = 0; i < 42; i++) out.push(isoFromDays(gridStart + i));
  return out;
}

/* --------------------------------------------------------------------------
 * Bucketing
 * ------------------------------------------------------------------------ */

/**
 * The last day an event visually occupies. An event ending exactly at midnight
 * belongs to the previous day — that is how Google renders an all-day block,
 * whose `end` is the exclusive next midnight.
 */
export function lastDayOf(event: CalendarEvent): IsoDate {
  const endDate = event.end.slice(0, 10);
  const endMinutes = minutesOf(event.end);
  if (endMinutes === 0 && endDate > event.start.slice(0, 10)) {
    return addDays(endDate, -1);
  }
  return endDate;
}

/** True when the event touches `day` at all. */
export function occursOn(event: CalendarEvent, day: IsoDate): boolean {
  return event.start.slice(0, 10) <= day && lastDayOf(event) >= day;
}

/**
 * Index every event onto every day it touches. Built once per event list and
 * memoised by the caller — the month grid then reads 42 O(1) lookups instead
 * of running 42 filters over the whole dataset.
 */
export function indexByDate(
  events: readonly CalendarEvent[],
): Map<IsoDate, CalendarEvent[]> {
  const map = new Map<IsoDate, CalendarEvent[]>();
  for (const event of events) {
    const first = daysFromIso(event.start);
    // A runaway span would otherwise write thousands of keys; 60 days is far
    // beyond anything the seed or a sane Google import produces.
    const last = Math.min(daysFromIso(lastDayOf(event)), first + 60);
    for (let z = first; z <= last; z++) {
      const key = isoFromDays(z);
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
  }
  for (const bucket of map.values()) bucket.sort(compareForDay);
  return map;
}

/** All-day and longer events first, then by start, then stable by id. */
function compareForDay(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  const aLen = daysFromIso(a.end) - daysFromIso(a.start);
  const bLen = daysFromIso(b.end) - daysFromIso(b.start);
  if (aLen !== bLen) return bLen - aLen;
  return a.id < b.id ? -1 : 1;
}

export function eventsOn(
  index: Map<IsoDate, CalendarEvent[]>,
  day: IsoDate,
): CalendarEvent[] {
  return index.get(day) ?? [];
}

/* --------------------------------------------------------------------------
 * Column packing
 * ------------------------------------------------------------------------ */

/** One timed event, resolved to a rectangle inside a single day column. */
export interface PositionedEvent {
  event: CalendarEvent;
  /** Minutes past midnight on the day being laid out, clipped to [0, 1440]. */
  startMin: number;
  endMin: number;
  /** Percent of the day column, 0-100. */
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
  /** Column index and how many columns the cluster resolved to — for a11y. */
  column: number;
  columns: number;
}

interface Slot {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  /** Collision end — never shorter than MIN_BLOCK_MINUTES. */
  guardEnd: number;
  column: number;
  span: number;
}

/**
 * Lay out one day's timed events, side by side where they overlap.
 *
 * 1. Clip every event to the day (a session crossing midnight becomes two
 *    rectangles, one in each day's own layout pass).
 * 2. Walk the sorted list splitting it into *clusters* — maximal runs of
 *    transitively-overlapping events. A cluster is the only scope in which
 *    widths have to agree.
 * 3. Inside a cluster, greedily drop each event into the leftmost column whose
 *    last occupant has already finished.
 * 4. Expand each event rightwards across free columns, which is what stops a
 *    lone 6am block from rendering at one-third width just because two other
 *    events collide later in the same cluster.
 */
export function packDay(
  events: readonly CalendarEvent[],
  day: IsoDate,
): PositionedEvent[] {
  const slots: Slot[] = [];
  for (const event of events) {
    if (event.allDay) continue;
    if (!occursOn(event, day)) continue;
    const startMin = event.start.slice(0, 10) < day ? 0 : minutesOf(event.start);
    const rawEnd =
      event.end.slice(0, 10) > day ? MINUTES_IN_DAY : minutesOf(event.end);
    const endMin = Math.max(rawEnd, startMin + 1);
    slots.push({
      event,
      startMin,
      endMin: Math.min(endMin, MINUTES_IN_DAY),
      guardEnd: Math.min(
        Math.max(endMin, startMin + MIN_BLOCK_MINUTES),
        MINUTES_IN_DAY,
      ),
      column: 0,
      span: 1,
    });
  }

  if (slots.length === 0) return [];

  slots.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.guardEnd !== b.guardEnd) return b.guardEnd - a.guardEnd;
    return a.event.id < b.event.id ? -1 : 1;
  });

  const out: PositionedEvent[] = [];
  let cluster: Slot[] = [];
  let clusterEnd = -1;
  /** Per-column "time the column is free again" within the current cluster. */
  let columnEnds: number[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const total = columnEnds.length;
    for (const slot of cluster) {
      // Expand right while the next column has no overlapping neighbour.
      let span = 1;
      for (let c = slot.column + 1; c < total; c++) {
        const blocked = cluster.some(
          (other) =>
            other !== slot &&
            other.column === c &&
            other.startMin < slot.guardEnd &&
            other.guardEnd > slot.startMin,
        );
        if (blocked) break;
        span++;
      }
      slot.span = span;
      out.push({
        event: slot.event,
        startMin: slot.startMin,
        endMin: slot.endMin,
        topPct: (slot.startMin / MINUTES_IN_DAY) * 100,
        heightPct:
          ((Math.max(slot.endMin, slot.startMin + MIN_BLOCK_MINUTES) -
            slot.startMin) /
            MINUTES_IN_DAY) *
          100,
        leftPct: (slot.column / total) * 100,
        widthPct: (span / total) * 100,
        column: slot.column,
        columns: total,
      });
    }
    cluster = [];
    columnEnds = [];
  };

  for (const slot of slots) {
    if (slot.startMin >= clusterEnd) {
      flush();
      clusterEnd = slot.guardEnd;
    } else {
      clusterEnd = Math.max(clusterEnd, slot.guardEnd);
    }
    let column = columnEnds.findIndex((end) => end <= slot.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(slot.guardEnd);
    } else {
      columnEnds[column] = slot.guardEnd;
    }
    slot.column = column;
    cluster.push(slot);
  }
  flush();

  // Restore reading order — the packer emits cluster by cluster.
  out.sort((a, b) =>
    a.startMin !== b.startMin
      ? a.startMin - b.startMin
      : a.column - b.column,
  );
  return out;
}

/* --------------------------------------------------------------------------
 * Presentation helpers
 * ------------------------------------------------------------------------ */

/**
 * The `data-kind` value a block carries. Google events that have not been
 * claimed get their own token so the CSS can render them as visibly foreign.
 */
export function toneOf(event: CalendarEvent): string {
  if (event.source === 'google') return event.claimed ? 'claimed' : 'google';
  return event.kind ?? 'group';
}

export const KIND_LABEL: Record<string, string> = {
  private: 'Private',
  partner: 'Partner',
  clinic: 'Clinic',
  workout: 'Workout',
  camp: 'Camp',
  group: 'Group',
};

/** `'4:00 – 5:00 PM'`, dropping the first suffix when both share it. */
export function rangeLabel(startMin: number, endMin: number): string {
  const startPm = Math.floor(startMin / 60) >= 12;
  const endPm = Math.floor(endMin / 60) >= 12;
  const start = formatMinutes(startMin);
  const end = formatMinutes(endMin);
  if (startPm === endPm) return `${start.replace(/ [AP]M$/, '')} – ${end}`;
  return `${start} – ${end}`;
}
