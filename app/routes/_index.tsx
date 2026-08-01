import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import Ticks from '~/components/site/Ticks';
import {Img} from '~/components/site/Img';
import styles from '~/styles/home.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'JV GOLD — Jesse Vasquez'},
    {
      name: 'description',
      content:
        'The official home of Jesse Vasquez — four-time California state champion, Pac-12 champion, founder of Deep Waters Wrestling. Confidence. Discipline. Standard.',
    },
  ];
}

const credibility = [
  'National Wrestling Hall of Fame Honoree',
  '4× California State Champion',
  'Pac‑12 Champion',
  'NCAA Division I Starter',
  'Mexico National Team',
];

/** Numerals band. `to` is the value counted toward; `display` renders it. */
const figures = [
  {
    to: 4,
    prefix: '',
    suffix: '×',
    label: 'California state champion — four straight, three schools',
  },
  {
    to: 1,
    prefix: '',
    suffix: 'st',
    label: 'Southern California wrestler ever to four-peat',
  },
  {
    to: 24,
    prefix: '’',
    suffix: '',
    label: 'Pac‑12 champion at 141 lbs, NCAA Championships',
  },
  {
    to: 23,
    prefix: 'No. ',
    suffix: '',
    label: 'peak national ranking at 141 lbs, 2025–26',
  },
];

/* Each venture gets its own place on a 12-column grid so the run of three
   never reads as the same block repeated. */
const ventures = [
  {
    tag: '01 — THE CLUB',
    index: '01',
    name: 'Deep Waters Wrestling',
    stat: '29',
    statLabel: 'athletes in the first summer',
    copy: 'An elite training environment in Riverside built on technique, discipline, and family. Elite enough for champions. Welcoming enough for a new kid on day one.',
    to: '/deep-waters',
    cta: 'The Deep Waters Story',
    img: '23CMW_ASU_STANFORD11323',
    alt: 'Jesse Vasquez wrestling for Arizona State against Stanford',
    ratio: 'aspect-[4/5] md:aspect-[5/6]',
    mediaClass: 'md:col-span-7 md:col-start-1 md:row-start-1',
    textClass: 'md:col-span-4 md:col-start-9 md:row-start-1 md:self-center',
  },
  {
    tag: '02 — THE MISSION',
    index: '02',
    name: 'Future Champions',
    stat: 'Soon',
    statLabel: 'the room nobody can take away',
    copy: 'The nonprofit in formation — championship-level wrestling, affordable childcare, and year-round camps, planned to open to every kid regardless of what their family can pay.',
    to: '/future-champions',
    cta: 'Coming Soon',
    img: '24COL_NCAA_QRTS_0063',
    alt: 'Jesse Vasquez at the NCAA Championships quarterfinals',
    ratio: 'aspect-[4/3] md:aspect-[4/5]',
    mediaClass: 'md:col-span-6 md:col-start-7 md:row-start-1 md:mt-24',
    textClass: 'md:col-span-5 md:col-start-1 md:row-start-1 md:self-end md:pb-8',
  },
  {
    tag: '03 — THE STANDARD',
    index: '03',
    name: 'Train With Jesse',
    stat: '1:1',
    statLabel: 'focused, private coaching',
    copy: 'Focused coaching. Honest feedback. A plan built around your athlete — from a coach who has lived every level of the sport.',
    to: '/train',
    cta: 'Book a Session',
    img: '25CMW_SCUFFLE_QF_6387',
    alt: 'Jesse Vasquez in the California Baptist singlet',
    ratio: 'aspect-[4/5] md:aspect-[16/11]',
    mediaClass: 'md:col-span-8 md:col-start-5 md:row-start-1',
    textClass: 'md:col-span-4 md:col-start-1 md:row-start-1 md:self-end md:pb-6',
  },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Writes a clamped 0–1 scroll-passage progress onto the element as `--p`.
 * If JS never runs, `--p` falls back to 0 in CSS and the frame sits still.
 */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let frame = 0;
    const write = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const span = vh + rect.height || 1;
      const raw = (vh - rect.top) / span;
      el.style.setProperty('--p', String(Math.min(1, Math.max(0, raw))));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(write);
    };

    write();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

