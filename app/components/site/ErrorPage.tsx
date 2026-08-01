import {Link} from 'react-router';
import {Img} from '~/components/site/Img';

export interface ErrorPageLink {
  to: string;
  label: string;
  note: string;
}

export interface ErrorPageProps {
  /** HTTP status, rendered as the ghost numerals. */
  status?: number | string;
  /** Small bracketed micro-label. The [ ] are drawn by CSS. */
  tag?: string;
  /** The headline. Kept short — it is set very large. */
  title?: string;
  /** One or two sentences of copy beneath the rule. */
  body?: string;
  /** Photo id from app/lib/photos.ts used as the full-bleed plate. */
  photoId?: string;
  /** Alt text for the plate. Decorative by default. */
  photoAlt?: string;
  /** Where the visitor can go instead. */
  links?: ErrorPageLink[];
}

export const DEFAULT_ERROR_LINKS: ErrorPageLink[] = [
  {to: '/', label: 'Home', note: 'Back to the top of the page'},
  {to: '/archive', label: 'The Archive', note: 'Four state titles, in order'},
  {to: '/train', label: 'Train', note: 'Work with Jesse in Riverside'},
];

/**
 * The branded error treatment: a full-bleed monochrome plate, oversized
 * numerals, and three ways back. Reused by the catch-all 404 route and by the
 * root ErrorBoundary.
 */
export function ErrorPage({
  status = 404,
  tag = 'Error',
  title = 'Off the mat',
  body = 'This page stepped out of bounds. Nothing here — but the work is one link away.',
  photoId = '20CIFFNL3895',
  photoAlt = '',
  links = DEFAULT_ERROR_LINKS,
}: ErrorPageProps) {
  return (
    <section className="err-stage flex items-end text-stone">
      <div className="err-plate">
        <Img
          id={photoId}
          alt={photoAlt}
          size="hero"
          fill
          sizes="100vw"
          className="img-mono"
        />
      </div>
      <div className="err-veil" aria-hidden="true" />
      <div className="err-grain" aria-hidden="true" />

      <p className="err-code display" aria-hidden="true">
        {status}
      </p>

      <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 pt-40 md:px-10 md:pb-32 md:pt-52">
        <div className="max-w-3xl">
          <p className="tag text-gold" data-reveal>
            {tag} {status}
          </p>

          <h1
            className="display mt-6 text-[clamp(3rem,11vw,9rem)] leading-[0.86] text-stone"
            data-reveal
            style={{'--reveal-delay': '120ms'} as React.CSSProperties}
          >
            {title}
          </h1>

          <div
            className="rule-light mt-10 border-t"
            data-reveal
            style={{'--reveal-delay': '220ms'} as React.CSSProperties}
          />

          <p
            className="mt-8 max-w-xl text-base leading-relaxed text-stone/70 md:text-lg"
            data-reveal
            style={{'--reveal-delay': '300ms'} as React.CSSProperties}
          >
            {body}
          </p>

          <nav aria-label="Where to go instead" className="mt-14 md:mt-20">
            <ul className="grid gap-8 sm:grid-cols-3 sm:gap-10">
              {links.map((item, i) => (
                <li
                  key={item.to}
                  data-reveal
                  style={
                    {
                      '--reveal-delay': `${400 + i * 120}ms`,
                    } as React.CSSProperties
                  }
                >
                  <Link
                    to={item.to}
                    className="err-link display text-lg tracking-[0.14em] text-gold hover:text-stone focus-visible:text-stone md:text-xl"
                  >
                    {item.label}
                  </Link>
                  <span className="mt-3 block text-sm leading-snug text-stone/45">
                    {item.note}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}

export default ErrorPage;
