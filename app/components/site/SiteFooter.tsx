import {Link} from 'react-router';
import Ticks from './Ticks';

const links = [
  {to: '/archive', label: 'THE ARCHIVE'},
  {to: '/deep-waters', label: 'DEEP WATERS'},
  {to: '/train', label: 'TRAIN WITH JESSE'},
  {to: '/future-champions', label: 'FUTURE CHAMPIONS'},
  {to: '/shop', label: 'SHOP'},
  {to: '/private', label: 'PRIVATE ACCESS'},
];

export function SiteFooter() {
  return (
    <footer className="bg-onyx-deep text-stone">
      <div className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <div className="flex flex-col gap-12 md:flex-row md:items-end md:justify-between">
          <div>
            <Ticks className="mb-6" />
            <p className="display text-[clamp(2.5rem,7vw,6rem)] leading-none">
              Confidence.
              <br />
              Discipline.
              <br />
              <span className="text-gold">Standard.</span>
            </p>
          </div>

          <nav className="flex flex-col gap-3 md:items-end">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="tag text-stone/60 hover:text-stone">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t rule-light pt-8 md:flex-row md:items-center md:justify-between">
          <img
            src="/brand/jv-gold-logo-white.png"
            alt="JV Gold"
            width={760}
            height={348}
            className="h-6 w-auto self-start opacity-90"
          />
          <p className="text-xs tracking-wide text-stone/50">
            © {new Date().getFullYear()} JV GOLD LLC — Jesse Vasquez. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
