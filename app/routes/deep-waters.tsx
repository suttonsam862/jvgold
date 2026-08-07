import {Link} from 'react-router';
import Ticks from '~/components/site/Ticks';
import {Img} from '~/components/site/Img';
import styles from '~/styles/deepwaters.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Deep Waters RTC — Riverside, California | JV Gold'},
    {
      name: 'description',
      content:
        'Deep Waters RTC is the Riverside wrestling room where Jesse Vasquez coaches year round. Monday–Thursday 7:00–8:30 PM, 10000 Indiana Ave, Ste 5. Text or call 951-552-0370.',
    },
  ];
}

const PHONE_DISPLAY = '951-552-0370';
const PHONE_HREF = 'tel:+19515520370';
const IG_HREF = 'https://www.instagram.com/deepwaterswrestling';

const coaches: {
  role: string;
  name: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  bio: string;
}[] = [
  {
    role: 'Head Coach',
    name: 'Jesse Vasquez',
    src: '/dw/coach-jesse.webp',
    width: 480,
    height: 535,
    alt: 'Head coach Jesse Vasquez in a navy CBU Wrestling polo, photographed against a plain light background.',
    bio: 'Division I wrestler, international competitor, and a coach who has spent his life in the sport. He runs the room.',
  },
  {
    role: 'Assistant Coach',
    name: 'Remy Murillo',
    src: '/dw/coach-remy.webp',
    width: 480,
    height: 529,
    alt: 'Assistant coach Remy Murillo in a navy CBU Wrestling polo, photographed against a plain light background.',
    bio: 'Born and raised in the Riverside and Inland Empire wrestling community. Redshirt collegiate wrestler.',
  },
  {
    role: 'Assistant Coach',
    name: 'Raquel Garcia',
    src: '/dw/coach-raquel.webp',
    width: 480,
    height: 504,
    alt: 'Assistant coach Raquel Garcia in a purple Missouri Valley singlet, standing on the mat in front of a Valley Wrestling backdrop.',
    bio: '2× high school state qualifier, 2× league champion, CIF champion, Freakshow finalist, Heart of America placer.',
  },
];

const rates: {name: string; detail: string; price: string; unit: string}[] = [
  {
    name: 'All Access',
    detail: 'Four training sessions every week — every session on the schedule.',
    price: '$185',
    unit: '/ mo',
  },
  {
    name: '2 Classes / Week',
    detail: 'Two training sessions every week.',
    price: '$125',
    unit: '/ mo',
  },
  {
    name: 'Summer Season',
    detail: 'Three months, paid in full.',
    price: '$450',
    unit: 'season',
  },
  {
    name: 'Drop-In',
    detail: 'A single session.',
    price: '$25',
    unit: 'class',
  },
];

const tiers: {name: string; amount: string}[] = [
  {name: 'Bronze', amount: '$1,500'},
  {name: 'Silver', amount: '$3,000'},
  {name: 'Gold', amount: '$5,000'},
  {name: 'Platinum', amount: '$10,000+'},
];

// From Deep Waters club records, May 11 – June 14, 2026. Accuracy over
// scale — these numbers are small and real, and they should stay that way.
const stats: {index: string; num: string; label: string}[] = [
  {index: '01', num: '29', label: 'athletes on the roster'},
  {index: '02', num: '25', label: 'active monthly memberships'},
  {index: '03', num: '3', label: 'whole families training together'},
];

const values = ['Faith', 'Family', 'Discipline', 'Respect', 'Legacy'];

const delay = (ms: number) =>
  ({'--reveal-delay': `${ms}ms`}) as React.CSSProperties;

