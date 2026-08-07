import {useMemo} from 'react';
import {MonthGrid} from './MonthGrid';
import type {DayMeta} from './MonthGrid';
import {
  formatLongDate,
  formatMediumDate,
  formatMoney,
  monthLabel,
  packagePricing,
  tierPricing,
} from '~/lib/offerings';
import type {
  PackageTier,
  SubscriptionTerm,
  TimeBandId,
  WeeklyPatternOffering,
} from '~/lib/offerings';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Sensible default weeks when an athlete picks a tier instead of days. */
const TIER_PATTERNS: Record<string, number[]> = {
  'two-day': [2, 4],
  'three-day': [1, 3, 5],
  'gold-standard': [1, 2, 3, 4, 6],
};

interface PackageBuilderProps {
  offering: WeeklyPatternOffering;
  months: string[];
  weekdays: number[];
  bandId: TimeBandId | null;
  startMonth: string;
  /** The commitment chosen upstairs. Every rate on this screen bends to it. */
  term: SubscriptionTerm;
  onToggleWeekday: (weekday: number) => void;
  onPickTier: (weekdays: number[]) => void;
  onPickBand: (band: TimeBandId) => void;
  onPickStartMonth: (monthKey: string) => void;
  todayIso: string | null;
}

export function PackageBuilder({
  offering,
  months,
  weekdays,
  bandId,
  startMonth,
  term,
  onToggleWeekday,
  onPickTier,
  onPickBand,
  onPickStartMonth,
  todayIso,
}: PackageBuilderProps) {
  // The tier the chosen days unlock, the dates that pattern generates, and the
  // priced tier under the chosen term — one engine call, the same one
  // `quoteFor()` uses. Nothing on this screen multiplies a rate itself.
  const {tier, dates, pricing} = useMemo(
    () => packagePricing(offering, weekdays, startMonth, term),
    [offering, weekdays, startMonth, term],
  );

  const getDay = useMemo(() => {
    const set = new Set(dates);
    return (iso: string): DayMeta => {
      const inPattern = set.has(iso);
      const isPast = todayIso !== null && iso < todayIso;
      return {
        state: isPast ? 'past' : inPattern ? 'open' : 'closed',
        selectable: false,
        pattern: inPattern && !isPast,
        label: inPattern
          ? `${formatLongDate(iso)} — training day`
          : formatLongDate(iso),
      };
    };
  }, [dates, todayIso]);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
      <div className="flex flex-col gap-10">
        {/* 1 — days */}
        <fieldset>
          <legend className="tag text-gold">WHICH DAYS EACH WEEK</legend>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stone/55">
            Standing sessions, same days every week, in the {offering.location}.
            Packages start at {offering.minDays} days.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {offering.weekdayOptions.map((day) => {
              const on = weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onToggleWeekday(day)}
                  aria-pressed={on}
                  aria-label={DAY_FULL[day]}
                  className={`bk-option flex min-h-[56px] items-center justify-center px-2 py-3 text-sm uppercase tracking-[0.14em] ${
                    on ? 'text-gold' : 'text-stone/70'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              );
            })}
          </div>
          <p
            role="status"
            className="mt-3 text-[0.65rem] uppercase tracking-[0.16em] text-stone/40"
          >
            {weekdays.length} day{weekdays.length === 1 ? '' : 's'} selected
            {tier && pricing ? ` — ${tier.name}, ${pricing.rateLabel}` : ''}
          </p>
        </fieldset>

        {/* 2 — tiers */}
        <div>
          <p className="tag text-gold">THE TIERS</p>
          <ul className="mt-5 flex flex-col gap-3">
            {offering.tiers.map((t) => (
              <li key={t.id}>
                <TierRow
                  tier={t}
                  term={term}
                  active={tier?.id === t.id}
                  onSelect={() => onPickTier(TIER_PATTERNS[t.id] ?? [2, 4])}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* 3 — time band */}
        <fieldset>
          <legend className="tag text-gold">PREFERRED TIME</legend>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {offering.bands.map((band) => {
              const on = bandId === band.id;
              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => onPickBand(band.id)}
                  aria-pressed={on}
                  className={`bk-option flex min-h-[56px] flex-col justify-center gap-1 px-4 py-3 ${
                    on ? 'text-gold' : 'text-stone/75'
                  }`}
                >
                  <span className="display text-sm tracking-[0.08em]">
                    {band.label}
                  </span>
                  <span className="text-[0.65rem] uppercase tracking-[0.14em] text-stone/40">
                    {band.window}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[0.65rem] uppercase tracking-[0.16em] text-stone/40">
            Exact times are locked in with Jesse when he confirms.
          </p>
        </fieldset>
      </div>

      {/* preview */}
      <div className="border-t bk-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tag text-gold">YOUR FIRST MONTH</p>
            {tier && pricing ? (
              <>
                {pricing.rate !== pricing.listRate ? (
                  <p className="bk-money mt-3 text-[0.65rem] uppercase tracking-[0.12em] text-stone/40 line-through">
                    {formatMoney(pricing.listRate)} month to month
                  </p>
                ) : null}
                <p className="display bk-money mt-1 text-2xl text-stone">
                  {formatMoney(pricing.rate)}
                  <span className="text-base text-stone/50"> / month</span>
                </p>
                <p className="mt-2 max-w-[24ch] text-[0.62rem] uppercase leading-relaxed tracking-[0.14em] text-stone/40">
                  Recurring — billed every month until cancelled
                  {pricing.perSession !== null
                    ? `, about ${formatMoney(pricing.perSession)} a session`
                    : ''}
                </p>
                {pricing.minCycles !== null ? (
                  <p className="bk-money mt-2 max-w-[24ch] text-[0.62rem] uppercase leading-relaxed tracking-[0.14em] text-gold">
                    {pricing.months}-month minimum ·{' '}
                    {formatMoney(pricing.commitmentTotal)} in total
                  </p>
                ) : null}
              </>
            ) : (
              <p className="display mt-3 text-2xl text-stone">Build your week</p>
            )}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
              Start month
            </span>
            <select
              className="bk-field !min-h-[44px] !py-2 text-sm"
              value={startMonth}
              onChange={(e) => onPickStartMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <MonthGrid
          gridLabel="Generated training days"
          todayIso={todayIso}
          monthKey={startMonth}
          months={months}
          onMonthChange={onPickStartMonth}
          getDay={getDay}
          footer={
            <div>
              {dates.length === 0 ? (
                <p className="text-sm leading-relaxed text-stone/55">
                  Pick your training days and the month fills in — every session
                  is listed before you commit to anything.
                </p>
              ) : (
                <>
                  <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone/45">
                    {dates.length} sessions in {monthLabel(startMonth)} · first on{' '}
                    {formatMediumDate(dates[0])}
                  </p>
                  <ul className="bk-rail mt-4 flex max-h-40 flex-wrap gap-x-4 gap-y-2 overflow-y-auto pr-1">
                    {dates.map((iso) => (
                      <li
                        key={iso}
                        className="bk-money text-[0.7rem] uppercase tracking-[0.12em] text-stone/55"
                      >
                        {formatMediumDate(iso)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}

function TierRow({
  tier,
  term,
  active,
  onSelect,
}: {
  tier: PackageTier;
  term: SubscriptionTerm;
  active: boolean;
  onSelect: () => void;
}) {
  // Priced by the same helper the receipt uses. `tier.monthly` is the list rate
  // and is never printed on its own once a term is attached to it.
  const pricing = tierPricing(tier, term);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="bk-option flex w-full flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
    >
      <span className="flex flex-col gap-2 text-left">
        <span
          className={`display text-lg tracking-[0.04em] ${active ? 'text-gold' : 'text-stone'}`}
        >
          {tier.name}
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone/40">
          {tier.minDays === tier.maxDays
            ? `${tier.minDays} days per week`
            : `${tier.minDays}–${tier.maxDays} days per week`}
        </span>
        <span className="mt-1 flex flex-col gap-1.5">
          {tier.perks.map((perk) => (
            <span
              key={perk}
              className="flex items-baseline gap-2 text-xs leading-relaxed text-stone/60"
            >
              <span
                aria-hidden="true"
                className="inline-block h-[8px] w-[4px] shrink-0 -skew-x-[30deg] bg-gold"
              />
              {perk}
            </span>
          ))}
        </span>
      </span>
      <span className="flex shrink-0 items-baseline gap-1 sm:flex-col sm:items-end">
        {pricing.rate !== pricing.listRate ? (
          <span className="bk-money text-[0.6rem] uppercase tracking-[0.12em] text-stone/40 line-through">
            {formatMoney(pricing.listRate)}
          </span>
        ) : null}
        <span
          className={`display bk-money text-2xl ${active ? 'text-gold' : 'text-stone/80'}`}
        >
          {formatMoney(pricing.rate)}
        </span>
        <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
          per month
        </span>
      </span>
    </button>
  );
}
