/**
 * ============================================================================
 * AVAILABILITY — THE SINGLE SOURCE OF TRUTH FOR "IS THIS SLOT BOOKABLE"
 * ============================================================================
 *
 * Every surface that offers a time — the customer booking flow, the coach's
 * session log, the calendar grid, the "next open slot" strip — asks THIS
 * module and nothing else. If two screens disagree about whether Thursday at
 * 6:30 is free, a family shows up to a locked room. So there is one answer,
 * computed one way, here.
 *
 * ---------------------------------------------------------------------------
 * PURE. NO I/O. NO CLOCK.
 * ---------------------------------------------------------------------------
 * Nothing in this file fetches, reads a session, touches Supabase, or calls
 * `new Date()`. Everything the answer depends on arrives in an
 * `AvailabilityContext` — including `now`. That is not fussiness:
 *
 *   - the server runs UTC and the browser runs Pacific, so a component that
 *     derived "today" itself would hydrate to a different day than it rendered;
 *   - a booking decision that cannot be reproduced from its inputs cannot be
 *     tested, and cannot be explained to a parent who asks why their slot
 *     vanished.
 *
 * Call `slotsForDate(date, ctx)` twice with the same ctx and you get byte
 * identical output, on any machine, in any zone, forever.
 *
 * ---------------------------------------------------------------------------
 * TIME ZONE — ONE ZONE, AND IT IS NOT THE STORE'S
 * ---------------------------------------------------------------------------
 * The operating zone is America/Los_Angeles. Jesse coaches in Riverside; every
 * clock time in this system is the time on the wall of that room.
 *
 * The Shopify store is currently configured to America/Chicago. That is a
 * MISCONFIGURATION and we deliberately do not inherit it — see
 * `TIME_ZONE_MISMATCH` below, which exists so a screen can say so out loud
 * rather than silently sliding every session two hours.
 *
 * Internally, times are civil wall-clock strings (`IsoDateTime`,
 * `YYYY-MM-DDTHH:MM:SS`, no offset, no `Z`). Conversion to a real instant
 * happens ONLY at the Google boundary, through `toUtcInstant` /
 * `fromUtcInstant` in this file, which `~/lib/ops/googleCalendar` imports.
 *
 * ---------------------------------------------------------------------------
 * WHAT SUBTRACTS FROM AVAILABILITY
 * ---------------------------------------------------------------------------
 *   1. Nothing is bookable that no recurring rule covers        → 'closed'
 *   2. Already-booked JV Gold sessions                          → 'booked'
 *   3. Opaque busy blocks imported from Google                  → 'busy'
 *   4. Manual block-offs Jesse adds by hand                     → 'blocked'
 *   5. Minimum booking notice (default 24h)                     → 'notice'
 *   6. Maximum booking horizon (default 60 days)                → 'horizon'
 *   7. Anything already in the past                             → 'past'
 *
 * ---------------------------------------------------------------------------
 * PRIVACY — WHY `BusyBlock` HAS NO TITLE FIELD
 * ---------------------------------------------------------------------------
 * A busy block is a time range and a provenance tag. It has no title, no
 * description, no attendees, no location, and it never will — the type is the
 * enforcement. Jesse's dentist appointment must make that hour unbookable
 * without the word "dentist" ever reaching a customer's browser.
 *
 * Coach-only manual block-offs are a SEPARATE type (`ManualBlockOff`) which
 * may carry a private note. `busyFromBlockOff()` is the one-way door that
 * strips it. Never put a `ManualBlockOff` in a customer-facing loader payload;
 * convert it first.
 */

import {OFFERINGS} from '~/lib/offerings';
import type {OfferingId, SingleDateOffering} from '~/lib/offerings';
import type {IsoDate, IsoDateTime, SessionId} from '~/lib/ops/types';
import {
  addDays,
  daysFromCivil,
  daysFromIso,
  civilFromDays,
  dateOf,
  isoFromDays,
  weekdayOfIso,
} from '~/lib/ops/types';

/* ==========================================================================
 * 1. THE ZONE
 * ======================================================================== */

/** The zone every wall-clock string in this system is written in. */
export const OPERATING_TIME_ZONE = 'America/Los_Angeles' as const;

/** What the Shopify store is currently (wrongly) set to. */
// Widened to `string` on purpose: as a literal, TypeScript proves the
// comparison below can never be false and errors on it (TS2367). Keeping the
// value derived rather than asserting `false` means the flag corrects itself
// the moment someone fixes the store setting.
export const STORE_TIME_ZONE: string = 'America/Chicago';

/**
 * True while the store's zone disagrees with the operating zone. Screens that
 * quote a time sourced from Shopify should surface this rather than assume.
 * Flip to `false` only when the store setting is actually corrected.
 */
export const TIME_ZONE_MISMATCH = STORE_TIME_ZONE !== OPERATING_TIME_ZONE;

