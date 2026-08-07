import {useMemo} from 'react';
import {MonthGrid} from './MonthGrid';
import type {DayMeta} from './MonthGrid';
import {
  campDayOptions,
  campDatesLabel,
  campDepositLabel,
  campEndIso,
  campPricing,
  campTotal,
  canStartCampOn,
  formatLongDate,
  formatMoney,
  isoInRange,
} from '~/lib/offerings';
import type {CampOffering} from '~/lib/offerings';

interface CampPickerProps {
  offering: CampOffering;
  months: string[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  startIso: string | null;
  days: number;
  onPickStart: (iso: string) => void;
  onPickDays: (days: number) => void;
  todayIso: string | null;
}

/**
 * A camp is a booking of Jesse, not a ticket sold to a parent. The host picks
 * how many consecutive days they want him and where day one falls; the total
 * is the day rate multiplied out, recomputed on every change.
 */
export function CampPicker({
  offering,
  months,
  monthKey,
  onMonthChange,
  startIso,
  days,
  onPickStart,
  onPickDays,
  todayIso,
}: CampPickerProps) {
  const dayOptions = useMemo(() => campDayOptions(offering), [offering]);
  // Total, deposit, balance and the balance due date all come off one engine
  // object, so the picker cannot quote a balance the receipt disagrees with.
  const pricing = campPricing(offering, days, startIso);
  const {total, deposit} = pricing;
  const endIso = startIso ? campEndIso(startIso, days) : null;

  const getDay = useMemo(() => {
    return (iso: string): DayMeta => {
      const isPast = todayIso !== null && iso < todayIso;
      const bookable = canStartCampOn(iso, days, todayIso);

      if (startIso && endIso && isoInRange(iso, startIso, endIso)) {
        const span =
          iso === startIso ? 'start' : iso === endIso ? 'end' : 'inside';
        const which =
          iso === startIso
            ? 'day one'
            : iso === endIso
              ? `final day`
              : 'camp day';
        return {
          state: 'open',
          selectable: bookable,
          selected: iso === startIso,
          span,
          label: `${formatLongDate(iso)} — ${which} of a ${days}-day booking`,
        };
      }

      return {
        state: isPast ? 'past' : bookable ? 'open' : 'closed',
        selectable: bookable,
        label: bookable
          ? `${formatLongDate(iso)} — start a ${days}-day booking here, ${formatMoney(total)}`
          : `${formatLongDate(iso)} — not available as day one`,
      };
    };
  }, [days, endIso, startIso, todayIso, total]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div className="flex flex-col gap-10">
        <div>
          <p className="tag text-gold">HOW MANY DAYS</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stone/55">
            You are booking Jesse, not a seat. The rate is{' '}
            {formatMoney(offering.dayRate)} for every consecutive day he is on
            your mats — however many athletes you put in front of him.
          </p>

          <div
            role="group"
            aria-label="Number of consecutive days"
            className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5"
          >
            {dayOptions.map((option) => {
              const on = option === days;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onPickDays(option)}
                  aria-pressed={on}
                  aria-label={`${option} consecutive day${option === 1 ? '' : 's'}, ${formatMoney(
                    campTotal(offering, option),
                  )}`}
                  className={`bk-option flex min-h-[64px] flex-col items-center justify-center gap-1 px-2 py-3 ${
                    on ? 'text-gold' : 'text-stone/70'
                  }`}
                >
                  <span className="display bk-money text-lg leading-none">
                    {option}
                  </span>
                  <span className="bk-money text-[0.6rem] uppercase tracking-[0.12em] text-stone/45">
                    {formatMoney(campTotal(offering, option))}
                  </span>
                </button>
              );
            })}
          </div>

          <p
            role="status"
            className="mt-4 text-[0.65rem] uppercase tracking-[0.16em] text-stone/45"
          >
            {days} consecutive day{days === 1 ? '' : 's'} ·{' '}
            {formatMoney(offering.dayRate)} × {days} ={' '}
            <span className="text-gold">{formatMoney(total)}</span>
          </p>
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-stone/40">
            Longer bookings are arranged directly — say so in the notes.
          </p>
        </div>

        <div className="grid gap-8 border-t bk-hairline pt-8 sm:grid-cols-2">
          <div>
            <p className="tag text-gold">WHAT A DAY HOLDS</p>
            <ul className="mt-4 flex flex-col gap-2">
              {offering.dayFormat.map((item) => (
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
          </div>
          <div>
            <p className="tag text-gold">WHAT THE HOST BRINGS</p>
            <ul className="mt-4 flex flex-col gap-2">
              {offering.hostProvides.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-2 text-sm leading-relaxed text-stone/65"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-[8px] w-[4px] shrink-0 -skew-x-[30deg] bg-stone/40"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t bk-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <p className="tag text-gold">DAY ONE</p>
        <p
          role="status"
          className="mt-3 border border-gold/25 bg-gold/[0.07] px-3 py-2 text-[0.6rem] uppercase leading-relaxed tracking-[0.18em] text-gold"
        >
          Sample availability — open dates are confirmed with Jesse before
          anything is charged.
        </p>
        <div className="mt-5">
          <MonthGrid
            gridLabel="Camp start date"
            todayIso={todayIso}
            monthKey={monthKey}
            months={months}
            onMonthChange={onMonthChange}
            getDay={getDay}
            onSelect={onPickStart}
            footer={
              startIso && endIso ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="tag text-gold">THE BLOCK</p>
                    <p className="display mt-3 text-xl text-stone">
                      {campDatesLabel(startIso, days)}
                    </p>
                    <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-stone/45">
                      {days} consecutive day{days === 1 ? '' : 's'} at{' '}
                      {formatMoney(offering.dayRate)} a day
                    </p>
                  </div>
                  <dl className="grid gap-3 border-t bk-hairline pt-5 sm:grid-cols-2">
                    <div>
                      <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                        Deposit ({campDepositLabel(offering)})
                      </dt>
                      <dd className="display bk-money mt-2 text-2xl text-gold">
                        {formatMoney(deposit)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                        Balance
                      </dt>
                      <dd className="bk-money mt-2 text-sm text-stone/70">
                        {formatMoney(pricing.balance)}
                        {pricing.balanceDueLabel
                          ? ` due ${pricing.balanceDueLabel}`
                          : ''}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-stone/55">
                  Choose the first day and the whole block lights up here — every
                  day accounted for before you put money down.
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
