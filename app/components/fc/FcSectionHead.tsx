/**
 * Brand-book section header: numbered display title on the left, running
 * document meta on the right, hairline underneath. Mirrors the printed
 * identity system so the page reads as the same artifact.
 *
 * The title rises out of its own mask and the hairline draws left-to-right,
 * so every section opens with the same small piece of choreography.
 *
 * Colour note: Champion Green only ever sets type on the void. On the day
 * register the numeral takes Victory Red at display size (3.7:1 — AA large),
 * because green on chalk measures 1.6:1 and would fail outright.
 */
interface FcSectionHeadProps {
  index: string;
  title: string;
  meta?: string;
  tone?: 'night' | 'day';
  className?: string;
}

export function FcSectionHead({
  index,
  title,
  meta = 'FUTURE CHAMPIONS · IDENTITY IN PROGRESS',
  tone = 'night',
  className = '',
}: FcSectionHeadProps) {
  const night = tone === 'night';

  return (
    <div data-reveal className={className}>
      <div className="flex items-end justify-between gap-6 pb-4">
        <h2
          className={`fc-display t-section ${
            night ? 'text-fc-chalk' : 'text-fc-ink'
          }`}
        >
          <span className="fc-mask-line">
            <span>
              <span
                className={`tabular mr-3 ${
                  night ? 'text-fc-green' : 'text-fc-red'
                }`}
              >
                {index}
              </span>
              {title}
            </span>
          </span>
        </h2>
        <p
          className={`fc-label hidden shrink-0 pb-1 md:block ${
            night ? 'text-fc-chalk/55' : 'text-fc-ink/65'
          }`}
        >
          {meta}
        </p>
      </div>
      <span className="fc-rule-draw" aria-hidden />
    </div>
  );
}
