import {useEffect, useRef, useState} from 'react';
import {
  WEEKDAY_INITIALS,
  daysInMonth,
  isoFrom,
  isoOf,
  monthLabel,
  monthShortLabel,
  parseIso,
  splitMonthKey,
} from '~/lib/offerings';
import type {DayState} from '~/lib/offerings';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface DayMeta {
  /** Visual + interaction state of the cell. */
  state: DayState | 'past';
  selectable: boolean;
  selected?: boolean;
  /** Marks today with a quiet gold tick. */
  today?: boolean;
  /** Multi-day camp span. */
  span?: 'start' | 'inside' | 'end';
  /** Generated recurring package date. */
  pattern?: boolean;
  /** Full accessible name — date plus availability. */
  label: string;
}

interface MonthGridProps {
  monthKey: string;
  months: string[];
  onMonthChange: (monthKey: string) => void;
  getDay: (iso: string) => DayMeta;
  /** Omit to render a read-only calendar (camp spans, package previews). */
  onSelect?: (iso: string) => void;
  /** Rendered under the grid. */
  footer?: React.ReactNode;
  gridLabel: string;
  /** Resolved after hydration; marks the current day. */
  todayIso?: string | null;
}

/**
 * A month calendar built as a real `role="grid"`: one tab stop, roving
 * tabindex, arrow keys by day, Enter/Space to select, PageUp/PageDown by
 * month, Home/End to the week bounds. Unavailable days keep their place in
 * the grid and are announced, never removed.
 *
 * Visually it is a hairline table — the frame draws the top and left rules,
 * every cell draws its own right and bottom, so the month reads as one ruled
 * sheet instead of forty-two little boxes.
 */
