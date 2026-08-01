import {Link} from 'react-router';
import {Img} from '~/components/site/Img';
import {FcMark} from '~/components/fc/FcMark';
import {FcSectionHead} from '~/components/fc/FcSectionHead';
import {FcBuildStatus, type FcStep} from '~/components/fc/FcBuildStatus';
import {FcSignup} from '~/components/fc/FcSignup';
import styles from '~/styles/fc.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Future Champions Wrestling Club — Coming Soon'},
    {
      name: 'description',
      content:
        'Championship-level wrestling, affordable childcare, and year-round camps — open to every kid, regardless of what their family can pay. A nonprofit wrestling club in formation, from the Inland Empire. Not yet open. Greater later.',
    },
  ];
}

/* ------------------------------------------------------------------ data */

const BUILD_STEPS: FcStep[] = [
  {
    label: 'Nonprofit filing',
    detail:
      'Incorporation and federal nonprofit application underway. We will publish the determination letter the day it arrives.',
    state: 'active',
  },
  {
    label: 'The founders',
    detail:
      'Jesse Vasquez and Remy Murillo, plus the family and teammates who lived it.',
    state: 'done',
  },
  {
    label: 'The room',
    detail:
      'A training home in the Inland Empire — mats, childcare space, a kitchen.',
    state: 'active',
  },
  {
    label: 'Doors open',
    detail: 'First whistle. First study table. First dinner after practice.',
    state: 'next',
  },
];

interface RoadBeat {
  index: string;
  meta: string;
  title: string;
  copy: string;
  photo?: {id: string; alt: string; caption: string};
}

const ROAD: RoadBeat[] = [
  {
    index: '01',
    meta: 'Inland Empire · High school',
    title: 'The climb',
    copy: 'Four consecutive California state championships out of the Inland Empire — one of the most decorated high-school careers in the state. Every title earned the same way: early mornings, cut weight, a family in the stands.',
    photo: {
      id: '20CIFFNL3798',
      alt: 'Jesse Vasquez roaring in celebration after his fourth straight state title',
      caption: 'CIF State Finals — four fingers, four titles',
    },
  },
  {
    index: '02',
    meta: 'Arizona State · Division I',
    title: 'The summit',
    copy: 'Arizona State. A Division-I room, and the invisible side of elite sport — hunger, injuries, broken trust with coaches, mental pressure with nowhere to put it. The lesson that survived: talent is not enough without a room that holds you.',
    photo: {
      id: '23CMW_ASU_STANFORD11323',
      alt: 'Jesse Vasquez wrestling for Arizona State against Stanford',
      caption: 'Arizona State — the D-I years',
    },
  },
  {
    index: '03',
    meta: 'The program, erased',
    title: 'The cuts',
    copy: 'Remy Murillo wrestled his way into a full scholarship — then watched his university erase the program. The rooms that raised both founders vanished on a budget line. That is the wound this club is built over.',
  },
  {
    index: '04',
    meta: 'Now · Riverside, California',
    title: 'The build',
    copy: 'Future Champions Wrestling Club. Elite standards, open doors, family at the center — coaching, childcare, camps, meals. A nonprofit no athletic department can cut. The room nobody can take away.',
  },
];

const RECEIPTS = [
  {figure: '4×', label: 'California state champion. The founder. Four straight.'},
  {figure: '2', label: 'Co-founders. Jesse Vasquez and Remy Murillo.'},
  {figure: '$25', label: 'Target cost of one week of care for one kid. Provisional — not yet set.'},
  {figure: '0', label: 'Dollars raised. We are not accepting donations until the filing clears.'},
];

const PROMISES = [
  {
    index: '01',
    name: 'Wrestling',
    copy: 'Coaching at the standard that wins state titles, six days a week. Same standard for the state placer and the kid who walked in Tuesday.',
    accent: 'bg-fc-green',
  },
  {
    index: '02',
    name: 'Childcare',
    copy: 'Practice and care in the same building. You work. The little ones stay where you can find them.',
    accent: 'bg-fc-red',
  },
  {
    index: '03',
    name: 'The road',
    copy: 'Camps and clinics year round, here and away. Nobody gets left home over a plane ticket.',
    accent: 'bg-fc-blue',
  },
  {
    index: '04',
    name: 'Education',
    copy: 'Grades get checked. Study tables before the mat. Eligibility is never a surprise in this room.',
    accent: 'bg-fc-green',
  },
  {
    index: '05',
    name: 'Community',
    copy: 'Dinner after practice. Parents in the stands. Doors held open in both languages.',
    accent: 'bg-fc-red',
  },
];

/* ------------------------------------------------------------------ page */

