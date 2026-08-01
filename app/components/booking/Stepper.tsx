export type StepId = 'offering' | 'schedule' | 'details' | 'done';

export const STEPS: {id: StepId; label: string}[] = [
  {id: 'offering', label: 'Session type'},
  {id: 'schedule', label: 'Date & time'},
  {id: 'details', label: 'Your details'},
  {id: 'done', label: 'Confirmed'},
];

interface StepperProps {
  current: StepId;
  /** Steps the athlete has already satisfied and may jump back to. */
  reachable: StepId[];
  onGo: (step: StepId) => void;
}

export function Stepper({current, reachable, onGo}: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Booking steps">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-4">
        {STEPS.map((step, i) => {
          const isCurrent = step.id === current;
          const isDone = i < currentIndex;
          const canGo = reachable.includes(step.id) && !isCurrent;
          return (
            <li key={step.id} className="flex items-center gap-2 sm:gap-4">
              {canGo ? (
                <button
                  type="button"
                  onClick={() => onGo(step.id)}
                  className="flex items-baseline gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-stone/55 transition-colors hover:text-gold"
                >
                  <span className="bk-money">{String(i + 1).padStart(2, '0')}</span>
                  <span>{step.label}</span>
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-baseline gap-2 text-[0.65rem] uppercase tracking-[0.18em] ${
                    isCurrent
                      ? 'text-gold'
                      : isDone
                        ? 'text-stone/55'
                        : 'text-stone/30'
                  }`}
                >
                  <span className="bk-money">{String(i + 1).padStart(2, '0')}</span>
                  <span>{step.label}</span>
                </span>
              )}
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px w-5 sm:w-10 ${i < currentIndex ? 'bg-gold/60' : 'bg-stone/20'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