/**
 * Outlined numeral that counts up the first time it enters the viewport.
 * Renders the final value on the server, so no-JS and reduced-motion visitors
 * see the real number immediately.
 */
function CountUp({
  to,
  prefix = '',
  suffix = '',
  className = '',
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return;
    }

    let frame = 0;
    let start = 0;
    const duration = 1400;

    const run = () => {
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        // cubic-bezier(0.22, 1, 0.36, 1) approximated as an ease-out quint.
        const eased = 1 - Math.pow(1 - t, 5);
        setValue(Math.round(to * eased));
        if (t < 1) frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
    };

    setValue(0);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            io.disconnect();
            run();
          }
        });
      },
      {threshold: 0.4},
    );
    io.observe(el);

    return () => {
      io.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [to]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <span className="tabular">{value}</span>
      {suffix}
    </span>
  );
}

export default function Homepage() {
  const heroRef = useScrollProgress<HTMLElement>();
  const closeRef = useScrollProgress<HTMLElement>();

  return (
    <div className="hm">
      {/* ------------------------------------------------------------ HERO */}
      <section
        ref={heroRef}
        className="hm-hero relative flex min-h-[94svh] flex-col justify-end overflow-hidden bg-onyx-deep text-stone"
      >
        <div className="hm-hero-media">
          <Img
            id="25CMW_SCUFFLE_QF_6647"
            alt="Jesse Vasquez driving through a takedown"
            size="hero"
            sizes="100vw"
            fill
            className="img-mono opacity-60"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-onyx-deep via-onyx-deep/45 to-onyx-deep/10" />
        <div
          className="absolute inset-0 bg-gradient-to-r from-onyx-deep/70 via-transparent to-transparent"
          aria-hidden
        />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-12 md:px-10 md:pb-16">
          <div
            className="hm-hero-seam hidden md:block"
            style={{left: '2.5rem', top: '18%', bottom: '0'}}
            aria-hidden
          />

          <p
            className="hm-fade tag mb-5 text-gold"
            style={{'--hm-delay': '120ms'} as React.CSSProperties}
          >
            JV GOLD — EST. RIVERSIDE, CALIFORNIA
          </p>

          <h1 className="display text-[clamp(4rem,14vw,13rem)]">
            <span className="hm-rise">
              <span style={{'--hm-delay': '220ms'} as React.CSSProperties}>
                Vasqu<span className="text-gold">e</span>z
              </span>
            </span>
          </h1>

          <div
            className="hm-fade mt-8 grid gap-10 md:grid-cols-12 md:items-end"
            style={{'--hm-delay': '620ms'} as React.CSSProperties}
          >
            <p className="max-w-md text-sm leading-relaxed text-stone/80 md:col-span-5 md:text-base">
              Champion wrestler. Elite coach. Founder building the next
              generation. Four straight California state titles — the first in
              Southern California history — and nine seasons at the top of
              American wrestling.
            </p>

            <div className="flex items-end gap-3 md:col-span-5 md:col-start-8 md:justify-end">
              <Link
                to="/train"
                className="display bg-gold px-6 py-3 text-[0.75rem] tracking-[0.14em] text-onyx-deep transition-colors hover:bg-stone"
              >
                Train With Jesse
              </Link>
              <Link
                to="/archive"
                className="display border border-stone/40 px-6 py-3 text-[0.75rem] tracking-[0.14em] transition-colors hover:border-gold hover:text-gold"
              >
                The Archive
              </Link>
            </div>
          </div>

          <div
            className="hm-fade mt-12 hidden md:block"
            style={{'--hm-delay': '900ms'} as React.CSSProperties}
          >
            <a href="#story" className="hm-cue group" aria-label="Skip to the story">
              <span className="hm-cue-rail" aria-hidden />
              <span className="tag text-stone/50 transition-colors group-hover:text-gold">
                Scroll
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- CREDIBILITY */}
      <section
        className="hm-plate border-y rule"
        aria-label="Career honours"
      >
        {/* Wide: an engraved plate, items separated by skewed hairlines. */}
        <div className="hm-plate-row mx-auto hidden max-w-[1440px] items-center justify-between gap-x-[3.2rem] px-5 py-7 md:flex md:px-10">
          {credibility.map((c) => (
            <span key={c} className="hm-plate-item tag text-onyx/55">
              {c}
            </span>
          ))}
        </div>

        {/* Narrow: the same honours travel past on a slow marquee. */}
        <div className="hm-marquee py-5 md:hidden" tabIndex={0}>
          <div className="hm-marquee-track">
            <div className="hm-marquee-set pl-5">
              {credibility.map((c) => (
                <span key={c} className="hm-plate-item tag text-onyx/55">
                  {c}
                </span>
              ))}
            </div>
            <div className="hm-marquee-set" aria-hidden>
              {credibility.map((c) => (
                <span key={c} className="hm-plate-item tag text-onyx/55">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- MANIFESTO */}
      <section
        id="story"
        className="hm-manifesto mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-40"
      >
        <div className="grid gap-12 md:grid-cols-12 md:gap-0">
          {/* Type column — deliberately wide, sitting left of centre. */}
          <div className="relative z-10 md:col-span-7 md:col-start-1 md:row-start-1 md:pr-16">
            <p className="tag mb-7 text-gold-deep" data-reveal>
              #GREATER_LATER
            </p>

            <div
              className="hm-hairline mb-9 w-full max-w-[10rem]"
              data-reveal
              style={{'--reveal-delay': '80ms'} as React.CSSProperties}
            />

            <h2
              className="display text-[clamp(2.6rem,6.6vw,6rem)]"
              data-reveal
              style={{'--reveal-delay': '120ms'} as React.CSSProperties}
            >
              The deep water
              <br />
              is the <span className="text-gold-deep">point.</span>
            </h2>

            <p
              className="mt-10 max-w-[46ch] leading-relaxed text-onyx/75 md:text-[1.0625rem]"
              data-reveal
              style={{'--reveal-delay': '220ms'} as React.CSSProperties}
            >
              Every chapter of Jesse&rsquo;s story runs the same arc: deep water,
              disciplined choice, community, proof. Three high schools and four
              straight state titles. A Pac-12 crown in the desert. A program cut
              out from under him — and a fight he chose to take on rather than
              fade out of. The adversity was never the obstacle. It was the training.
            </p>

            <div
              data-reveal
              style={{'--reveal-delay': '300ms'} as React.CSSProperties}
            >
              <Ticks className="mt-12" />
            </div>
          </div>

          {/* Photograph — overlaps the type column and hangs below the grid. */}
          <div
            className="relative md:col-span-6 md:col-start-7 md:row-start-1 md:-mr-4 md:mt-28"
            data-reveal
            style={{'--reveal-delay': '160ms'} as React.CSSProperties}
          >
            <div
              className="hm-gutter-rule absolute -left-8 top-0 hidden w-px md:block"
              style={{height: '70%'}}
              aria-hidden
            />
            <div className="hm-media relative aspect-[3/4]">
              <Img
                id="19HSWCIFF9929"
                alt="Jesse Vasquez pointing to his temple after a state finals win"
                sizes="(min-width: 768px) 50vw, 100vw"
                fill
                className="img-mono object-top"
              />
            </div>
            <p className="tag mt-4 text-onyx/45">CIF STATE FINALS — 2019</p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- NUMBERS */}
      <section className="bg-onyx-deep py-24 text-stone md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div
            className="mb-14 flex items-center gap-5"
            data-reveal
          >
            <Ticks />
            <span className="tag text-stone/45">The record</span>
            <span className="hm-hairline hidden flex-1 md:block" />
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-14 md:grid-cols-4 md:gap-x-14">
            {figures.map((f, i) => (
              <div
                key={f.label}
                className="hm-col"
                data-reveal
                style={{'--reveal-delay': `${i * 110}ms`} as React.CSSProperties}
              >
                <p className="hm-figure display outline-type text-[clamp(3.2rem,7.5vw,6.5rem)]">
                  <CountUp to={f.to} prefix={f.prefix} suffix={f.suffix} />
                </p>
                <p className="mt-5 max-w-[24ch] text-xs leading-relaxed text-stone/60">
                  {f.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-14 text-[0.65rem] uppercase tracking-[0.18em] text-stone/45">
            CIF California state records; Deep Waters club records, May 11 –
            June 14, 2026
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- VENTURES */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-40">
        <div className="mb-20 grid gap-6 md:grid-cols-12 md:items-end">
          <h2
            className="display text-[clamp(2.4rem,6vw,5rem)] md:col-span-7"
            data-reveal
          >
            The <span className="text-gold-deep">ecosystem</span>
          </h2>
          <p
            className="max-w-[38ch] text-sm leading-relaxed text-onyx/65 md:col-span-4 md:col-start-9"
            data-reveal
            style={{'--reveal-delay': '120ms'} as React.CSSProperties}
          >
            Three doors into the same standard — a club, a nonprofit, and a mat
            with one athlete on it.
          </p>
        </div>

        <div className="flex flex-col gap-24 md:gap-40">
          {ventures.map((v) => (
            <article
              key={v.name}
              className="hm-card grid items-start gap-8 md:grid-cols-12 md:gap-x-12"
            >
              <div
                className={`hm-media ${v.ratio} ${v.mediaClass}`}
                data-reveal
              >
                <Img
                  id={v.img}
                  alt={v.alt}
                  sizes="(min-width: 768px) 60vw, 100vw"
                  fill
                  className="img-mono"
                />
              </div>

              <div className={`relative ${v.textClass}`}>
                <span className="hm-ghost display hidden md:block" aria-hidden>
                  {v.index}
                </span>

                <div
                  className="relative"
                  data-reveal
                  style={{'--reveal-delay': '90ms'} as React.CSSProperties}
                >
                  <p className="tag text-gold-deep">{v.tag}</p>
                  <h3 className="display mt-5 text-[clamp(2rem,4.2vw,3.4rem)]">
                    {v.name}
                  </h3>

                  <div className="mt-8 border-t rule pt-6">
                    <p
                      className={`display tabular text-gold-deep ${
                        v.stat.length > 4
                          ? 'text-[clamp(1.8rem,3.4vw,2.6rem)]'
                          : 'text-[clamp(3rem,6vw,4.8rem)]'
                      }`}
                    >
                      {v.stat}
                    </p>
                    <p className="mt-3 max-w-[28ch] text-[0.7rem] uppercase leading-relaxed tracking-[0.18em] text-steel">
                      {v.statLabel}
                    </p>
                  </div>

                  <p className="mt-8 max-w-[42ch] leading-relaxed text-onyx/75">
                    {v.copy}
                  </p>

                  <Link
                    to={v.to}
                    className="hm-cta display mt-9 inline-block border border-onyx px-6 py-3 text-[0.7rem] tracking-[0.14em] transition-colors"
                  >
                    {v.cta}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section
        ref={closeRef}
        className="hm-close relative overflow-hidden bg-onyx text-stone"
      >
        <div className="hm-close-media">
          <Img
            id="20CIFFNL3895"
            alt="Jesse Vasquez from behind, arms raised, VASQUEZ across his back"
            size="hero"
            sizes="100vw"
            fill
            className="img-mono opacity-35"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-onyx via-onyx/70 to-onyx/20" />

        <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 py-28 md:grid-cols-12 md:px-10 md:py-44">
          <div className="md:col-span-8">
            <p className="tag text-gold" data-reveal>
              PRIVATE TRAINING — LIMITED WEEKLY SLOTS
            </p>
            <div
              className="hm-hairline my-8 w-full max-w-[14rem]"
              data-reveal
              style={{'--reveal-delay': '80ms'} as React.CSSProperties}
            />
            <h2
              className="display text-[clamp(2.6rem,7vw,6.5rem)]"
              data-reveal
              style={{'--reveal-delay': '140ms'} as React.CSSProperties}
            >
              Your athlete.
              <br />
              The champion&rsquo;s standard.
            </h2>
          </div>

          <div
            className="flex items-end md:col-span-4 md:justify-end"
            data-reveal
            style={{'--reveal-delay': '240ms'} as React.CSSProperties}
          >
            <Link
              to="/train"
              className="display bg-gold px-8 py-4 text-[0.8rem] tracking-[0.14em] text-onyx-deep transition-colors hover:bg-stone"
            >
              Book a Private Session
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
