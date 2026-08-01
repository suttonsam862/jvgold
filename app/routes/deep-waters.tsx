import {Link} from 'react-router';
import Ticks from '~/components/site/Ticks';
import {Img} from '~/components/site/Img';
import styles from '~/styles/deepwaters.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Deep Waters Wrestling — JV Gold'},
    {
      name: 'description',
      content:
        "Jesse Vasquez's first club — a Riverside wrestling program that grew from zero to a full room in one summer.",
    },
  ];
}

// From Deep Waters club records, May 11 – June 14, 2026. Accuracy over
// scale — these numbers are small and real, and they should stay that way.
const stats: {index: string; num: string; label: string}[] = [
  {index: '01', num: '29', label: 'athletes registered'},
  {index: '02', num: '25', label: 'active monthly memberships'},
  {index: '03', num: '3', label: 'whole families training together'},
];

const delay = (ms: number) => ({'--reveal-delay': `${ms}ms`}) as React.CSSProperties;

export default function DeepWatersPage() {
  return (
    <>
      {/* HERO — photograph, scrim, vignette, then copy. Layer order is fixed
          by explicit z-index in deepwaters.css, not by DOM order. */}
      <section className="dw-hero-frame relative flex min-h-[84svh] flex-col justify-end overflow-hidden bg-onyx-deep text-stone md:min-h-[94svh]">
        <Img
          id="25CMW_SCUFFLE_QF_6325"
          alt="Jesse Vasquez in a low wrestling stance"
          size="hero"
          sizes="100vw"
          fill
          className="dw-hero-media img-mono opacity-40"
        />
        <div className="dw-hero-scrim absolute inset-0 bg-gradient-to-t from-onyx-deep via-onyx-deep/25 to-transparent" />
        <div className="dw-hero-vignette" aria-hidden="true" />

        <div className="dw-hero-copy mx-auto w-full max-w-[1440px] px-5 pb-16 pt-32 md:px-10 md:pb-24 md:pt-44">
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <div data-reveal>
                <span className="dw-hairline mb-5 block h-px w-24 bg-gold/70" />
                <p className="tag text-gold">RIVERSIDE, CALIFORNIA — EST. 2026</p>
              </div>
              <h1
                className="display mt-6 text-[clamp(3.25rem,11vw,10rem)] leading-[0.86]"
                data-reveal
                style={delay(90)}
              >
                Deep
                <br />
                Wat<span className="text-gold">e</span>rs
              </h1>
            </div>

            <div
              className="md:col-span-4 md:pb-4"
              data-reveal
              style={delay(240)}
            >
              <p className="dw-lede max-w-md text-stone/75">
                Jesse&rsquo;s first club. One summer, one standard: elite enough
                for champions, welcoming enough for a brand-new kid on day one.
              </p>
              <Ticks className="mt-8" />
            </div>
          </div>
        </div>
      </section>

      {/* STATS — three quiet figures, hairline-separated, no cards. */}
      <section className="border-b rule bg-stone-warm">
        <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-16 md:px-10 md:pt-20">
          <p className="tag text-gold-deep" data-reveal>
            THE FIRST SUMMER
          </p>
        </div>
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 pb-14 sm:grid-cols-3 sm:gap-0 md:px-10 md:pb-20">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="dw-stat"
              data-reveal
              style={delay(i * 140)}
            >
              <p className="tabular text-[0.6rem] tracking-[0.28em] text-steel">
                {stat.index}
              </p>
              <p className="display tabular mt-4 text-[clamp(3.25rem,7vw,5.75rem)] leading-[0.9] text-gold-deep">
                {stat.num}
              </p>
              <span className="dw-stat-rule mt-5" aria-hidden="true" />
              <p className="mt-5 max-w-[20ch] text-xs uppercase leading-relaxed tracking-[0.16em] text-steel">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[1440px] px-5 pb-8 md:px-10">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-steel">
            From club records, May 11 – June 14, 2026 — the room is still growing
          </p>
        </div>
      </section>

      {/* STORY — offset, asymmetric composition */}
      <section className="mx-auto grid max-w-[1440px] gap-20 px-5 py-24 md:grid-cols-[0.85fr_1.15fr] md:gap-16 md:px-10 md:py-40">
        <div
          className="dw-offset-wrap relative pb-[18%] md:mt-6 md:pb-[24%]"
          data-reveal
        >
          <span className="dw-offset-caption" aria-hidden="true">
            The corner that built a champion
          </span>
          <div className="dw-offset-primary aspect-[4/5]">
            <Img
              id="19HSWCIFF9945"
              alt="Jesse Vasquez embraced by his coach after a state title"
              sizes="(min-width: 768px) 42vw, 90vw"
              fill
              className="img-mono object-top"
            />
          </div>
          <div className="dw-offset-secondary aspect-[4/3] bg-onyx-deep">
            <Img
              id="20CIFFNL6383"
              alt="Jesse Vasquez embracing family after a state finals win"
              sizes="(min-width: 768px) 24vw, 55vw"
              fill
              className="img-mono"
            />
          </div>
        </div>

        <div className="dw-ripple pl-6 md:pl-14 md:pt-14">
          <p className="tag text-gold-deep" data-reveal>
            THE STORY
          </p>
          <h2
            className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]"
            data-reveal
            style={delay(90)}
          >
            One summer.
            <br />
            One standard.
          </h2>

          <p
            className="dw-lede mt-10 max-w-xl text-onyx/80"
            data-reveal
            style={delay(180)}
          >
            In May 2026, Deep Waters Wrestling opened its doors in Riverside
            with no roster, no waitlist, and no shortcuts — just Jesse, a mat,
            and a conviction that the Inland Empire deserved a room built to the
            championship standard he was raised on.
          </p>

          <div className="mt-8 flex max-w-xl flex-col gap-6 leading-relaxed text-onyx/70">
            <p data-reveal style={delay(260)}>
              Within weeks the room filled: 29 athletes, whole families
              training together, youth wrestlers sharing a wall with high-school
              hammers. Technique taught the way champions learn it. Discipline
              held the way families trust it.
            </p>
            <p data-reveal style={delay(340)}>
              Deep Waters is the proof of concept for everything Jesse is
              building — that a club can be elite and still feel like home.
            </p>
          </div>

          <div data-reveal style={delay(420)}>
            <Ticks className="mt-12" />
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="bg-onyx-deep py-28 text-stone md:py-40">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="max-w-4xl md:ml-[8%]">
            <p className="tag text-gold" data-reveal>
              THE DEEP WATERS PROMISE
            </p>
            <p
              className="display mt-6 text-[clamp(1.9rem,4.6vw,3.7rem)] leading-[1.05]"
              data-reveal
              style={delay(120)}
            >
              Your child will grow here, compete here, and be{' '}
              <span className="text-gold">cared for</span> here.
            </p>
          </div>
        </div>
      </section>

      {/* FUTURE CHAMPIONS TEASER */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-36">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5" data-reveal>
            <p className="tag text-gold-deep">NEXT — THE NONPROFIT</p>
            <h2 className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]">
              Future
              <br />
              Champions
            </h2>
          </div>
          <div
            className="md:col-span-6 md:col-start-7 md:pt-14"
            data-reveal
            style={delay(140)}
          >
            <p className="max-w-lg leading-relaxed text-onyx/75">
              The opportunity side of the ecosystem, still being built: camps,
              travel, elite competition, and college pathways for athletes whose
              families couldn&rsquo;t otherwise afford them. When it opens, every
              donated dollar will carry a documented purpose, decision, and
              impact. Built on everything Deep Waters proved.
            </p>
            <Link
              to="/future-champions"
              className="dw-cta display mt-12 inline-block border border-onyx px-6 py-4 text-[0.7rem] tracking-[0.14em]"
            >
              <span>See The Future Champions Mission</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