export default function FutureChampions() {
  return (
    <div className="fc-root">
      {/* ============================================ HERO — night register */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        <Img
          id="25CMW_SCUFFLE_QF_6647"
          alt=""
          aria-hidden
          size="hero"
          fill
          className="fc-photo-night opacity-35"
        />
        <div className="fc-hero-veil" aria-hidden />
        <div className="fc-brackets" aria-hidden />

        <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center px-5 py-28 text-center md:px-10">
          <p className="fc-label fc-enter text-fc-chalk/55">
            Future Champions Wrestling Club · Est. Inland Empire, CA
          </p>

          {/* The ceremony: the mark arrives out of the dark, the light follows
              it, two rings open once and settle. Nothing loops fast. */}
          <div className="fc-crest-stage relative mt-10">
            <span className="fc-halo" aria-hidden />
            <span
              className="fc-ring"
              aria-hidden
              style={{'--fc-ring-delay': '900ms'} as React.CSSProperties}
            />
            <span
              className="fc-ring"
              aria-hidden
              style={{'--fc-ring-delay': '1700ms'} as React.CSSProperties}
            />
            <div className="fc-enter-crest relative">
              <FcMark
                name="crest-mono"
                tone="light"
                glow
                eager
                alt="The Future Champions crest — crown, laurel wreath in bloom, and the FC monogram"
                className="crest-hero relative mx-auto"
              />
            </div>
          </div>

          <h1
            className="fc-display fc-enter stack-2xl t-hero text-fc-chalk"
            style={{'--fc-delay': '980ms'} as React.CSSProperties}
          >
            Greater Later
          </h1>

          {/* A <div>, not a <p>: reset.css zeroes paragraph padding
              unlayered, which would flatten the pill's inset. */}
          <div
            className="fc-enter stack-xl inline-flex items-center gap-3 border border-fc-green/40 px-5 py-3"
            style={{'--fc-delay': '1280ms'} as React.CSSProperties}
          >
            <span
              aria-hidden
              className="fc-blip inline-block h-[7px] w-[7px] rotate-45 bg-fc-green"
            />
            <span className="fc-label text-fc-green">
              Fall 2026
            </span>
          </div>

          <p
            className="fc-body fc-enter stack-xl t-copy-lg max-w-[54ch] text-fc-chalk/70"
            style={{'--fc-delay': '1460ms'} as React.CSSProperties}
          >
            Championship-level wrestling, affordable childcare, and year-round
            camps — open to every kid, regardless of what their family can pay.
          </p>

          <p
            className="fc-display fc-enter stack-2xl t-sub flex items-center gap-5 text-fc-chalk/60"
            style={{'--fc-delay': '1680ms'} as React.CSSProperties}
          >
            <span
              aria-hidden
              className="hidden h-px w-16 bg-fc-chalk/25 sm:block"
            />
            The room nobody can take away.
            <span
              aria-hidden
              className="hidden h-px w-16 bg-fc-chalk/25 sm:block"
            />
          </p>
        </div>

        <a
          href="#the-build"
          className="fc-label fc-cue-link fc-enter relative mx-auto mb-10 flex flex-col items-center gap-2"
          style={{'--fc-delay': '1980ms'} as React.CSSProperties}
        >
          Not open yet — building toward the first whistle
          <span aria-hidden className="fc-cue text-lg leading-none">
            ↓
          </span>
        </a>

        <FcMark
          name="monogram"
          tone="green"
          alt=""
          className="sprig pointer-events-none absolute bottom-6 right-5 opacity-25 md:right-10"
        />
      </section>

      {/* ================================================= 01 — THE BUILD */}
      <section
        id="the-build"
        className="relative scroll-mt-24 border-t rule-light"
      >
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <FcSectionHead
            index="01"
            title="The build"
            meta="STATUS · NOT YET OPEN"
          />

          <p
            data-reveal
            className="fc-display stack-2xl t-statement max-w-[22ch] text-fc-chalk"
          >
            <span className="fc-mask-line">
              <span>We are not launching a program.</span>
            </span>
            <span className="fc-mask-line">
              <span style={{'--line-delay': '120ms'} as React.CSSProperties}>
                We are finishing a building.
              </span>
            </span>
          </p>

          <p
            data-reveal
            className="fc-body stack-lg t-copy max-w-[62ch] text-fc-chalk/70"
          >
            Programs get cut. Rooms get kept. Here is exactly where the work
            stands — no thermometer graphics, no urgency theatrics.
          </p>

          <div className="mt-16">
            <FcBuildStatus steps={BUILD_STEPS} target="Fall 2026" />
          </div>
        </div>
      </section>

      {/* ======================================== 02 — THE FOUNDER'S ROAD */}
      <section className="relative border-t rule-light">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <FcSectionHead
            index="02"
            title="The founder's road"
            meta="WHY THIS ROOM EXISTS"
          />

          <ol className="fc-rail stack-3xl">
            {ROAD.map((beat, i) => {
              // Asymmetry: the photograph leads on every second beat.
              const photoFirst = i % 2 === 1;
              return (
                <li key={beat.index} data-reveal className="fc-beat">
                  {/* The rail draws itself downward as the beat arrives. */}
                  <span className="fc-beat-rail" aria-hidden />
                  <span className="fc-node" aria-hidden />
                  <span
                    aria-hidden
                    className="fc-ghost-index tabular pointer-events-none absolute right-0 top-0 hidden md:block"
                  >
                    {beat.index}
                  </span>

                  <p className="fc-label tabular text-fc-green">
                    {beat.index} / 04
                  </p>
                  <p className="fc-label stack-xs text-fc-chalk/55">
                    {beat.meta}
                  </p>

                  <h3 className="fc-display stack-lg t-beat text-fc-chalk">
                    <span className="fc-mask-line">
                      <span>{beat.title}</span>
                    </span>
                  </h3>

                  <span className="fc-rule-draw mt-6 max-w-[42rem]" aria-hidden />

                  <div
                    className={`mt-9 grid gap-10 md:gap-16 ${
                      beat.photo
                        ? 'md:grid-cols-2 md:items-center'
                        : 'md:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)]'
                    }`}
                  >
                    <p
                      className={`fc-body t-copy max-w-[54ch] text-fc-chalk/70 ${
                        photoFirst ? 'md:order-2' : ''
                      }`}
                    >
                      {beat.copy}
                    </p>

                    {beat.photo ? (
                      <figure
                        className={`fc-photo-frame aspect-[4/3] w-full ${
                          photoFirst ? 'md:order-1' : ''
                        }`}
                      >
                        <Img
                          id={beat.photo.id}
                          alt={beat.photo.alt}
                          sizes="(min-width: 768px) 46vw, 100vw"
                          fill
                          className="fc-photo-night fc-photo-push"
                        />
                        <figcaption className="fc-label absolute bottom-4 left-4 z-10 text-fc-chalk/75">
                          {beat.photo.caption}
                        </figcaption>
                      </figure>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          <blockquote
            data-reveal
            className="fc-pull border-l-2 border-fc-green pl-6 md:pl-10"
          >
            <p className="fc-display t-quote text-fc-chalk">
              <span className="fc-mask-line">
                <span>They could cut the program.</span>
              </span>
              <span className="fc-mask-line">
                <span style={{'--line-delay': '140ms'} as React.CSSProperties}>
                  They couldn&rsquo;t cut the wrestler.
                </span>
              </span>
            </p>
            <footer className="fc-label stack-lg text-fc-chalk/60">
              Jesse Vasquez &amp; Remy Murillo — co-founders
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ================================================ 03 — THE RECEIPTS */}
      <section className="relative overflow-hidden border-t rule-light">
        <div className="fc-mat-circles" aria-hidden />
        <div className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <FcSectionHead
            index="03"
            title="The receipts"
            meta="NUMBERS, NOT ADJECTIVES"
          />

          <dl className="stack-3xl grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {RECEIPTS.map((item, i) => (
              <div
                key={item.figure}
                data-reveal
                style={{'--reveal-delay': `${i * 110}ms`} as React.CSSProperties}
                className="fc-engrave"
              >
                <span className="fc-rule-draw" aria-hidden />
                <dt className="fc-display fc-figure stack-lg t-figure text-fc-green">
                  <span className="fc-mask-line">
                    <span>{item.figure}</span>
                  </span>
                </dt>
                <dd className="fc-body stack-md t-copy-sm max-w-[26ch] text-fc-chalk/65">
                  {item.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ===================================== 04 — WHAT'S COMING (DAY band) */}
      <section className="fc-day">
        <div className="fc-folk-rule" aria-hidden />
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <FcSectionHead
            index="04"
            title="What's coming"
            tone="day"
            meta="DAY REGISTER · FOR FAMILIES"
          />

          <div className="mt-14 grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
            <div>
              <p
                data-reveal
                className="fc-display t-statement max-w-[18ch] text-fc-ink"
              >
                <span className="fc-mask-line">
                  <span>Every kid trains.</span>
                </span>
                <span className="fc-mask-line">
                  <span style={{'--line-delay': '120ms'} as React.CSSProperties}>
                    Nobody asks what your family makes.
                  </span>
                </span>
              </p>

              {/* Spanish at equal hierarchy — same size, same weight. */}
              <div data-reveal className="mt-10">
                <span className="fc-rule-draw" aria-hidden />
                <div className="grid gap-6 pt-8 sm:grid-cols-2">
                  <p className="fc-display t-sub text-fc-ink">
                    No kid&rsquo;s future should depend on a budget line.
                  </p>
                  <p lang="es" className="fc-display t-sub text-fc-ink">
                    El futuro de ningún niño debe depender de una línea de
                    presupuesto.
                  </p>
                </div>
              </div>
            </div>

            <div data-reveal className="mx-auto md:mx-0">
              <FcMark name="crest-color" alt="" className="crest-day" />
            </div>
          </div>

          <ul className="stack-4xl grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {PROMISES.map((promise, i) => (
              <li
                key={promise.name}
                data-reveal
                style={{'--reveal-delay': `${i * 90}ms`} as React.CSSProperties}
                className="border-t border-fc-ink/25 pt-5"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rotate-45 ${promise.accent}`}
                  />
                  <span className="fc-label tabular text-fc-ink/60">
                    {promise.index}
                  </span>
                </div>
                <h3 className="fc-display stack-sm t-title text-fc-ink">
                  {promise.name}
                </h3>
                <p className="fc-body stack-sm t-copy-sm text-fc-ink/75">
                  {promise.copy}
                </p>
              </li>
            ))}
          </ul>

          <p
            data-reveal
            className="fc-body stack-3xl t-copy max-w-[62ch] text-fc-ink/70"
          >
            The Five Promises are the shape of the club: wrestling, childcare,
            the road, education, community. Enrollment, camp dates, and family
            pricing open when the doors do.
          </p>
        </div>
        <div className="fc-folk-rule" aria-hidden />
      </section>

      {/* ================================================== 05 — THE LIST */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <FcSectionHead
            index="05"
            title="Be first in the room"
            meta="THE LIST"
          />

          <div className="mt-14 grid gap-14 md:grid-cols-2 md:gap-20">
            <div>
              <p
                data-reveal
                className="fc-display t-statement max-w-[16ch] text-fc-chalk"
              >
                <span className="fc-mask-line">
                  <span>You show up. We handle the rest.</span>
                </span>
              </p>
              <p
                data-reveal
                lang="es"
                /* Equal type hierarchy — same size, same weight, same colour.
                   Spanish is designed in, never subordinated. */
                className="fc-display stack-md t-statement max-w-[16ch] text-fc-chalk"
              >
                <span className="fc-mask-line">
                  <span>Tú llegas. Nosotros nos encargamos del resto.</span>
                </span>
              </p>
              <p
                data-reveal
                className="fc-body stack-xl t-copy max-w-[48ch] text-fc-chalk/65"
              >
                Leave an email and you will know the opening date before anyone
                else — first practice, first camp, first enrollment window.
              </p>
            </div>

            <div data-reveal>
              <FcSignup />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================== CLOSING CREST + JV GOLD HANDOFF */}
      <section className="relative overflow-hidden border-t rule-light">
        <div className="fc-mat-circles" aria-hidden />
        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center px-5 py-28 text-center md:px-10 md:py-40">
          <div className="relative" data-reveal>
            <span className="fc-halo" aria-hidden />
            <FcMark
              name="crest-mono"
              tone="light"
              glow
              alt="The Future Champions crest"
              className="crest-close relative mx-auto"
            />
          </div>

          <p
            data-reveal
            className="fc-display stack-2xl t-closing max-w-[16ch] text-fc-chalk"
          >
            <span className="fc-mask-line">
              <span>Greater later.</span>
            </span>
            <span className="fc-mask-line">
              <span style={{'--line-delay': '140ms'} as React.CSSProperties}>
                Keep the room open.
              </span>
            </span>
          </p>

          <p
            data-reveal
            className="fc-body stack-xl t-copy max-w-[56ch] text-fc-chalk/65"
          >
            Future Champions Wrestling Club is a nonprofit in formation in
            Southern California&rsquo;s Inland Empire, co-founded by four-time
            California state champion Jesse Vasquez and Remy Murillo.
            Registration, camp dates, and giving open when the doors do.
          </p>

          {/* Separated endorsement band — FCWC first, never smaller. The one
              place on this page where JV Gold's own type and gold appear. */}
          <div
            data-reveal
            className="mt-20 w-full border-t pt-8 rule-light md:mt-24"
          >
            <p className="fc-label text-fc-chalk/55">Endorsed by</p>
            <Link to="/" className="fc-endorse-link display stack-md">
              JV Gold
            </Link>
            <p className="fc-body stack-md t-copy-sm mx-auto max-w-[52ch] text-fc-chalk/55">
              JV Gold is Jesse Vasquez&rsquo;s personal athlete and training
              brand. It supports Future Champions and keeps its own identity.
            </p>
          </div>

          <p className="fc-label tabular stack-3xl text-fc-chalk/55">
            FCWC · Nonprofit in formation · Inland Empire, California
          </p>
        </div>
      </section>
    </div>
  );
}
