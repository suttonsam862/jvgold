import {Img} from '~/components/site/Img';
import {OFFERINGS} from '~/lib/offerings';
import type {Offering, OfferingId} from '~/lib/offerings';

interface OfferingSelectorProps {
  selectedId: OfferingId | null;
  onSelect: (offering: Offering) => void;
}

const MODE_LABEL: Record<Offering['mode'], string> = {
  'single-date': 'Pick a date & time',
  'session-list': 'Choose clinic dates',
  'weekly-pattern': 'Build a training week',
  'camp-block': 'Reserve with a deposit',
};

/**
 * Six cards read as a tier list — the index climbs, the commitment climbs,
 * the price climbs. Photography sits behind the type at a whisper so the
 * name and the number stay the loudest things on the plate.
 */
export function OfferingSelector({
  selectedId,
  onSelect,
}: OfferingSelectorProps) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
      {OFFERINGS.map((offering, i) => {
        const selected = offering.id === selectedId;
        return (
          <li
            key={offering.id}
            data-reveal
            style={
              {
                '--reveal-delay': `${Math.min(i, 5) * 70}ms`,
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              onClick={() => onSelect(offering)}
              aria-pressed={selected}
              className="bk-card group"
            >
              {/* Plate */}
              <span className="relative block aspect-[5/3] w-full overflow-hidden">
                <Img
                  id={offering.photoId}
                  alt=""
                  size="thumb"
                  sizes="(min-width: 1280px) 30vw, (min-width: 768px) 46vw, 92vw"
                  fill
                  className={`bk-card-photo img-mono ${
                    selected ? 'opacity-60' : 'opacity-35 group-hover:opacity-50'
                  }`}
                  aria-hidden="true"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-onyx-deep via-onyx-deep/55 to-onyx-deep/10"
                />

                <span
                  aria-hidden="true"
                  className="display outline-type absolute left-5 top-4 text-[2.4rem] leading-none"
                >
                  {offering.index}
                </span>

                {offering.featured ? (
                  <span className="tag absolute right-4 top-5 text-gold">
                    MOST REQUESTED
                  </span>
                ) : null}

                <span
                  className={`display absolute bottom-4 left-5 right-5 text-[1.45rem] leading-[1] tracking-[0.01em] ${
                    selected ? 'text-gold' : 'text-stone'
                  }`}
                >
                  {offering.name}
                </span>
              </span>

              {/* Ledger */}
              <span className="flex flex-1 flex-col px-5 pb-6 pt-5 md:px-6">
                <span className="flex items-baseline justify-between gap-4 border-b bk-hairline pb-4">
                  <span className="text-[0.58rem] uppercase tracking-[0.2em] text-stone/45">
                    {MODE_LABEL[offering.mode]}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    <span className="display bk-money text-xl text-gold">
                      {offering.priceFrom}
                    </span>
                    <span className="text-[0.55rem] uppercase tracking-[0.14em] text-stone/45">
                      {offering.priceUnit}
                    </span>
                  </span>
                </span>

                <span className="mt-4 text-sm leading-relaxed text-stone/70">
                  {offering.bestFor}
                </span>

                <span className="mt-4 flex flex-col gap-1.5">
                  {offering.includes.map((item) => (
                    <span
                      key={item}
                      className="flex items-baseline gap-2.5 text-xs leading-relaxed text-stone/50"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-[8px] w-[4px] shrink-0 -skew-x-[30deg] bg-gold"
                      />
                      {item}
                    </span>
                  ))}
                </span>

                <span className="mt-auto flex items-end justify-between gap-4 pt-7">
                  <span className="text-[0.58rem] uppercase tracking-[0.2em] text-stone/40">
                    {offering.duration}
                  </span>
                  <span
                    className={`bk-cue display text-[0.68rem] tracking-[0.16em] ${
                      selected ? 'text-gold' : 'text-stone/75'
                    }`}
                  >
                    {selected ? 'Selected' : 'Choose'}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
