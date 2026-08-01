import {useMemo} from 'react';
import {AvailabilityLegend, MonthGrid} from './MonthGrid';
import type {DayMeta} from './MonthGrid';
import {
  dayAccessibleName,
  dayAvailability,
  daysInMonth,
  formatLongDate,
  isoFrom,
  slotsFor,
  splitMonthKey,
} from '~/lib/offerings';
import type {SingleDateOffering} from '~/lib/offerings';

interface SingleDateSchedulerProps {
  offering: SingleDateOffering;
  months: string[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  dateIso: string | null;
  slotId: string | null;
  onPickDate: (iso: string) => void;
  onPickSlot: (slotId: string) => void;
  /** Set after hydration; null during SSR so nothing is gated on JS. */
  todayIso: string | null;
}

export function SingleDateScheduler({
  offering,
  months,
  monthKey,
  onMonthChange,
  dateIso,
  slotId,
  onPickDate,
  onPickSlot,
  todayIso,
}: SingleDateSchedulerProps) {
  const getDay = useMemo(() => {
    return (iso: string): DayMeta => {
      const info = dayAvailability(offering, iso);
      const isPast = todayIso !== null && iso < todayIso;
      if (isPast) {
        return {
          state: 'past',
          selectable: false,
          label: `${formatLongDate(iso)} — past`,
        };
      }
      return {
        state: info.state,
        selectable: info.state === 'open' || info.state === 'limited',
        selected: dateIso === iso,
        label: dayAccessibleName(iso, info),
      };
    };
  }, [offering, dateIso, todayIso]);

  const nextOpening = useMemo(
    () => findNextOpening(offering, months, todayIso),
    [offering, months, todayIso],
  );

  const slots = dateIso ? slotsFor(offering, dateIso) : [];
  const openCount = slots.filter((s) => !s.taken).length;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div>
        <MonthGrid
          gridLabel={`${offering.name} availability`}
          todayIso={todayIso}
          monthKey={monthKey}
          months={months}
          onMonthChange={onMonthChange}
          getDay={getDay}
          onSelect={onPickDate}
          footer={
            <div className="flex flex-col gap-4">
              <AvailabilityLegend />
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone/40">
                {offering.availabilityNote}
              </p>
              {nextOpening && nextOpening !== dateIso ? (
                <button
                  type="button"
                  onClick={() => {
                    onMonthChange(nextOpening.slice(0, 7));
                    onPickDate(nextOpening);
                  }}
                  className="tag min-h-[44px] self-start text-left text-gold transition-colors hover:text-stone"
                >
                  NEXT OPENING — {formatLongDate(nextOpening).toUpperCase()}
                </button>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="min-h-[22rem] border-t bk-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        {/* The outcome of picking a date, announced once, quietly. */}
        <p className="sr-only" aria-live="polite">
          {dateIso
            ? `${formatLongDate(dateIso)} selected — ${openCount} of ${slots.length} times open`
            : 'No date selected yet'}
        </p>
        {!dateIso ? (
          <div>
            <p className="tag text-gold">AWAITING A DATE</p>
            <p className="display mt-4 text-2xl text-stone">
              Choose a day to see open times
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone/55">
              {offering.scheduleHint}
            </p>
          </div>
        ) : (
          /* Keyed on the date so the times cross-fade in rather than snap. */
          <div className="bk-swap" key={dateIso}>
            <p className="tag text-gold">{formatLongDate(dateIso).toUpperCase()}</p>
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <h4 className="display text-2xl text-stone">Open times</h4>
              <p className="bk-money text-[0.65rem] uppercase tracking-[0.16em] text-stone/45">
                {openCount} of {slots.length} open
              </p>
            </div>

            {slots.length === 0 ? (
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-stone/55">
                Jesse doesn&rsquo;t hold {offering.name.toLowerCase()} sessions on
                this day. {offering.availabilityNote}.
              </p>
            ) : openCount === 0 ? (
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-stone/55">
                Every hour on this date is taken. Try the next open day — or add a
                note at the end and Jesse will call you if something opens.
              </p>
            ) : (
              <ul className="mt-6 flex flex-col gap-3">
                {slots.map((slot) => {
                  const selected = slot.id === slotId;
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        onClick={() => !slot.taken && onPickSlot(slot.id)}
                        disabled={slot.taken}
                        aria-pressed={selected}
                        className={`bk-option flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 ${
                          selected ? 'text-stone' : 'text-stone/85'
                        }`}
                      >
                        <span className="display bk-money text-base tracking-[0.06em]">
                          {slot.label}
                        </span>
                        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone/45">
                          {slot.taken
                            ? 'Booked'
                            : `${offering.minutes} min · ${offering.athletes > 1 ? '2 athletes' : '1 athlete'}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function findNextOpening(
  offering: SingleDateOffering,
  months: string[],
  todayIso: string | null,
): string | null {
  for (const key of months) {
    const {year, month} = splitMonthKey(key);
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const iso = isoFrom(year, month, day);
      if (todayIso !== null && iso < todayIso) continue;
      const info = dayAvailability(offering, iso);
      if (info.state === 'open' || info.state === 'limited') return iso;
    }
  }
  return null;
}