export function MonthGrid({
  monthKey,
  months,
  onMonthChange,
  getDay,
  onSelect,
  footer,
  gridLabel,
  todayIso = null,
}: MonthGridProps) {
  const {year, month} = splitMonthKey(monthKey);
  const total = daysInMonth(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();
  const interactive = Boolean(onSelect);

  const gridRef = useRef<HTMLDivElement>(null);
  const [activeIso, setActiveIso] = useState<string>(() =>
    firstSelectable(monthKey, getDay) ?? isoFrom(year, month, 1),
  );
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const index = months.indexOf(monthKey);
  const prevMonth = index > 0 ? months[index - 1] : null;
  const nextMonth = index < months.length - 1 ? months[index + 1] : null;

  // Keep the roving tab stop inside the visible month.
  useEffect(() => {
    if (activeIso.slice(0, 7) !== monthKey) {
      const {year: y, month: m} = splitMonthKey(monthKey);
      setActiveIso(firstSelectable(monthKey, getDay) ?? isoFrom(y, m, 1));
    }
    // getDay is derived from props each render; monthKey is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    if (!pendingFocus) return;
    const node = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-iso="${pendingFocus}"]`,
    );
    node?.focus();
    setPendingFocus(null);
  }, [pendingFocus, monthKey]);

  const focusIso = (iso: string) => {
    const targetMonth = iso.slice(0, 7);
    if (targetMonth === monthKey) {
      setActiveIso(iso);
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)
        ?.focus();
      return;
    }
    if (!months.includes(targetMonth)) return;
    setActiveIso(iso);
    onMonthChange(targetMonth);
    setPendingFocus(iso);
  };

  const shiftDays = (iso: string, delta: number) => {
    const d = parseIso(iso);
    d.setDate(d.getDate() + delta);
    focusIso(isoOf(d));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const iso = activeIso;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        shiftDays(iso, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        shiftDays(iso, -1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        shiftDays(iso, 7);
        break;
      case 'ArrowUp':
        event.preventDefault();
        shiftDays(iso, -7);
        break;
      case 'Home': {
        event.preventDefault();
        shiftDays(iso, -parseIso(iso).getDay());
        break;
      }
      case 'End': {
        event.preventDefault();
        shiftDays(iso, 6 - parseIso(iso).getDay());
        break;
      }
      case 'PageUp':
        if (prevMonth) {
          event.preventDefault();
          onMonthChange(prevMonth);
          const {year: y, month: m} = splitMonthKey(prevMonth);
          const next = firstSelectable(prevMonth, getDay) ?? isoFrom(y, m, 1);
          setActiveIso(next);
          setPendingFocus(next);
        }
        break;
      case 'PageDown':
        if (nextMonth) {
          event.preventDefault();
          onMonthChange(nextMonth);
          const {year: y, month: m} = splitMonthKey(nextMonth);
          const next = firstSelectable(nextMonth, getDay) ?? isoFrom(y, m, 1);
          setActiveIso(next);
          setPendingFocus(next);
        }
        break;
      default:
        break;
    }
  };

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= total; day++) cells.push(isoFrom(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <button
          type="button"
          onClick={() => prevMonth && onMonthChange(prevMonth)}
          disabled={!prevMonth}
          className="min-h-[44px] shrink-0 px-1 text-left text-[0.6rem] uppercase tracking-[0.18em] text-stone/45 transition-colors hover:text-gold disabled:opacity-20 disabled:hover:text-stone/45"
          aria-label={
            prevMonth
              ? `Previous month, ${monthLabel(prevMonth)}`
              : 'Previous month'
          }
        >
          <span aria-hidden="true">&larr;&nbsp;</span>
          {prevMonth ? monthShortLabel(prevMonth).split(' ')[0] : '—'}
        </button>

        <p className="display text-center text-lg tracking-[0.06em] text-stone md:text-xl">
          {monthLabel(monthKey)}
        </p>

        <button
          type="button"
          onClick={() => nextMonth && onMonthChange(nextMonth)}
          disabled={!nextMonth}
          className="min-h-[44px] shrink-0 px-1 text-right text-[0.6rem] uppercase tracking-[0.18em] text-stone/45 transition-colors hover:text-gold disabled:opacity-20 disabled:hover:text-stone/45"
          aria-label={
            nextMonth ? `Next month, ${monthLabel(nextMonth)}` : 'Next month'
          }
        >
          {nextMonth ? monthShortLabel(nextMonth).split(' ')[0] : '—'}
          <span aria-hidden="true">&nbsp;&rarr;</span>
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {monthLabel(monthKey)}
      </p>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`${gridLabel} — ${monthLabel(monthKey)}`}
        aria-readonly={interactive ? undefined : true}
        onKeyDown={onKeyDown}
      >
        <div role="row" className="bk-grid">
          {WEEKDAY_INITIALS.map((initial, i) => (
            <div
              key={`${initial}-${i}`}
              role="columnheader"
              aria-label={DAY_NAMES[i]}
              className="bk-colhead"
            >
              {initial}
            </div>
          ))}
        </div>

        {/* Keyed on the month so a change cross-fades instead of snapping. */}
        <div className="bk-cal bk-swap" key={monthKey}>
          {rows.map((row, rowIndex) => (
            <div role="row" className="bk-grid" key={rowIndex}>
              {row.map((iso, cellIndex) => {
                if (!iso) {
                  return (
                    <div
                      role="gridcell"
                      aria-hidden="true"
                      className="bk-blank"
                      key={`empty-${rowIndex}-${cellIndex}`}
                    />
                  );
                }
                const meta = getDay(iso);
                const day = Number(iso.slice(8));
                const disabled = !meta.selectable;
                const isToday = meta.today ?? (todayIso !== null && iso === todayIso);

                const content = (
                  <>
                    <span>{day}</span>
                    <span
                      className="bk-dot"
                      aria-hidden="true"
                      style={
                        meta.state === 'open' ||
                        meta.state === 'limited' ||
                        meta.state === 'full'
                          ? undefined
                          : {opacity: 0}
                      }
                    />
                  </>
                );

                const stateProps = {
                  'data-state': meta.state,
                  'data-span': meta.span,
                  'data-pattern': meta.pattern ? 'true' : undefined,
                  'data-selected': meta.selected ? 'true' : undefined,
                  'data-selectable': meta.selectable ? 'true' : undefined,
                  'data-today': isToday ? 'true' : undefined,
                } as const;

                if (!interactive) {
                  return (
                    <div
                      role="gridcell"
                      key={iso}
                      className="bk-cell"
                      {...stateProps}
                      aria-label={meta.label}
                    >
                      {content}
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={iso}
                    data-iso={iso}
                    className="bk-cell"
                    {...stateProps}
                    aria-label={meta.label}
                    aria-selected={meta.selected ? true : undefined}
                    aria-disabled={disabled || undefined}
                    tabIndex={iso === activeIso ? 0 : -1}
                    onFocus={() => setActiveIso(iso)}
                    onClick={() => {
                      if (disabled) return;
                      onSelect?.(iso);
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {footer ? <div className="mt-5">{footer}</div> : null}
    </div>
  );
}

function firstSelectable(
  monthKey: string,
  getDay: (iso: string) => DayMeta,
): string | null {
  const {year, month} = splitMonthKey(monthKey);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoFrom(year, month, day);
    if (getDay(iso).selectable) return iso;
  }
  return null;
}

/** Shared legend so every calendar mode reads the same way. */
export function AvailabilityLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.65rem] uppercase tracking-[0.16em] text-stone/45">
      <li className="flex items-center gap-2">
        <span
          className="inline-block h-[5px] w-[5px] rounded-full bg-gold"
          aria-hidden="true"
        />
        Open
      </li>
      <li className="flex items-center gap-2">
        <span
          className="inline-block h-[6px] w-[6px] rounded-full border border-gold"
          aria-hidden="true"
        />
        One left
      </li>
      <li className="flex items-center gap-2">
        <span
          className="inline-block h-px w-[9px] bg-stone/50"
          aria-hidden="true"
        />
        Booked
      </li>
    </ul>
  );
}