/** Human sentence for the mismatch, so every screen words it the same way. */
export const TIME_ZONE_MISMATCH_NOTE =
  'Availability is computed in Pacific time (America/Los_Angeles). The Shopify store is still set to America/Chicago — a two-hour difference. Times shown here are mat-room times; the store setting has to be corrected in Shopify admin.';

const MINUTES_PER_DAY = 1440;

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The date of the `n`th `weekday` in a month. 0 = Sunday.
 * `nthWeekdayOfMonth(2026, 3, 0, 2)` → the second Sunday in March 2026.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): IsoDate {
  const firstDay = daysFromCivil(year, month, 1);
  const firstWeekday = ((firstDay % 7) + 11) % 7;
  const delta = (weekday - firstWeekday + 7) % 7;
  return isoFromDays(firstDay + delta + (n - 1) * 7);
}

/**
 * Is this operating-zone wall clock inside daylight saving?
 *
 * US rule since 2007: DST starts the second Sunday in March at 02:00 local,
 * ends the first Sunday in November at 02:00 local. Implemented as pure string
 * comparison over civil dates — no `Date`, no `Intl`, identical on every
 * machine.
 *
 * The two pathological hours are handled the conventional way: 02:00–02:59 on
 * the spring-forward date does not exist and is treated as DST; 01:00–01:59 on
 * the fall-back date is ambiguous and is treated as DST (the first pass).
 * Jesse does not coach at 2am, so neither choice can move a real session.
 */
export function isDaylightSaving(at: IsoDateTime | IsoDate): boolean {
  const year = Number(at.slice(0, 4));
  const start = `${nthWeekdayOfMonth(year, 3, 0, 2)}T02:00:00`;
  const end = `${nthWeekdayOfMonth(year, 11, 0, 1)}T02:00:00`;
  const stamp = at.length >= 19 ? at : `${dateOf(at)}T00:00:00`;
  return stamp >= start && stamp < end;
}

/** UTC offset in minutes for an operating-zone wall clock. -420 or -480. */
export function operatingOffsetMinutes(at: IsoDateTime | IsoDate): number {
  return isDaylightSaving(at) ? -420 : -480;
}

/**
 * Operating-zone wall clock → a real instant, as an RFC 3339 `…Z` string.
 * THE GOOGLE BOUNDARY. Nothing else in the app should need this.
 */
export function toUtcInstant(at: IsoDateTime): string {
  const shifted = fromAbsoluteMinutes(
    absoluteMinutes(at) - operatingOffsetMinutes(at),
  );
  return `${shifted}Z`;
}

/**
 * A real instant (`…Z`) → operating-zone wall clock. The inverse of
 * `toUtcInstant`, resolved by trying both offsets and keeping the one that is
 * self-consistent. During the ambiguous fall-back hour it returns standard
 * time, which is the later of the two readings.
 */
export function fromUtcInstant(utc: string): IsoDateTime {
  const base = absoluteMinutes(utc.slice(0, 19));
  const daylight = fromAbsoluteMinutes(base - 420);
  if (isDaylightSaving(daylight)) return daylight;
  return fromAbsoluteMinutes(base - 480);
}

/**
 * Parse any RFC 3339 timestamp Google returns — `…Z`, `…-07:00`, `…+00:00` —
 * into an operating-zone wall clock.
 */
export function wallClockFromRfc3339(value: string): IsoDateTime {
  const naive = value.slice(0, 19);
  const suffix = value.slice(19);
  if (!suffix || suffix === 'Z' || suffix === 'z') return fromUtcInstant(naive);

  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(suffix.trim());
  if (!match) return fromUtcInstant(naive);

  const sign = match[1] === '-' ? -1 : 1;
  const offset = sign * (Number(match[2]) * 60 + Number(match[3]));
  return fromUtcInstant(fromAbsoluteMinutes(absoluteMinutes(naive) - offset));
}

