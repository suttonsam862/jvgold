import {useMemo} from 'react';
import {MonthGrid} from './MonthGrid';
import type {DayMeta} from './MonthGrid';
import {
  addDaysIso,
  campById,
  formatDateRange,
  formatLongDate,
  formatMediumDate,
  formatMoney,
  isScarce,
  isoInRange,
} from '~/lib/offerings';
import type {Camp, CampOffering} from '~/lib/offerings';

interface CampPickerProps {
  offering: CampOffering;
  months: string[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  campId: string | null;
  onPickCamp: (camp: Camp) => void;
  todayIso: string | null;
}

export function CampPicker({
  offering,
  months,
  monthKey,
  onMonthChange,
  campId,
  onPickCamp,
  todayIso,
}: CampPickerProps) {
  const camp = campById(offering, campId);

  const getDay = useMemo(() => {
    return (iso: string): DayMeta => {
      const isPast = todayIso !== null && iso < todayIso;
      if (camp && isoInRange(iso, camp.startIso, camp.endIso)) {
        const span =
          iso === camp.startIso
            ? 'start'
            : iso === camp.endIso
              ? 'end'
              : 'inside';
        return {
          state: 'open',
          selectable: false,
          span,
          label: `${formatLongDate(iso)} — ${camp.name}`,
        };
      }
      const otherCamp = offering.camps.find((c) =>
        isoInRange(iso, c.startIso, c.endIso),
      );
      return {
        state: isPast ? 'past' : otherCamp ? 'limited' : 'closed',
        selectable: false,
        label: otherCamp
          ? `${formatLongDate(iso)} — ${otherCamp.name}`
          : formatLongDate(iso),
      };
    };
  }, [camp, offering.camps, todayIso]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div>
        <p className="tag text-gold">THE CAMP CALENDAR</p>
        <p
          role="status"
          className="mt-3 border border-gold/25 bg-gold/[0.07] px-3 py-2 text-[0.6rem] uppercase leading-relaxed tracking-[0.18em] text-gold"
        >
          Sample availability — spot counts are illustrative until live capacity
          is connected.
        </p>
        <ul className="mt-5 flex flex-col gap-4">
          {offering.camps.map((c) => {
            const selected = c.id === campId;
            const full = c.spotsRemaining === 0;
            const past = todayIso !== null && c.endIso < todayIso;
            const disabled = full || past;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => !disabled && onPickCamp(c)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className="bk-option flex w-full flex-col gap-4 p-6"
                >
                  <span className="flex flex-wrap items-start justify-between gap-3">
                    <span className="flex flex-col gap-2 text-left">
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                        {formatDateRange(c.startIso, c.endIso)} · {c.location}
                      </span>
                      <span
                        className={`display text-xl tracking-[0.03em] ${selected ? 'text-gold' : 'text-stone'}`}
                      >
                        {c.name}
                      </span>
                    </span>
                    <span className="flex flex-col items-start gap-1 sm:items-end">
                      <span className="display bk-money text-xl text-stone">
                        {formatMoney(c.price)}
                      </span>
                      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-gold">
                        {formatMoney(c.deposit)} deposit
                      </span>
                    </span>
                  </span>

                  <span className="text-left text-sm leading-relaxed text-stone/60">
                    {c.summary}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.65rem] uppercase tracking-[0.16em]">
                    <span className="text-stone/45">
                      {c.nights + 1} days · {c.nights} nights
                    </span>
                    <span
                      className={
                        full
                          ? 'text-stone/45'
                          : isScarce(c.spotsRemaining, c.capacity)
                            ? 'text-gold'
                            : 'text-stone/45'
                      }
                    >
                      {full
                        ? 'Full — waitlist'
                        : isScarce(c.spotsRemaining, c.capacity)
                          ? `${c.spotsRemaining} spots left`
                          : `${c.spotsRemaining} of ${c.capacity} open`}
                    </span>
                  </span>

                  <span className="bk-meter" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.round(((c.capacity - c.spotsRemaining) / c.capacity) * 100)}%`,
                      }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-stone/45">
          A camp that reads <em className="not-italic text-stone/70">Full</em> can
          still take a waitlist — say so in the notes on the next step and
          Jesse will call you the moment a bed opens.
        </p>
      </div>

      <div className="border-t bk-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <MonthGrid
          gridLabel="Camp dates"
          todayIso={todayIso}
          monthKey={monthKey}
          months={months}
          onMonthChange={onMonthChange}
          getDay={getDay}
          footer={
            camp ? (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="tag text-gold">{camp.name.toUpperCase()}</p>
                  <p className="display mt-3 text-xl text-stone">
                    {formatDateRange(camp.startIso, camp.endIso)}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {camp.includes.map((item) => (
                    <li
                      key={item}
                      className="flex items-baseline gap-2 text-sm leading-relaxed text-stone/65"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-[8px] w-[4px] shrink-0 -skew-x-[30deg] bg-gold"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <dl className="grid gap-3 border-t bk-hairline pt-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                      Deposit due now
                    </dt>
                    <dd className="display bk-money mt-2 text-2xl text-gold">
                      {formatMoney(camp.deposit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                      Balance
                    </dt>
                    <dd className="bk-money mt-2 text-sm text-stone/70">
                      {formatMoney(camp.price - camp.deposit)} due{' '}
                      {formatMediumDate(
                        addDaysIso(camp.startIso, -offering.balanceDueDaysBefore),
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-stone/55">
                Choose a camp and the whole block lights up here — every night
                accounted for before you put money down.
              </p>
            )
          }
        />
      </div>
    </div>
  );
}
