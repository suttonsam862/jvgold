import {
  formatLongDate,
  formatMoney,
  isScarce,
} from '~/lib/offerings';
import type {SessionListOffering} from '~/lib/offerings';

interface ClinicPickerProps {
  offering: SessionListOffering;
  sessionIds: string[];
  onToggleSession: (id: string) => void;
  todayIso: string | null;
}

export function ClinicPicker({
  offering,
  sessionIds,
  onToggleSession,
  todayIso,
}: ClinicPickerProps) {
  const count = sessionIds.length;
  const toBundle = Math.max(0, offering.bundleSize - (count % offering.bundleSize));
  const bundleComplete = count > 0 && count % offering.bundleSize === 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
      <div>
        <p className="tag text-gold">SCHEDULED CLINICS</p>
        <p
          role="status"
          className="mt-3 border border-gold/25 bg-gold/[0.07] px-3 py-2 text-[0.6rem] uppercase leading-relaxed tracking-[0.18em] text-gold"
        >
          Sample availability — spot counts are illustrative until live capacity
          is connected.
        </p>
        <ul className="mt-5 flex flex-col gap-3">
          {offering.sessions.map((session) => {
            const selected = sessionIds.includes(session.id);
            const full = session.spotsRemaining === 0;
            const past = todayIso !== null && session.dateIso < todayIso;
            const disabled = full || past;
            const takenPct = Math.round(
              ((session.capacity - session.spotsRemaining) / session.capacity) * 100,
            );
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => !disabled && onToggleSession(session.id)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className="bk-option flex w-full flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6"
                >
                  <span className="flex w-full flex-col gap-2 text-left">
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
                      {formatLongDate(session.dateIso)} · {session.window}
                    </span>
                    <span
                      className={`display text-lg tracking-[0.03em] ${selected ? 'text-gold' : 'text-stone'}`}
                    >
                      {session.title}
                    </span>
                    <span className="text-xs leading-relaxed text-stone/55">
                      {session.focus}
                    </span>
                    <span className="mt-1 flex items-center gap-3">
                      <span className="bk-meter w-24 shrink-0" aria-hidden="true">
                        <span style={{width: `${takenPct}%`}} />
                      </span>
                      <span
                        className={`text-[0.6rem] uppercase tracking-[0.18em] ${
                          !full && isScarce(session.spotsRemaining, session.capacity)
                            ? 'text-gold'
                            : 'text-stone/45'
                        }`}
                      >
                        {full
                          ? 'Full'
                          : isScarce(session.spotsRemaining, session.capacity)
                            ? `${session.spotsRemaining} spots left`
                            : `${session.spotsRemaining} of ${session.capacity} open`}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                    <span className="display bk-money text-lg text-stone/80">
                      {formatMoney(offering.pricePerSession)}
                    </span>
                    <span className="text-[0.6rem] uppercase tracking-[0.18em] text-stone/40">
                      {selected ? 'Selected' : disabled ? 'Unavailable' : 'Add'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t bk-hairline pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <p className="tag text-gold">THE BUNDLE</p>
        <h4 className="display bk-money mt-4 text-2xl text-stone">
          {offering.bundleSize} clinics, {formatMoney(offering.bundlePrice)}
        </h4>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone/55">
          {formatMoney(offering.pricePerSession)} per athlete for a single day.
          Choose any {offering.bundleSize} and the bundle rate applies on its own
          — no code, no asking.
        </p>

        <div className="mt-8">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
              Bundle progress
            </span>
            <span className="bk-money text-[0.65rem] uppercase tracking-[0.16em] text-stone/60">
              {count} selected
            </span>
          </div>
          <div className="mt-3 flex gap-2" aria-hidden="true">
            {Array.from({length: offering.bundleSize}).map((_, i) => (
              <span
                key={i}
                className={`h-px flex-1 ${
                  i < count % offering.bundleSize || bundleComplete
                    ? 'bg-gold'
                    : 'bg-stone/15'
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone/55" role="status">
            {count === 0
              ? `Select ${offering.bundleSize} dates to unlock the bundle.`
              : bundleComplete
                ? `Bundle rate applied — you save ${formatMoney(
                    (count / offering.bundleSize) *
                      (offering.bundleSize * offering.pricePerSession -
                        offering.bundlePrice),
                  )}.`
                : `Add ${toBundle} more to unlock the bundle rate.`}
          </p>
        </div>

        <div className="mt-10 border-t bk-hairline pt-6">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-stone/45">
            Booking a team?
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone/55">
            Clinics cap at {offering.sessions[0]?.capacity ?? 20} athletes. Whole
            teams, clubs and schools can take a private date — put your headcount
            in the notes and Jesse will quote the room.
          </p>
        </div>
      </div>
    </div>
  );
}
