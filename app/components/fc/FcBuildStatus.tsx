/**
 * The anticipation device. No invented launch date — a build rail instead:
 * what is finished, what is being worked, what is still ahead. State is
 * announced in text as well as colour, so it is not carried by hue alone.
 *
 * Type sizes and vertical rhythm use the `.t-*` / `.stack-*` scales from
 * fc.css rather than Tailwind utilities — see the cascade note at the top of
 * app/styles/fc.css.
 */
export type FcStepState = 'done' | 'active' | 'next';

export interface FcStep {
  label: string;
  detail: string;
  state: FcStepState;
}

const STATE_WORD: Record<FcStepState, string> = {
  done: 'Done',
  active: 'In progress',
  next: 'Up next',
};

export function FcBuildStatus({
  steps,
  target,
}: {
  steps: FcStep[];
  target: string;
}) {
  return (
    <div>
      <ol className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li
            key={step.label}
            data-reveal
            style={{'--reveal-delay': `${i * 110}ms`} as React.CSSProperties}
          >
            <div className="fc-step-line" data-state={step.state} />

            <div className="mt-4 flex items-baseline gap-3">
              <span className="fc-label tabular text-fc-chalk/55">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`fc-label ${
                  step.state === 'next' ? 'text-fc-chalk/55' : 'text-fc-green'
                }`}
              >
                {step.state === 'active' ? (
                  <>
                    <span
                      aria-hidden
                      className="fc-blip mr-2 inline-block h-[7px] w-[7px] translate-y-[-1px] rotate-45 bg-fc-green align-middle"
                    />
                    {STATE_WORD[step.state]}
                  </>
                ) : (
                  STATE_WORD[step.state]
                )}
              </span>
            </div>

            <h3
              className={`fc-display t-title stack-sm ${
                step.state === 'next' ? 'text-fc-chalk/70' : 'text-fc-chalk'
              }`}
            >
              {step.label}
            </h3>

            <p className="fc-body t-copy-sm stack-xs max-w-[30ch] text-fc-chalk/65">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>

      <div
        data-reveal
        className="mt-14 flex flex-col gap-3 border-t pt-6 rule-light sm:flex-row sm:items-baseline sm:justify-between"
      >
        <p className="fc-display t-lead text-fc-chalk">
          Target window
          <span className="tabular ml-4 text-fc-green">{target}</span>
        </p>
        <p className="fc-body t-copy-sm max-w-[46ch] text-fc-chalk/60">
          A target, not a promise. We open when the room is ready and the
          coaches are in it — not a day sooner.
        </p>
      </div>
    </div>
  );
}
