import {Link} from 'react-router';
import {GarmentPlate} from '~/components/shop/GarmentPlate';
import {ComingSoon} from '~/components/shop/ComingSoon';
import styles from '~/styles/shop.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Shop — JV GOLD'},
    {
      name: 'description',
      content:
        'Authentic vintage cotton screen printed tees, screen printed with 92 grain screens. The Wrestle and Rave Tee, $30, in youth and adult sizes.',
    },
  ];
}

/**
 * The client's positioning line, verbatim. Do not paraphrase it, do not
 * sentence-case it into something else — it ships exactly as written.
 */
const POSITIONING =
  'authentic vintage cotton screen printed tees, screen printed with 92 grain screens.';

const PRESS_NOTES = [
  {
    index: '01',
    title: 'A finer mesh, a thinner film',
    copy: 'Ninety-two threads to the inch is a tight screen. Less ink gets through it than through the coarse mesh most shops run, so what lands on the shirt is a thin film instead of a thick pad.',
  },
  {
    index: '02',
    title: 'Ink in the cotton, not on it',
    copy: 'A thin film settles into the weave and takes on its texture. You can still see the knit through the print. That is the difference between a graphic that belongs to the shirt and one that is sitting on top of it.',
  },
  {
    index: '03',
    title: 'Why it feels old already',
    copy: 'A heavy print goes stiff, shines, and eventually cracks off in a sheet. A thin one stays soft, moves with the fabric, and softens further every wash — the way the tees people still keep were printed in the first place.',
  },
];

export default function ShopIndex() {
  return (
    <div className="shop">
      {/* HERO */}
      <section className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-16 pt-16 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-10 md:pb-24 md:pt-24">
        <div>
          <p className="tag mb-5 text-gold-deep">JV GOLD — SHOP</p>
          <h1 className="display text-[clamp(2.6rem,6.6vw,5.6rem)] leading-[0.92]">
            Printed the
            <br />
            <span className="text-gold-deep">old</span> way
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-onyx/75">
            {POSITIONING}
          </p>
          <p className="mt-5 max-w-md leading-relaxed text-onyx/60">
            One shirt at a time, on garments chosen for how they wear in rather
            than how cheap they land. Small runs. No restocks promised.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/shop/wrestle-and-rave-tee"
              className="display bg-onyx px-6 py-4 text-[0.75rem] tracking-[0.16em] text-stone transition-colors hover:bg-gold hover:text-onyx-deep"
            >
              The Wrestle and Rave Tee
            </Link>
            <a
              href="#press"
              className="display border border-onyx px-6 py-4 text-[0.75rem] tracking-[0.16em] transition-colors hover:bg-onyx hover:text-stone"
            >
              How it&rsquo;s printed
            </a>
          </div>
        </div>

        <Link
          to="/shop/wrestle-and-rave-tee"
          className="sh-plate-link block"
          aria-label="Wrestle and Rave Tee — $30"
        >
          <GarmentPlate
            alt="The Wrestle and Rave Tee, black, with chrome gradient lettering, cut-out wrestler photography and firework bursts"
            loading="eager"
          />
        </Link>
      </section>

      {/* THE PRODUCT LINE */}
      <section className="border-y rule bg-stone-warm">
        <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-10 md:py-20">
          <p className="tag mb-8 text-onyx/50">IN STOCK — ONE STYLE</p>
          <div className="flex flex-col gap-8 border-t rule pt-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="display text-[clamp(2rem,4.6vw,3.4rem)] leading-none">
                Wrestle and Rave Tee
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-onyx/70">
                A 1990s bootleg rap tee treatment on black cotton — chrome
                gradient lettering, cut-out wrestler photography, firework
                bursts. Youth S through Adult XL.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <p className="display text-[clamp(1.8rem,3.6vw,2.6rem)] leading-none">
                $30
              </p>
              <Link
                to="/shop/wrestle-and-rave-tee"
                className="display border border-onyx px-6 py-4 text-[0.75rem] tracking-[0.16em] transition-colors hover:bg-onyx hover:text-stone"
              >
                View the Tee
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* THE PRESS NOTE */}
      <section id="press" className="mx-auto max-w-[1440px] px-5 py-16 md:px-10 md:py-24">
        <p className="tag mb-6 text-gold-deep">92 GRAIN</p>
        <h2 className="display max-w-3xl text-[clamp(1.9rem,4.4vw,3.2rem)] leading-tight">
          The mesh count is the whole difference between vintage and plastic.
        </h2>
        <p className="mt-6 max-w-2xl leading-relaxed text-onyx/70">
          Every shirt here goes through 92 grain screens. It is a slower way to
          print and it is unforgiving of a bad separation, but it is the only
          way to get a print that feels like it has already been yours for ten
          years.
        </p>

        <div className="mt-12 grid gap-px bg-onyx/10 md:grid-cols-3">
          {PRESS_NOTES.map((note) => (
            <article key={note.index} className="bg-stone p-7 md:p-9">
              <span className="display text-[0.75rem] tracking-[0.2em] text-onyx/40">
                {note.index}
              </span>
              <h3 className="display mt-6 text-xl leading-snug">{note.title}</h3>
              <p className="mt-4 leading-relaxed text-onyx/70">{note.copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* COMING SOON */}
      <section className="border-t rule bg-stone-warm">
        <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-10 md:py-20">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h2 className="display text-[clamp(1.8rem,4vw,2.8rem)] leading-none">
              Next off the press
            </h2>
            <p className="max-w-md leading-relaxed text-onyx/60">
              Nothing gets a name or a date here until it exists. When a run is
              ready it goes up, and when it sells through it comes down.
            </p>
          </div>
          <ComingSoon />
        </div>
      </section>

      {/* CLOSING BAND */}
      <section className="shop-dark bg-onyx text-stone">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-8 px-5 py-20 md:px-10 md:py-28">
          <p className="tag text-gold">SMALL RUNS — RIVERSIDE, CALIFORNIA</p>
          <h2 className="display max-w-3xl text-[clamp(2.2rem,5.4vw,4.6rem)] leading-[0.95]">
            Made the way the
            <br />
            good ones were made.
          </h2>
          <p className="max-w-xl leading-relaxed text-stone/70">
            The same standard that runs the room runs the press. Nothing leaves
            here that Jesse would not wear himself.
          </p>
          <Link
            to="/shop/wrestle-and-rave-tee"
            className="display bg-gold px-8 py-4 text-[0.8rem] tracking-[0.14em] text-onyx-deep transition-colors hover:bg-stone"
          >
            See the Tee
          </Link>
        </div>
      </section>
    </div>
  );
}
