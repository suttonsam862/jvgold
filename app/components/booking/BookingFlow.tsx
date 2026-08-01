import {useEffect, useMemo, useRef, useState} from 'react';
import {CampPicker} from './CampPicker';
import {ClinicPicker} from './ClinicPicker';
import {Confirmation} from './Confirmation';
import {OfferingSelector} from './OfferingSelector';
import {PackageBuilder} from './PackageBuilder';
import {RequestForm} from './RequestForm';
import {SingleDateScheduler} from './SingleDateScheduler';
import {STEPS, Stepper} from './Stepper';
import type {StepId} from './Stepper';
import {SummaryPanel} from './SummaryPanel';
import {
  EMPTY_DETAILS,
  EMPTY_SELECTION,
  SEASON_LABEL,
  formatMoney,
  getOffering,
  isoOf,
  monthKeyFromIso,
  quoteFor,
  referenceCode,
  seasonMonths,
} from '~/lib/offerings';
import type {
  AthleteDetails,
  BookingSelection,
  Camp,
  Offering,
  TimeBandId,
} from '~/lib/offerings';

export function BookingFlow() {
  const months = useMemo(() => seasonMonths(), []);
  const [step, setStep] = useState<StepId>('offering');
  const [selection, setSelection] = useState<BookingSelection>({
    ...EMPTY_SELECTION,
    startMonth: months[0],
  });
  const [monthKey, setMonthKey] = useState<string>(months[0]);
  const [details, setDetails] = useState<AthleteDetails>(EMPTY_DETAILS);
  const [reference, setReference] = useState<string>('');
  /** Mobile only: the action bar's receipt drawer. */
  const [barOpen, setBarOpen] = useState(false);

  /**
   * Today is resolved after hydration only. The server and the browser can sit
   * on opposite sides of midnight, so the first client render must match the
   * server's — past dates simply grey out a beat later.
   */
  const [todayIso, setTodayIso] = useState<string | null>(null);
  useEffect(() => {
    setTodayIso(isoOf(new Date()));
  }, []);

  const offering = getOffering(selection.offeringId);
  const quote = useMemo(() => quoteFor(selection), [selection]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (step !== 'done') headingRef.current?.focus();
  }, [step]);

  // The mobile action bar only exists while the flow itself is on screen.
  const flowRef = useRef<HTMLDivElement>(null);
  const [flowVisible, setFlowVisible] = useState(false);
  useEffect(() => {
    const node = flowRef.current;
    // Without an observer the bar would never appear, so fail open: the
    // action bar is the primary mobile CTA and must not depend on IO.
    if (!node || typeof IntersectionObserver === 'undefined') {
      setFlowVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setFlowVisible(entry.isIntersecting),
      {rootMargin: '-10% 0px -10% 0px'},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chooseOffering = (next: Offering) => {
    setSelection(() => {
      const base: BookingSelection = {
        ...EMPTY_SELECTION,
        offeringId: next.id,
        startMonth: months[0],
      };
      if (next.mode === 'camp-block' && next.camps.length > 0) {
        return {...base, campId: null};
      }
      return base;
    });
    setMonthKey(
      next.mode === 'camp-block' && next.camps.length > 0
        ? monthKeyFromIso(next.camps[0].startIso)
        : months[0],
    );
    setBarOpen(false);
    setStep('schedule');
  };

  const reachable: StepId[] = ['offering'];
  if (selection.offeringId) reachable.push('schedule');
  if (quote.complete && step !== 'done') reachable.push('details');

  const requireDepositTerms = offering?.mode === 'camp-block';
  const depositTerms = requireDepositTerms
    ? `I understand the ${formatMoney(quote.dueNow)} deposit reserves the spot and is non-refundable inside 21 days of camp, and that the ${formatMoney(quote.balance ?? 0)} balance is due before the first day.`
    : '';

  const handleSubmit = (submitted: AthleteDetails) => {
    setDetails(submitted);
    setReference(referenceCode(selection, submitted));
    setStep('done');
    // Focus lands on the confirmation heading inside <Confirmation/>.
  };

  const reset = () => {
    setSelection({...EMPTY_SELECTION, startMonth: months[0]});
    setMonthKey(months[0]);
    setDetails(EMPTY_DETAILS);
    setReference('');
    setBarOpen(false);
    setStep('offering');
  };

  const showRail = step === 'schedule' || step === 'details';

  return (
    <div className="bk" ref={flowRef}>
      <div className="flex flex-col gap-6 border-b bk-hairline pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="tag text-gold">THE CALENDAR</p>
          <h2 className="display mt-4 text-[clamp(2rem,5vw,3.6rem)] text-stone">
            Book your time
          </h2>
        </div>
        <Stepper current={step} reachable={reachable} onGo={setStep} />
      </div>

      <div className={showRail ? 'grid gap-12 pt-10 xl:grid-cols-[minmax(0,1fr)_360px]' : 'pt-10'}>
        <div className="min-w-0">
          {step === 'offering' ? (
            <section className="bk-step-enter" aria-labelledby="bk-step-heading">
              <h3
                id="bk-step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="display text-xl tracking-[0.04em] text-stone outline-none"
              >
                01 — Choose how you want to train
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone/55">
                Six ways into the room, from a single hour to a full residential
                camp. Everything downstream — the calendar, the availability, the
                price math — reshapes itself around this choice.
              </p>
              <div className="mt-8">
                <OfferingSelector
                  selectedId={selection.offeringId}
                  onSelect={chooseOffering}
                />
              </div>
              <p className="mt-6 text-[0.65rem] uppercase tracking-[0.16em] text-stone/35">
                Provisional rates for the {SEASON_LABEL} — confirmed with Jesse
                before any payment is taken
              </p>
            </section>
          ) : null}

          {step === 'schedule' && offering ? (
            <section className="bk-step-enter" aria-labelledby="bk-step-heading">
              <h3
                id="bk-step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="display text-xl tracking-[0.04em] text-stone outline-none"
              >
                02 — {offering.scheduleHeading}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone/55">
                {offering.scheduleHint}
              </p>

              <div className="bk-swap mt-9" key={offering.id}>
                {offering.mode === 'single-date' ? (
                  <SingleDateScheduler
                    offering={offering}
                    months={months}
                    monthKey={monthKey}
                    onMonthChange={setMonthKey}
                    dateIso={selection.dateIso}
                    slotId={selection.slotId}
                    todayIso={todayIso}
                    onPickDate={(iso) =>
                      setSelection((s) => ({...s, dateIso: iso, slotId: null}))
                    }
                    onPickSlot={(slotId) =>
                      setSelection((s) => ({...s, slotId}))
                    }
                  />
                ) : null}

                {offering.mode === 'session-list' ? (
                  <ClinicPicker
                    offering={offering}
                    sessionIds={selection.sessionIds}
                    todayIso={todayIso}
                    onToggleSession={(id) =>
                      setSelection((s) => ({
                        ...s,
                        sessionIds: s.sessionIds.includes(id)
                          ? s.sessionIds.filter((x) => x !== id)
                          : [...s.sessionIds, id],
                      }))
                    }
                  />
                ) : null}

                {offering.mode === 'weekly-pattern' ? (
                  <PackageBuilder
                    offering={offering}
                    months={months}
                    weekdays={selection.weekdays}
                    bandId={selection.bandId}
                    startMonth={selection.startMonth}
                    todayIso={todayIso}
                    onToggleWeekday={(day) =>
                      setSelection((s) => ({
                        ...s,
                        weekdays: s.weekdays.includes(day)
                          ? s.weekdays.filter((d) => d !== day)
                          : [...s.weekdays, day].sort((a, b) => a - b),
                      }))
                    }
                    onPickTier={(weekdays: number[]) =>
                      setSelection((s) => ({...s, weekdays}))
                    }
                    onPickBand={(bandId: TimeBandId) =>
                      setSelection((s) => ({...s, bandId}))
                    }
                    onPickStartMonth={(startMonth) =>
                      setSelection((s) => ({...s, startMonth}))
                    }
                  />
                ) : null}

                {offering.mode === 'camp-block' ? (
                  <CampPicker
                    offering={offering}
                    months={months}
                    monthKey={monthKey}
                    onMonthChange={setMonthKey}
                    campId={selection.campId}
                    todayIso={todayIso}
                    onPickCamp={(camp: Camp) => {
                      setSelection((s) => ({...s, campId: camp.id}));
                      setMonthKey(monthKeyFromIso(camp.startIso));
                    }}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {step === 'details' && offering ? (
            <section className="bk-step-enter" aria-labelledby="bk-step-heading">
              <h3
                id="bk-step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="display text-xl tracking-[0.04em] text-stone outline-none"
              >
                03 — Who is training
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone/55">
                Six fields, then you&rsquo;re done. Waivers, medical forms and
                camp packets come after Jesse confirms — not before.
              </p>
              <div className="mt-9">
                <RequestForm
                  quote={quote}
                  requireDepositTerms={Boolean(requireDepositTerms)}
                  depositTerms={depositTerms}
                  onSubmit={handleSubmit}
                  onBack={() => setStep('schedule')}
                />
              </div>
            </section>
          ) : null}

          {step === 'done' && offering ? (
            <Confirmation
              offering={offering}
              quote={quote}
              details={details}
              reference={reference}
              onBookAnother={reset}
            />
          ) : null}
        </div>

        {showRail ? (
          <div className="min-w-0">
            <div className="xl:sticky xl:top-24">
              <SummaryPanel
                offering={offering}
                quote={quote}
                primaryLabel="Continue"
                showPrimary={step === 'schedule'}
                onPrimary={() => setStep('details')}
                onChangeOffering={() => setStep('offering')}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile action bar — one thumb, one decision, the money always in
          reach. Tapping the figure opens the same receipt the desktop rail
          shows, so nothing is hidden behind a scroll on a phone. */}
      {step === 'schedule' && offering && flowVisible ? (
        <div className="bk-bar fixed inset-x-0 bottom-0 z-40 border-t border-stone/15 bg-onyx-deep/95 px-5 pt-3 backdrop-blur xl:hidden">
          {barOpen ? (
            <div
              id="bk-bar-sheet"
              className="bk-sheet mx-auto mb-3 max-h-[42vh] max-w-[1440px] overflow-y-auto border-b bk-hairline pb-4"
            >
              {quote.schedule.length > 0 ? (
                <dl className="flex flex-col gap-2">
                  {quote.schedule.map((line) => (
                    <div
                      key={line.label + line.value}
                      className="flex gap-4 text-left"
                    >
                      <dt className="w-20 shrink-0 text-[0.58rem] uppercase tracking-[0.16em] text-stone/40">
                        {line.label}
                      </dt>
                      <dd className="bk-money min-w-0 text-xs leading-snug text-stone/75">
                        {line.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {quote.cadence === 'deposit' && quote.balance !== null ? (
                <div className="mt-3 flex flex-col gap-2 border-t bk-hairline pt-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[0.58rem] uppercase tracking-[0.16em] text-stone/45">
                      Balance
                      {quote.balanceDueDate ? ` due ${quote.balanceDueDate}` : ''}
                    </span>
                    <span className="bk-money shrink-0 text-sm text-stone/80">
                      {formatMoney(quote.balance)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[0.58rem] uppercase tracking-[0.16em] text-stone/40">
                      {quote.totalLabel}
                    </span>
                    <span className="bk-money shrink-0 text-xs text-stone/60">
                      {formatMoney(quote.total)}
                    </span>
                  </div>
                </div>
              ) : null}

              <p className="mt-3 text-[0.68rem] leading-relaxed text-stone/45">
                {quote.terms}
              </p>
            </div>
          ) : null}

          <div className="mx-auto flex max-w-[1440px] items-center gap-3">
            <button
              type="button"
              onClick={() => setBarOpen((open) => !open)}
              aria-expanded={barOpen}
              aria-controls="bk-bar-sheet"
              className="min-h-[52px] min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-[0.58rem] uppercase tracking-[0.18em] text-gold">
                {quote.dueLabel}
              </span>
              <span className="display bk-money block truncate text-lg text-stone">
                {formatMoney(quote.dueNow)}
                {quote.cadence === 'monthly' ? (
                  <span className="ml-1 text-xs text-stone/50">/mo</span>
                ) : null}
                <span className="ml-3 text-[0.58rem] font-normal uppercase tracking-[0.16em] text-stone/45 underline decoration-stone/25 underline-offset-4">
                  {barOpen ? 'Hide breakdown' : 'Breakdown'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStep('details')}
              disabled={!quote.complete}
              className="display min-h-[52px] shrink-0 bg-gold px-6 text-[0.72rem] tracking-[0.16em] text-onyx-deep transition-colors hover:bg-stone disabled:bg-stone/15 disabled:text-stone/40"
            >
              Continue
            </button>
          </div>
          {!quote.complete ? (
            <p className="mt-2 text-center text-[0.58rem] uppercase leading-relaxed tracking-[0.16em] text-stone/40">
              {quote.nextHint}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        Step {STEPS.findIndex((s) => s.id === step) + 1} of {STEPS.length}
      </p>
    </div>
  );
}