/** Operating-zone wall clock → RFC 3339 with the correct Pacific offset. */
export function rfc3339FromWallClock(at: IsoDateTime): string {
  const offset = operatingOffsetMinutes(at);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${at}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/* ==========================================================================
 * 2. CLOCK ARITHMETIC — integers, never `Date`
 * ======================================================================== */

/** `'HH:MM'`, 24-hour. The internal clock format. */
export type Clock = string;

/** `'16:30'` → 990. Tolerates `'16:30:00'`. */
export function minutesFromClock(clock: Clock): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** 990 → `'16:30'`. Values past midnight wrap, which callers must not rely on. */
export function clockFromMinutes(minutes: number): Clock {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/**
 * `'4:00 PM'` → 960. The offerings file stores display labels, not clocks, so
 * this is how the published rate card is turned back into arithmetic.
 * Returns null on anything it cannot read — never a silent zero.
 */
export function minutesFromLabel(label: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?\s*$/.exec(label);
  if (!match) return null;
  const hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  if (minute > 59) return null;
  const pm = match[3].toLowerCase() === 'p';
  return (hour + (pm ? 12 : 0)) * 60 + minute;
}

/** 960 → `'4:00 PM'`. Pure string work; no `Intl`, no locale drift. */
export function labelFromMinutes(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(m / 60);
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${pad2(m % 60)} ${suffix}`;
}

/** `atOn('2026-08-11', 960)` → `'2026-08-11T16:00:00'`. */
export function atOn(date: IsoDate, minutes: number): IsoDateTime {
  return `${date}T${clockFromMinutes(minutes)}:00`;
}

/** Minutes since midnight of a wall-clock stamp. */
export function minuteOfDay(at: IsoDateTime): number {
  return Number(at.slice(11, 13)) * 60 + Number(at.slice(14, 16));
}

/** Minutes since the 1970 epoch, in wall-clock terms. The comparison key. */
export function absoluteMinutes(at: IsoDateTime): number {
  return daysFromIso(at) * MINUTES_PER_DAY + minuteOfDay(at);
}

/** Inverse of `absoluteMinutes`. Always emits `:SS` as `00`. */
export function fromAbsoluteMinutes(total: number): IsoDateTime {
  const days = Math.floor(total / MINUTES_PER_DAY);
  const rest = total - days * MINUTES_PER_DAY;
  return `${isoFromDays(days)}T${clockFromMinutes(rest)}:00`;
}

/** Calendar-safe minute shift across midnights, months and years. */
export function addMinutes(at: IsoDateTime, delta: number): IsoDateTime {
  return fromAbsoluteMinutes(absoluteMinutes(at) + delta);
}

/** Whole minutes between two wall-clock stamps, `end - start`. */
export function durationMinutes(start: IsoDateTime, end: IsoDateTime): number {
  return absoluteMinutes(end) - absoluteMinutes(start);
}

/* ==========================================================================
 * 3. INTERVALS
 * ======================================================================== */

/** A half-open range `[start, end)` in operating-zone wall clock. */
export interface Interval {
  start: IsoDateTime;
  end: IsoDateTime;
}

/**
 * Half-open overlap: a session ending at 5:00 and one starting at 5:00 do NOT
 * overlap. Back-to-back hours are how Jesse actually works.
 */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return (
    absoluteMinutes(a.start) < absoluteMinutes(b.end) &&
    absoluteMinutes(b.start) < absoluteMinutes(a.end)
  );
}

/** Grow an interval by `minutes` on both sides. Used for the booking buffer. */
export function padInterval(interval: Interval, minutes: number): Interval {
  if (!minutes) return interval;
  return {
    start: addMinutes(interval.start, -minutes),
    end: addMinutes(interval.end, minutes),
  };
}

/** Merge overlapping/touching intervals into the smallest covering set. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort(
    (a, b) => absoluteMinutes(a.start) - absoluteMinutes(b.start),
  );
  const out: Interval[] = [];
  for (const next of sorted) {
    const last = out[out.length - 1];
    if (last && absoluteMinutes(next.start) <= absoluteMinutes(last.end)) {
      if (absoluteMinutes(next.end) > absoluteMinutes(last.end)) {
        out[out.length - 1] = {start: last.start, end: next.end};
      }
      continue;
    }
    out.push({start: next.start, end: next.end});
  }
  return out;
}

/* ==========================================================================
 * 4. RECURRING AVAILABILITY RULES
 *
 * Jesse's working pattern is not a hardcoded array of dates. It is a small set
 * of recurring rules — "Tuesday and Thursday, 4:00 PM to 8:45 PM, an hour at a
 * time" — which project forward forever and can be edited in one place.
 *
 * The rules below are DERIVED from the slots already published in
 * `~/lib/offerings.ts`, so the rate card the public reads and the engine the
 * booking flow runs are the same fact. Change the offering, the rule follows.
 * ======================================================================== */

/**
 * A contiguous stretch of a day Jesse is open, plus the cadence starts are
 * offered on. `{from: '16:00', to: '20:45', everyMinutes: 75}` with a 60-minute
 * session yields 4:00, 5:15, 6:30 and 7:45 — a 15-minute turnaround built in.
 */
export interface AvailabilityWindow {
  /** Inclusive first start, `'HH:MM'`. */
  from: Clock;
  /** Exclusive end of the window — the last slot must END by this. */
  to: Clock;
  /** Gap between consecutive starts, in minutes. */
  everyMinutes: number;
}

/** One recurring working rule. */
export interface AvailabilityRule {
  id: string;
  /** "Tuesday & Thursday · 4:00 PM – 8:45 PM". Rendered, never parsed. */
  label: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  windows: AvailabilityWindow[];
  /** How long one bookable session is, in minutes. */
  slotMinutes: number;
  /** Which offerings this rule serves. Empty means "all of them". */
  offeringIds: OfferingId[];
  /** First date the rule applies. Null = always has. */
  effectiveFrom: IsoDate | null;
  /** Last date the rule applies. Null = indefinitely. */
  effectiveTo: IsoDate | null;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Collapse a sorted list of slot start times into windows.
 *
 * A run of starts separated by an identical gap becomes one window; the moment
 * the gap changes, a new window opens. Three starts at 6:00 AM, 3:30 PM and
 * 6:00 PM are two windows, not one impossible cadence — which is exactly what
 * the workout offering needs.
 */
function windowsFromStarts(
  starts: readonly number[],
  slotMinutes: number,
): AvailabilityWindow[] {
  const sorted = [...new Set(starts)].sort((a, b) => a - b);
  const windows: AvailabilityWindow[] = [];

  let index = 0;
  while (index < sorted.length) {
    const first = sorted[index];
    let last = first;
    let gap: number | null = null;
    let cursor = index + 1;

    while (cursor < sorted.length) {
      const step = sorted[cursor] - sorted[cursor - 1];
      if (gap === null) gap = step;
      else if (step !== gap) break;
      last = sorted[cursor];
      cursor += 1;
    }

    windows.push({
      from: clockFromMinutes(first),
      to: clockFromMinutes(last + slotMinutes),
      everyMinutes: gap ?? slotMinutes,
    });
    index = cursor;
  }

  return windows;
}

/** Every start time a window offers, as minutes since midnight. */
export function slotStartsInWindow(
  window: AvailabilityWindow,
  slotMinutes: number,
): number[] {
  const from = minutesFromClock(window.from);
  const rawTo = minutesFromClock(window.to);
  // A window written as `…–00:00` means midnight at the END of the day.
  const to = rawTo <= from ? MINUTES_PER_DAY : rawTo;
  const step = Math.max(1, Math.round(window.everyMinutes));

  const out: number[] = [];
  for (let start = from; start + slotMinutes <= to; start += step) {
    out.push(start);
  }
  return out;
}

/** "Tuesday & Thursday · 4:00 PM – 8:45 PM" */
function describeWindows(
  weekdays: readonly number[],
  windows: readonly AvailabilityWindow[],
): string {
  const days = weekdays.map((d) => WEEKDAY_NAMES[d] ?? `Day ${d}`);
  const dayLabel =
    days.length <= 1
      ? days[0] ?? ''
      : `${days.slice(0, -1).join(', ')} & ${days[days.length - 1]}`;
  const spans = windows
    .map(
      (w) =>
        `${labelFromMinutes(minutesFromClock(w.from))} – ${labelFromMinutes(
          minutesFromClock(w.to),
        )}`,
    )
    .join(', ');
  return `${dayLabel} · ${spans}`;
}

/** Rendered summary of a rule. Safe for any surface; names no client. */
export function describeRule(rule: AvailabilityRule): string {
  return rule.label;
}

function isSingleDate(offering: {mode: string}): offering is SingleDateOffering {
  return offering.mode === 'single-date';
}

/**
 * Turn the published offerings into recurring rules.
 *
 * Two offerings that open the identical pattern (private and partner both run
 * Tue/Thu evenings and Saturday mornings, both 60 minutes) collapse into ONE
 * rule serving both — because on the calendar they are the same hour of
 * Jesse's life, and double-counting them would let the same hour be sold
 * twice.
 */
export function deriveAvailabilityRules(
  offerings: readonly {mode: string}[] = OFFERINGS,
): AvailabilityRule[] {
  interface Pattern {
    weekdays: number[];
    windows: AvailabilityWindow[];
  }

  /** offering signature → the offerings that share it, plus its patterns. */
  const groups = new Map<
    string,
    {offeringIds: OfferingId[]; slotMinutes: number; patterns: Pattern[]}
  >();

  for (const offering of offerings) {
    if (!isSingleDate(offering)) continue;

    // weekday → windows, derived from the published slot labels.
    const byWeekday = new Map<number, AvailabilityWindow[]>();
    for (const [rawWeekday, slots] of Object.entries(offering.availability)) {
      const weekday = Number(rawWeekday);
      if (!Number.isInteger(weekday) || !slots || slots.length === 0) continue;
      const starts: number[] = [];
      for (const slot of slots) {
        const minutes = minutesFromLabel(slot.label);
        if (minutes !== null) starts.push(minutes);
      }
      if (starts.length === 0) continue;
      byWeekday.set(weekday, windowsFromStarts(starts, offering.minutes));
    }
    if (byWeekday.size === 0) continue;

    // Weekdays with an identical shape become one pattern.
    const byShape = new Map<string, Pattern>();
    for (const weekday of [...byWeekday.keys()].sort((a, b) => a - b)) {
      const windows = byWeekday.get(weekday) as AvailabilityWindow[];
      const shape = JSON.stringify(windows);
      const existing = byShape.get(shape);
      if (existing) existing.weekdays.push(weekday);
      else byShape.set(shape, {weekdays: [weekday], windows});
    }

    const patterns = [...byShape.values()].sort(
      (a, b) => a.weekdays[0] - b.weekdays[0],
    );
    const signature = JSON.stringify({minutes: offering.minutes, patterns});

    const group = groups.get(signature);
    if (group) group.offeringIds.push(offering.id);
    else {
      groups.set(signature, {
        offeringIds: [offering.id],
        slotMinutes: offering.minutes,
        patterns,
      });
    }
  }

  const rules: AvailabilityRule[] = [];
  for (const group of groups.values()) {
    for (const pattern of group.patterns) {
      rules.push({
        id: `${group.offeringIds.join('+')}-${pattern.weekdays.join('')}`,
        label: describeWindows(pattern.weekdays, pattern.windows),
        weekdays: pattern.weekdays,
        windows: pattern.windows,
        slotMinutes: group.slotMinutes,
        offeringIds: [...group.offeringIds],
        effectiveFrom: null,
        effectiveTo: null,
      });
    }
  }

  return rules.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Jesse's working pattern today, derived once at module load.
 *
 * As of the 2026 founding season that resolves to:
 *   private + partner  Tue & Thu 4:00–8:45 PM, Sat 8:00–11:30 AM (60 min)
 *   workout            Mon/Wed/Fri 6:00 AM, 3:30 PM, 6:00 PM · Sat 9 & 11 (90 min)
 *
 * Nothing here is typed by hand — edit `~/lib/offerings.ts` and this follows.
 */
export const AVAILABILITY_RULES: AvailabilityRule[] = deriveAvailabilityRules();

/** The rules that apply on a given date, optionally narrowed to an offering. */
export function rulesForDate(
  date: IsoDate,
  rules: readonly AvailabilityRule[],
  offeringId: OfferingId | null = null,
): AvailabilityRule[] {
  const weekday = weekdayOfIso(date);
  return rules.filter((rule) => {
    if (!rule.weekdays.includes(weekday)) return false;
    if (rule.effectiveFrom && date < rule.effectiveFrom) return false;
    if (rule.effectiveTo && date > rule.effectiveTo) return false;
    if (offeringId && rule.offeringIds.length > 0) {
      return rule.offeringIds.includes(offeringId);
    }
    return true;
  });
}

/* ==========================================================================
 * 5. WHAT SUBTRACTS — busy blocks, block-offs, booked sessions
 * ======================================================================== */

/** Where a busy range came from. This is the ONLY descriptive field allowed. */
export type BusySource = 'google' | 'manual' | 'session';

/**
 * An opaque unavailable range.
 *
 * DELIBERATELY HAS NO TITLE, DESCRIPTION, LOCATION OR ATTENDEE FIELD. Adding
 * one would let a private calendar entry leak into a customer-facing payload
 * the first time somebody spread this object into a loader response. If you
 * find yourself wanting one, you want `ManualBlockOff` (coach-only) instead.
 */
export interface BusyBlock {
  /** Stable, opaque. Never Google's event id — that is a lookup key elsewhere. */
  id: string;
  start: IsoDateTime;
  end: IsoDateTime;
  /** All-day blocks span `T00:00:00` to the next day's `T00:00:00`. */
  allDay: boolean;
  source: BusySource;
}

/**
 * A block-off Jesse adds by hand — a family thing, a travel day, a tournament.
 * COACH-ONLY: `note` is his own words and must never reach a customer. Pass it
 * through `busyFromBlockOff` before it goes anywhere public.
 */
export interface ManualBlockOff {
  id: string;
  start: IsoDateTime;
  end: IsoDateTime;
  allDay: boolean;
  /** Private. Coach surfaces only. */
  note: string;
}

/** The one-way door. Strips `note`; the result is safe to serialise publicly. */
export function busyFromBlockOff(block: ManualBlockOff): BusyBlock {
  return {
    id: block.id,
    start: block.start,
    end: block.end,
    allDay: block.allDay,
    source: 'manual',
  };
}

/** Bulk form of `busyFromBlockOff`. */
export function busyFromBlockOffs(
  blocks: readonly ManualBlockOff[],
): BusyBlock[] {
  return blocks.map(busyFromBlockOff);
}

/** A whole day held, expressed as a half-open midnight-to-midnight range. */
export function allDayBusy(
  id: string,
  date: IsoDate,
  source: BusySource = 'manual',
): BusyBlock {
  return {
    id,
    start: `${date}T00:00:00`,
    end: `${addDays(date, 1)}T00:00:00`,
    allDay: true,
    source,
  };
}

/**
 * The slice of a `TrainingSession` availability needs. `TrainingSession` from
 * `~/lib/ops/types` satisfies this structurally, so callers pass theirs
 * straight in without mapping.
 */
export interface BookedSession {
  id: SessionId;
  start: IsoDateTime;
  end: IsoDateTime;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
}

/**
 * Does this session consume Jesse's time?
 *
 * `cancelled` does not — the hour came back. `no-show` DOES: he stood on the
 * mat for it, it is billed, and it is not offerable to somebody else after the
 * fact. `scheduled` and `completed` obviously do.
 */
export function sessionHoldsTime(session: BookedSession): boolean {
  return session.status !== 'cancelled';
}

/** Booked sessions as opaque busy blocks, for callers that want one list. */
export function busyFromSessions(
  sessions: readonly BookedSession[],
): BusyBlock[] {
  return sessions.filter(sessionHoldsTime).map((session) => ({
    id: `session:${session.id}`,
    start: session.start,
    end: session.end,
    allDay: false,
    source: 'session' as const,
  }));
}

/* ==========================================================================
 * 6. POLICY AND CONTEXT
 * ======================================================================== */

export interface BookingPolicy {
  /**
   * How far ahead of a slot a customer must book it. 24h by default — Jesse
   * does not want a 6am booking landing at 11pm the night before.
   */
  minimumNoticeMinutes: number;
  /** How far into the future the calendar is open. 60 days by default. */
  maximumHorizonDays: number;
  /**
   * Dead time required either side of an existing commitment, in minutes.
   * 0 by default: back-to-back hours are how he already works.
   */
  bufferMinutes: number;
}

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  minimumNoticeMinutes: 24 * 60,
  maximumHorizonDays: 60,
  bufferMinutes: 0,
};

/**
 * Everything an availability answer depends on. Build it in a loader, pass it
 * down, and every screen agrees.
 */
export interface AvailabilityContext {
  /** "Now" in operating-zone wall clock. NEVER derived inside this module. */
  now: IsoDateTime;
  rules: readonly AvailabilityRule[];
  /** JV Gold's own bookings. */
  sessions: readonly BookedSession[];
  /** Opaque busy imported from Google, plus any already-flattened block-offs. */
  busy: readonly BusyBlock[];
  /** Coach-entered block-offs, still carrying their private note. */
  blockOffs: readonly ManualBlockOff[];
  policy: BookingPolicy;
  /** Narrow the rules to one offering. Null = every rule. */
  offeringId: OfferingId | null;
  /**
   * True only when Google Calendar is actually connected and the busy list is
   * a real answer. When false, "open" means "we have no record of a conflict",
   * which is a weaker claim — say so on screen rather than implying certainty.
   */
  googleConnected: boolean;
}

/** Build a context, defaulting everything that was not supplied. */
export function createAvailabilityContext(
  input: Partial<AvailabilityContext> & {now: IsoDateTime},
): AvailabilityContext {
  return {
    now: input.now,
    rules: input.rules ?? AVAILABILITY_RULES,
    sessions: input.sessions ?? [],
    busy: input.busy ?? [],
    blockOffs: input.blockOffs ?? [],
    policy: {...DEFAULT_BOOKING_POLICY, ...(input.policy ?? {})},
    offeringId: input.offeringId ?? null,
    googleConnected: input.googleConnected ?? false,
  };
}

/**
 * How much the word "open" is worth right now.
 *
 * `'confirmed'` — Google is connected, so his real week has been subtracted.
 * `'unverified'` — it is not, so this reflects JV Gold's own book only and a
 * personal commitment could still be sitting on that hour. Screens should
 * print the difference; see the honesty rule.
 */
export function availabilityConfidence(
  ctx: AvailabilityContext,
): 'confirmed' | 'unverified' {
  return ctx.googleConnected ? 'confirmed' : 'unverified';
}

export const UNVERIFIED_AVAILABILITY_NOTE =
  'Google Calendar is not connected, so these times reflect JV Gold bookings only. A personal commitment on Jesse’s own calendar would not yet remove an hour from this list.';

/* ==========================================================================
 * 7. THE ANSWER
 * ======================================================================== */

/** Why a slot is not offerable. `'open'` means it is. */
export type SlotBlockReason =
  | 'open'
  | 'closed'
  | 'past'
  | 'notice'
  | 'horizon'
  | 'booked'
  | 'busy'
  | 'blocked'
  | 'invalid';

export interface SlotDecision {
  open: boolean;
  reason: SlotBlockReason;
  /** One sentence, safe for any audience. Never names a private event. */
  detail: string;
}

export interface AvailabilitySlot {
  /** Stable across renders and machines: `'2026-08-11T16:00:00+60'`. */
  id: string;
  date: IsoDate;
  start: IsoDateTime;
  end: IsoDateTime;
  minutes: number;
  /** `'4:00 PM'`. */
  label: string;
  /** `'4:00 PM – 5:00 PM'`. */
  rangeLabel: string;
  ruleId: string;
  offeringIds: OfferingId[];
  open: boolean;
  reason: SlotBlockReason;
  detail: string;
}

export interface SlotCheckOptions {
  /**
   * Skip the "a rule must cover this" test. The COACH may log a session at an
   * hour he does not publish; a customer may not book one.
   */
  ignoreRules?: boolean;
  /**
   * Skip minimum notice and the booking horizon. These are customer-booking
   * policy, not physics — staff logging should pass `true`.
   */
  ignorePolicy?: boolean;
  /** Ignore one session when testing conflicts. Set it when editing in place. */
  exceptSessionId?: SessionId | null;
  /** Allow a start in the past. Staff logging a session from last week needs this. */
  allowPast?: boolean;
}

const DETAIL: Record<SlotBlockReason, string> = {
  open: 'Available.',
  closed: 'Outside Jesse’s coaching hours.',
  past: 'That time has already passed.',
  notice: 'Too soon — bookings close ahead of the session.',
  horizon: 'Beyond the window currently open for booking.',
  booked: 'Already booked.',
  busy: 'Unavailable.',
  blocked: 'Held — Jesse has blocked this time off.',
  invalid: 'That is not a valid time range.',
};

function decide(reason: SlotBlockReason, detail?: string): SlotDecision {
  return {open: reason === 'open', reason, detail: detail ?? DETAIL[reason]};
}

/** Does any rule in the context publish exactly this range? */
function coveredByRules(
  start: IsoDateTime,
  end: IsoDateTime,
  ctx: AvailabilityContext,
): boolean {
  const date = dateOf(start);
  const startMinute = minuteOfDay(start);
  const minutes = durationMinutes(start, end);
  for (const rule of rulesForDate(date, ctx.rules, ctx.offeringId)) {
    if (rule.slotMinutes !== minutes) continue;
    for (const window of rule.windows) {
      if (slotStartsInWindow(window, rule.slotMinutes).includes(startMinute)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The full ruling on an arbitrary range, with the reason.
 *
 * Order matters and is deliberate: structural impossibility first (`invalid`,
 * `closed`), then time policy (`past`, `notice`, `horizon`), then conflicts
 * (`booked`, `busy`, `blocked`). A slot that is both in the past and booked
 * reads as "already passed", which is the more useful sentence.
 */
export function checkSlot(
  start: IsoDateTime,
  end: IsoDateTime,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): SlotDecision {
  const startAt = absoluteMinutes(start);
  const endAt = absoluteMinutes(end);
  if (!(endAt > startAt)) return decide('invalid');

  if (!options.ignoreRules && !coveredByRules(start, end, ctx)) {
    return decide('closed');
  }

  const nowAt = absoluteMinutes(ctx.now);

  if (!options.allowPast && startAt < nowAt) return decide('past');

  if (!options.ignorePolicy) {
    if (startAt < nowAt + ctx.policy.minimumNoticeMinutes) {
      const hours = Math.round(ctx.policy.minimumNoticeMinutes / 60);
      return decide(
        'notice',
        `Too soon — sessions must be booked at least ${hours} hours ahead.`,
      );
    }
    const lastDate = addDays(dateOf(ctx.now), ctx.policy.maximumHorizonDays);
    if (dateOf(start) > lastDate) {
      return decide(
        'horizon',
        `The calendar is open through ${lastDate}. Later dates open as that window rolls forward.`,
      );
    }
  }

  const candidate: Interval = {start, end};
  const buffer = ctx.policy.bufferMinutes;

  for (const session of ctx.sessions) {
    if (!sessionHoldsTime(session)) continue;
    if (options.exceptSessionId && session.id === options.exceptSessionId) {
      continue;
    }
    if (intervalsOverlap(candidate, padInterval(session, buffer))) {
      return decide('booked');
    }
  }

  for (const block of ctx.busy) {
    if (block.source === 'manual') {
      if (intervalsOverlap(candidate, padInterval(block, buffer))) {
        return decide('blocked');
      }
      continue;
    }
    if (intervalsOverlap(candidate, padInterval(block, buffer))) {
      // Deliberately says nothing about what the conflict is.
      return decide('busy');
    }
  }

  for (const block of ctx.blockOffs) {
    if (intervalsOverlap(candidate, padInterval(block, buffer))) {
      return decide('blocked');
    }
  }

  return decide('open');
}

/**
 * The boolean the name promises. Reach for `checkSlot` when you need to tell
 * somebody WHY.
 */
export function isSlotOpen(
  start: IsoDateTime,
  end: IsoDateTime,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): boolean {
  return checkSlot(start, end, ctx, options).open;
}

/**
 * Every slot the rules generate for a date, each annotated open or blocked.
 *
 * Returns blocked slots too, on purpose: a calendar that hides taken hours
 * looks like a coach with no clients, and a customer cannot tell "fully
 * booked" from "does not work Thursdays". Filter with `openSlotsForDate` when
 * you genuinely only want the bookable ones.
 *
 * An empty array means the day is closed — no rule covers it at all.
 */
export function slotsForDate(
  date: IsoDate,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): AvailabilitySlot[] {
  const rules = rulesForDate(date, ctx.rules, ctx.offeringId);
  const seen = new Map<string, AvailabilitySlot>();

  for (const rule of rules) {
    for (const window of rule.windows) {
      for (const startMinute of slotStartsInWindow(window, rule.slotMinutes)) {
        const start = atOn(date, startMinute);
        const end = addMinutes(start, rule.slotMinutes);
        const id = `${start}+${rule.slotMinutes}`;
        const existing = seen.get(id);
        if (existing) {
          // Same hour published by two rules: merge the offerings, keep one row.
          for (const offeringId of rule.offeringIds) {
            if (!existing.offeringIds.includes(offeringId)) {
              existing.offeringIds.push(offeringId);
            }
          }
          continue;
        }

        const decision = checkSlot(start, end, ctx, {
          ...options,
          ignoreRules: true, // it came from a rule; re-deriving is wasted work
        });

        seen.set(id, {
          id,
          date,
          start,
          end,
          minutes: rule.slotMinutes,
          label: labelFromMinutes(startMinute),
          rangeLabel: `${labelFromMinutes(startMinute)} – ${labelFromMinutes(
            startMinute + rule.slotMinutes,
          )}`,
          ruleId: rule.id,
          offeringIds: [...rule.offeringIds],
          open: decision.open,
          reason: decision.reason,
          detail: decision.detail,
        });
      }
    }
  }

  return [...seen.values()].sort(
    (a, b) => absoluteMinutes(a.start) - absoluteMinutes(b.start),
  );
}

/** `slotsForDate` filtered to the genuinely bookable ones. */
export function openSlotsForDate(
  date: IsoDate,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): AvailabilitySlot[] {
  return slotsForDate(date, ctx, options).filter((slot) => slot.open);
}

/**
 * The next `count` bookable slots from a date or timestamp, walking forward a
 * day at a time and stopping at the booking horizon. Returns fewer than
 * `count` — possibly none — when the horizon runs out first, which is an
 * honest answer and must be rendered as one.
 */
export function nextOpenSlots(
  from: IsoDate | IsoDateTime,
  count: number,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): AvailabilitySlot[] {
  if (count <= 0) return [];

  const fromAt = from.length >= 19 ? absoluteMinutes(from) : null;
  const startDate = dateOf(from);
  const lastDate = options.ignorePolicy
    ? addDays(startDate, 365)
    : addDays(dateOf(ctx.now), ctx.policy.maximumHorizonDays);

  const out: AvailabilitySlot[] = [];
  let date = startDate;
  let guard = 0;

  while (date <= lastDate && out.length < count && guard < 400) {
    guard += 1;
    for (const slot of openSlotsForDate(date, ctx, options)) {
      if (fromAt !== null && absoluteMinutes(slot.start) < fromAt) continue;
      out.push(slot);
      if (out.length >= count) break;
    }
    date = addDays(date, 1);
  }

  return out;
}

/* ==========================================================================
 * 8. DAY AND MONTH SUMMARIES — what a calendar grid needs
 * ======================================================================== */

/** Same vocabulary the public booking calendar already uses. */
export type DayState = 'open' | 'limited' | 'full' | 'closed';

export interface DayAvailability {
  date: IsoDate;
  state: DayState;
  /** Bookable slots. */
  open: number;
  /** Slots the rules generate, bookable or not. 0 means a closed day. */
  total: number;
  /** First bookable start of the day, or null. */
  firstOpen: IsoDateTime | null;
}

export function dayAvailability(
  date: IsoDate,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): DayAvailability {
  const slots = slotsForDate(date, ctx, options);
  if (slots.length === 0) {
    return {date, state: 'closed', open: 0, total: 0, firstOpen: null};
  }
  const openSlots = slots.filter((slot) => slot.open);
  const state: DayState =
    openSlots.length === 0 ? 'full' : openSlots.length === 1 ? 'limited' : 'open';
  return {
    date,
    state,
    open: openSlots.length,
    total: slots.length,
    firstOpen: openSlots.length > 0 ? openSlots[0].start : null,
  };
}

/** A run of day summaries — the shape a month grid or a week strip wants. */
export function availabilityCalendar(
  fromDate: IsoDate,
  days: number,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let index = 0; index < Math.max(0, days); index += 1) {
    out.push(dayAvailability(addDays(fromDate, index), ctx, options));
  }
  return out;
}

/** Every date in a `YYYY-MM` month, summarised. */
export function availabilityForMonth(
  monthKey: string,
  ctx: AvailabilityContext,
  options: SlotCheckOptions = {},
): DayAvailability[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const first = daysFromCivil(year, month, 1);
  const next = daysFromCivil(month === 12 ? year + 1 : year, (month % 12) + 1, 1);
  return availabilityCalendar(isoFromDays(first), next - first, ctx, options);
}

/** The last date the booking horizon currently reaches. */
export function bookingHorizonDate(ctx: AvailabilityContext): IsoDate {
  return addDays(dateOf(ctx.now), ctx.policy.maximumHorizonDays);
}

/** The earliest instant a customer could book, given minimum notice. */
export function earliestBookableAt(ctx: AvailabilityContext): IsoDateTime {
  return addMinutes(ctx.now, ctx.policy.minimumNoticeMinutes);
}

/**
 * `'2026-08-11'` → `'Tuesday, August 11, 2026'`. Pure string work — the
 * public offerings helper of the same name routes through `new Date()`, which
 * hydration-mismatches, so availability screens use this one.
 */
export function formatLongDateSafe(date: IsoDate): string {
  const {y, m, d} = civilFromDays(daysFromIso(date));
  const months = [
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
  return `${WEEKDAY_NAMES[weekdayOfIso(date)]}, ${months[m - 1]} ${d}, ${y}`;
}
