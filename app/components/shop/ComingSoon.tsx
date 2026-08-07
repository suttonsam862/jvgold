/**
 * Coming soon — deliberately unnamed.
 *
 * No product names, no prices, no dates, no countdown. Nothing here is a
 * promise the client has not made yet. Each plate is typographic only: a
 * numeral, a category the brand already stands behind, and one honest line.
 */

interface SoonPlate {
  index: string;
  kind: string;
  copy: string;
}

const PLATES: SoonPlate[] = [
  {
    index: '02',
    kind: 'Tee',
    copy: 'Another graphic, same press, same 92 grain screens. In separation now.',
  },
  {
    index: '03',
    kind: 'Fleece',
    copy: 'Heavier weight for the drive home and the cold corner of the gym.',
  },
  {
    index: '04',
    kind: 'Room goods',
    copy: 'The small things that end up in a wrestling bag and stay there.',
  },
];

export function ComingSoon() {
  return (
    <ul className="grid gap-px border-t rule bg-onyx/10 sm:grid-cols-3">
      {PLATES.map((plate) => (
        <li
          key={plate.index}
          className="sh-soon group flex min-h-[15rem] flex-col justify-between bg-stone-warm p-7 md:min-h-[18rem] md:p-9"
        >
          <div className="flex items-baseline justify-between gap-4">
            <span className="display text-[0.75rem] tracking-[0.2em] text-onyx/40">
              {plate.index}
            </span>
            <span className="tag text-gold-deep">IN PRODUCTION</span>
          </div>

          <div>
            <p className="display mt-8 text-[clamp(1.6rem,3.4vw,2.4rem)] leading-none">
              {plate.kind}
            </p>
            <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-onyx/65">
              {plate.copy}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