export default function DeepWatersPage() {
  return (
    <>
      {/* HERO — the room itself. Layer order is fixed by explicit z-index in
          deepwaters.css, not by DOM order. */}
      <section className="dw-hero-frame relative flex min-h-[84svh] flex-col justify-end overflow-hidden bg-onyx-deep text-stone md:min-h-[92svh]">
        <Img
          id="jesse_coach_behind_shot"
          alt="Jesse Vasquez facing a wrestling room full of youth and teen athletes warming up on the mat, seen from behind."
          size="hero"
          sizes="100vw"
          fill
          className="dw-hero-media img-mono opacity-40"
        />
        <div className="dw-hero-scrim absolute inset-0 bg-gradient-to-t from-onyx-deep via-onyx-deep/25 to-transparent" />
        <div className="dw-hero-vignette" aria-hidden="true" />

        <div className="dw-hero-copy mx-auto w-full max-w-[1440px] px-5 pb-14 pt-32 md:px-10 md:pb-20 md:pt-44">
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <div data-reveal>
                <span className="dw-hairline mb-5 block h-px w-24 bg-gold/70" />
                <p className="tag text-gold">
                  RIVERSIDE · CALIFORNIA · INLAND EMPIRE
                </p>
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
              <p
                className="display mt-4 text-[0.7rem] tracking-[0.4em] text-stone/60"
                data-reveal
                style={delay(160)}
              >
                RTC — Forged in Deep Waters
              </p>
            </div>

            <div className="md:col-span-4 md:pb-4" data-reveal style={delay(240)}>
              <img
                src="/dw/logo.webp"
                width={520}
                height={376}
                alt="Deep Waters RTC gold wordmark"
                className="dw-mark mb-7"
                loading="eager"
                decoding="async"
              />
              <p className="dw-lede max-w-md text-stone/75">
                The wrestling room Jesse coaches out of year round — an open mat
                in Riverside where beginners, high-school hammers and whole
                families train side by side, four nights a week.
              </p>
              <Ticks className="mt-8" />
            </div>
          </div>

          {/* Fact strip — the three things a parent actually needs. */}
          <ul
            className="dw-facts mt-12 md:mt-16"
            data-reveal
            style={delay(320)}
          >
            <li>
              <span className="dw-fact-key">Training nights</span>
              <span className="dw-fact-val">Mon – Thu · 7:00 – 8:30 PM</span>
            </li>
            <li>
              <span className="dw-fact-key">The room</span>
              <span className="dw-fact-val">
                10000 Indiana Ave, Ste 5 · Riverside, CA 92503
              </span>
            </li>
            <li>
              <span className="dw-fact-key">Start here</span>
              <span className="dw-fact-val">
                <a href={PHONE_HREF} className="dw-phone">
                  Text or call {PHONE_DISPLAY}
                </a>
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* TRAIN WITH US — schedule, address, contact. The practical spine. */}
      <section className="border-b rule bg-stone-warm">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-5 py-20 md:grid-cols-[1.05fr_0.95fr] md:gap-20 md:px-10 md:py-28">
          <div>
            <p className="tag text-gold-deep" data-reveal>
              TRAIN WITH US
            </p>
            <h2
              className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]"
              data-reveal
              style={delay(80)}
            >
              The schedule
              <br />
              and the door.
            </h2>

            <div className="mt-12 grid gap-10 sm:grid-cols-2">
              <div data-reveal style={delay(160)}>
                <h3 className="dw-sub">Weekly schedule</h3>
                <dl className="dw-deflist">
                  <div>
                    <dt>Monday – Thursday</dt>
                    <dd className="tabular">7:00 – 8:30 PM</dd>
                  </div>
                  <div>
                    <dt>Friday &amp; Saturday</dt>
                    <dd>Open room — all members</dd>
                  </div>
                </dl>
                <p className="mt-5 text-xs leading-relaxed text-steel">
                  The schedule may adjust for events. Members are notified of any
                  change.
                </p>
              </div>

              <div data-reveal style={delay(240)}>
                <h3 className="dw-sub">Get in touch</h3>
                <dl className="dw-deflist">
                  <div>
                    <dt>Location</dt>
                    <dd>
                      10000 Indiana Ave, Ste 5
                      <br />
                      Riverside, CA 92503
                    </dd>
                  </div>
                  <div>
                    <dt>Phone / text</dt>
                    <dd>
                      <a href={PHONE_HREF} className="dw-phone tabular">
                        {PHONE_DISPLAY}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Instagram</dt>
                    <dd>
                      <a
                        href={IG_HREF}
                        className="dw-phone"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        @deepwaterswrestling
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <a
              href={PHONE_HREF}
              className="dw-cta display mt-12 inline-block border border-onyx px-6 py-4 text-[0.7rem] tracking-[0.14em]"
            >
              <span>Text or call {PHONE_DISPLAY}</span>
            </a>
          </div>

          {/* Offset photo composition — deliberately off-grid. */}
          <div
            className="dw-offset-wrap relative pb-[18%] md:mt-4 md:pb-[22%]"
            data-reveal
          >
            <span className="dw-offset-caption" aria-hidden="true">
              Four nights a week, Riverside
            </span>
            <div className="dw-offset-primary aspect-[4/5]">
              <Img
                id="jesse_deep_waters_shirt_back"
                alt="A man photographed from behind with his head bowed, wearing a black t-shirt with a large white Deep Waters Wrestling logo across the back."
                sizes="(min-width: 768px) 42vw, 90vw"
                fill
                className="img-mono object-top"
              />
            </div>
            <div className="dw-offset-secondary aspect-[4/3] bg-onyx-deep">
              <Img
                id="jesse_coaching_deep_waters"
                alt="Jesse Vasquez bent at the waist, locked up with a training partner, demonstrating a takedown position in the wrestling room."
                sizes="(min-width: 768px) 24vw, 55vw"
                fill
                className="img-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* THE STANDARD — values band on onyx. */}
      <section className="bg-onyx-deep py-24 text-stone md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <p className="tag text-gold" data-reveal>
            THE STANDARD
          </p>
          <h2
            className="display mt-6 max-w-4xl text-[clamp(1.9rem,4.4vw,3.5rem)] leading-[1.05]"
            data-reveal
            style={delay(90)}
          >
            Built on purpose. Driven by discipline.{' '}
            <span className="text-gold">Defined by depth.</span>
          </h2>

          <div className="mt-14 grid gap-14 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5" data-reveal style={delay(160)}>
              <blockquote className="dw-scripture">
                <p className="display text-[clamp(1.5rem,3vw,2.25rem)] leading-tight">
                  Iron sharpens iron.
                </p>
                <footer className="mt-4 text-[0.65rem] uppercase tracking-[0.24em] text-stone/55">
                  Proverbs 27:17
                </footer>
              </blockquote>
              <p className="mt-10 max-w-md leading-relaxed text-stone/70">
                Deep Waters is an elite program built to develop champions and
                leaders — on and off the mat. Technique gets taught the way
                champions learn it. Discipline gets held the way families trust
                it. Nobody is too new for the room, and nobody is too good for
                the basics.
              </p>
              <ul className="dw-values mt-10">
                {values.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-6 md:col-start-7" data-reveal style={delay(240)}>
              <figure className="dw-plate">
                <Img
                  id="deep_waters_team_pic_1"
                  alt="A large group of about forty-five wrestlers, children and adults, posed together in rows on a wrestling mat in the gym."
                  sizes="(min-width: 768px) 50vw, 92vw"
                  className="w-full"
                />
                <figcaption className="dw-plate-cap">
                  The whole room, on the record.
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* COACHES */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
        <div className="max-w-3xl">
          <p className="tag text-gold-deep" data-reveal>
            THE STAFF
          </p>
          <h2
            className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]"
            data-reveal
            style={delay(80)}
          >
            Who coaches you.
          </h2>
          <p
            className="dw-lede mt-8 text-onyx/75"
            data-reveal
            style={delay(160)}
          >
            Former Division I athletes with a combined five California state
            titles and eight state-finalist appearances — on the mat with your
            athlete, every session.
          </p>
        </div>

        <ul className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach, i) => (
            <li
              key={coach.name}
              className="dw-coach"
              data-reveal
              style={delay(i * 120)}
            >
              <div className="dw-coach-plate">
                <img
                  src={coach.src}
                  width={coach.width}
                  height={coach.height}
                  alt={coach.alt}
                  loading="lazy"
                  decoding="async"
                  className="img-mono"
                />
              </div>
              <p className="mt-6 text-[0.6rem] uppercase tracking-[0.24em] text-steel">
                {coach.role}
              </p>
              <h3 className="display mt-3 text-[1.35rem] leading-tight">
                {coach.name}
              </h3>
              <span className="dw-stat-rule mt-4" aria-hidden="true" />
              <p className="mt-5 max-w-[34ch] text-sm leading-relaxed text-onyx/70">
                {coach.bio}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* MEMBERSHIP — rates as published. No checkout here: joining runs
          through the club by phone. */}
      <section className="border-y rule bg-stone-warm">
        <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <p className="tag text-gold-deep" data-reveal>
                MEMBERSHIP
              </p>
              <h2
                className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]"
                data-reveal
                style={delay(80)}
              >
                What it costs
                <br />
                to train here.
              </h2>
            </div>
            <div className="md:col-span-5" data-reveal style={delay(160)}>
              <p className="max-w-md leading-relaxed text-onyx/70">
                Flexible plans for every athlete. New students begin with a
                one-time <strong className="font-semibold">$100</strong>{' '}
                registration. To join, text or call the club — Jesse or a coach
                will get you in for a first session.
              </p>
            </div>
          </div>

          <ul className="dw-rates mt-16">
            {rates.map((rate, i) => (
              <li key={rate.name} data-reveal style={delay(i * 90)}>
                <div className="dw-rate-head">
                  <h3 className="display text-[1.1rem] leading-tight">
                    {rate.name}
                  </h3>
                  <p className="display tabular text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none text-gold-deep">
                    {rate.price}
                    <span className="dw-rate-unit">{rate.unit}</span>
                  </p>
                </div>
                <p className="dw-rate-detail">{rate.detail}</p>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-5">
            <a
              href={PHONE_HREF}
              className="dw-cta display inline-block border border-onyx px-6 py-4 text-[0.7rem] tracking-[0.14em]"
            >
              <span>Text or call {PHONE_DISPLAY} to enroll</span>
            </a>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-steel">
              Rates current as published by the club
            </p>
          </div>
        </div>
      </section>

      {/* SPONSORS */}
      <section className="bg-onyx-deep py-24 text-stone md:py-32">
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          <div className="grid gap-10 md:grid-cols-12 md:items-end">
            <div className="md:col-span-6">
              <p className="tag text-gold" data-reveal>
                BACK THE PROGRAM
              </p>
              <h2
                className="display mt-5 text-[clamp(2.1rem,4.8vw,3.9rem)] leading-[0.95]"
                data-reveal
                style={delay(80)}
              >
                Become a
                <br />
                sponsor.
              </h2>
            </div>
            <div className="md:col-span-5 md:col-start-8" data-reveal style={delay(160)}>
              <p className="max-w-md leading-relaxed text-stone/70">
                Sponsorships fund mats, travel and tournament entries for Deep
                Waters athletes — and put your brand behind the Inland
                Empire&rsquo;s next generation of champions.
              </p>
            </div>
          </div>

          <ul className="dw-tiers mt-16">
            {tiers.map((tier, i) => (
              <li key={tier.name} data-reveal style={delay(i * 90)}>
                <p className="text-[0.6rem] uppercase tracking-[0.24em] text-stone/50">
                  {tier.name}
                </p>
                <p className="display tabular mt-4 text-[clamp(1.8rem,3.2vw,2.5rem)] leading-none text-gold">
                  {tier.amount}
                </p>
              </li>
            ))}
          </ul>

          <a
            href={PHONE_HREF}
            className="dw-cta dw-cta-light display mt-14 inline-block border border-stone/40 px-6 py-4 text-[0.7rem] tracking-[0.14em]"
          >
            <span>Text or call {PHONE_DISPLAY} to sponsor</span>
          </a>
        </div>
      </section>

      {/* THE ROOM TODAY — quiet figures, hairline-separated, no cards. */}
      <section className="border-b rule bg-stone-warm">
        <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-16 md:px-10 md:pt-20">
          <p className="tag text-gold-deep" data-reveal>
            THE ROOM TODAY
          </p>
        </div>
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 pb-14 sm:grid-cols-3 sm:gap-0 md:px-10 md:pb-16">
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
        <div className="mx-auto max-w-[1440px] px-5 pb-16 md:px-10 md:pb-20">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-steel">
            From club records, May 11 – June 14, 2026 — the room is still growing
          </p>
          <figure className="dw-belts mt-12" data-reveal>
            <img
              src="/dw/team-belts.webp"
              width={900}
              height={600}
              alt="The Deep Waters team — youth wrestlers, teens and coaches — posed together beneath a wall hung with championship belts."
              loading="lazy"
              decoding="async"
              className="img-mono w-full"
            />
            <figcaption className="dw-plate-cap">
              The belt wall, and the group training under it.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* THE PROMISE — the club's own, in its own words. */}
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
              The opportunity side of the ecosystem, still being built — not yet
              launched, and 501(c)(3) status not yet confirmed: camps, travel,
              elite competition and college pathways for athletes whose families
              couldn&rsquo;t otherwise afford them. When it opens, every donated
              dollar will carry a documented purpose, decision and impact. Built
              on everything the Deep Waters room proves four nights a week.
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
