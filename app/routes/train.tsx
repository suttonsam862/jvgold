import {Link} from 'react-router';
import {BookingFlow} from '~/components/booking/BookingFlow';
import {Img} from '~/components/site/Img';
import Ticks from '~/components/site/Ticks';
import {SEASON_LABEL} from '~/lib/offerings';
import styles from '~/styles/booking.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Train With Jesse — JV GOLD'},
    {
      name: 'description',
      content:
        'Book private wrestling training with Jesse Vasquez — 1-on-1 sessions, partner training, dedicated workouts, small-group clinics, monthly private packages and overnight camps in Riverside, California.',
    },
  ];
}

const proof = [
  ['4×', 'California state champion'],
  ['1st', 'Southern California four-peat'],
  ['’24', 'Pac-12 champion at 141 lbs, NCAA qualifier'],
  ['29', 'athletes in the first summer'],
];

const process = [
  {
    step: '01',
    title: 'You choose the format',
    copy: 'An hour, a week, a month, or a full camp. The calendar reshapes itself around the commitment — no guessing what anything costs.',
  },
  {
    step: '02',
    title: 'Jesse reads every request himself',
    copy: 'Every request goes to him, not a queue. He confirms the time, arranges payment, and asks the questions that make the first session count.',
  },
  {
    step: '03',
    title: 'The work starts on day one',
    copy: 'No feeling-out session. Technique, live situations, and a written plan your athlete takes home the same night.',
  },
];

const faqs = [
  {
    q: 'Where do sessions happen?',
    a: 'The Riverside room, unless your package says otherwise. Monthly packages train in the Riverside area on the standing days you choose; camps are residential with lodging and meals included.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Twenty-four hours. Reschedule free up to a day before a session; inside 24 hours the session is charged in full. Camp deposits are non-refundable inside three weeks of the first day.',
  },
  {
    q: 'How young is too young?',
    a: 'Six-year-olds and college starters both. The plan changes; the standard does not.',
  },
  {
    q: 'Can two athletes share a session?',
    a: 'That is the partner session — same hour, same intensity, one rate split between two families. Bring a teammate or a sibling and name them in the notes.',
  },
];

export default function TrainPage() {
  return (
    <>
      {/* HERO */}
      <section className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 pb-16 pt-16 md:grid-cols-2 md:gap-16 md:px-10 md:pb-24 md:pt-24">
        <div>
          <p className="tag mb-5 text-gold-deep">PRIVATE TRAINING — RIVERSIDE, CA</p>
          <h1 className="display text-[clamp(2.8rem,7vw,6rem)]">
            Train with
            <br />
            J<span className="text-gold-deep">e</span>sse
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-onyx/75">
            Focused coaching. Honest feedback. A plan built around your athlete —
            from a four-time state champion who has lived every level of the sport
            and teaches it the way champions learn it.
          </p>
          <Ticks className="mt-8" />
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#book"
              className="display bg-onyx px-6 py-4 text-[0.75rem] tracking-[0.16em] text-stone transition-colors hover:bg-gold hover:text-onyx-deep"
            >
              Open the Calendar
            </a>
            <Link
              to="/deep-waters"
              className="display border border-onyx px-6 py-4 text-[0.75rem] tracking-[0.16em] transition-colors hover:bg-onyx hover:text-stone"
            >
              The Club
            </Link>
          </div>
        </div>
        <div className="relative aspect-[3/4] max-h-[72vh] overflow-hidden" data-reveal>
          <Img
            id="25CMW_SCUFFLE_QF_6387"
            alt="Jesse Vasquez in the California Baptist singlet and white headgear"
            size="hero"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="img-mono object-top"
          />
          <p className="tag absolute bottom-4 left-4 bg-onyx-deep/80 px-3 py-2 text-stone">
            THE STANDARD
          </p>
        </div>
      </section>

      {/* PROOF STRIP */}
      <section className="border-y rule bg-stone-warm">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-8 px-5 py-10 md:grid-cols-4 md:px-10">
          {proof.map(([stat, label], i) => (
            <div
              key={label}
              data-reveal
              style={{'--reveal-delay': `${i * 80}ms`} as React.CSSProperties}
            >
              <p className="display text-[clamp(1.8rem,3.6vw,3rem)] text-gold-deep">
                {stat}
              </p>
              <p className="mt-2 max-w-[22ch] text-xs leading-relaxed text-steel">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* BOOKING CONSOLE */}
      <section
        id="book"
        className="scroll-mt-20 bg-onyx-deep text-stone"
      >
        <div className="mx-auto max-w-[1440px] px-5 py-20 pb-32 md:px-10 md:py-28 xl:pb-28">
          <BookingFlow />
        </div>
      </section>

      {/* PROCESS */}
      <section className="mx-auto max-w-[1440px] px-5 py-24 md:px-10 md:py-32">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <h2 className="display text-[clamp(1.9rem,4vw,3.2rem)]">
            What happens <span className="text-gold-deep">next</span>
          </h2>
          <p className="tag text-steel">PROVISIONAL RATES — {SEASON_LABEL.toUpperCase()}</p>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {process.map((item, i) => (
            <div
              key={item.step}
              data-reveal
              style={{'--reveal-delay': `${i * 100}ms`} as React.CSSProperties}
              className="border-t rule pt-6"
            >
              <p className="display outline-type text-[clamp(2.4rem,5vw,4rem)]">
                {item.step}
              </p>
              <h3 className="display mt-5 text-xl">{item.title}</h3>
              <p className="mt-4 max-w-sm leading-relaxed text-onyx/70">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y rule bg-stone-warm">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:px-10 md:py-28">
          <div>
            <p className="tag text-gold-deep">THE FINE PRINT</p>
            <h2 className="display mt-4 text-[clamp(1.9rem,4vw,3.2rem)]">
              Straight
              <br />
              answers.
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-onyx/70">
              No packages that expire quietly, no surprise fees, no auto-renew you
              have to fight. Ask anything the calendar doesn&rsquo;t answer in the
              notes on your request.
            </p>
          </div>
          <dl className="flex flex-col">
            {faqs.map((faq, i) => (
              <div
                key={faq.q}
                data-reveal
                style={{'--reveal-delay': `${i * 70}ms`} as React.CSSProperties}
                className="border-t rule py-6 last:border-b"
              >
                <dt className="display text-lg">{faq.q}</dt>
                <dd className="mt-3 max-w-2xl leading-relaxed text-onyx/70">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-onyx text-stone">
        <Img
          id="20CIFFNL3895"
          alt="Jesse Vasquez from behind, arms raised, VASQUEZ across his back"
          size="hero"
          fill
          className="img-mono opacity-30"
        />
        <div className="relative mx-auto flex max-w-[1440px] flex-col items-start gap-8 px-5 py-24 md:px-10 md:py-32">
          <p className="tag text-gold">LIMITED WEEKLY SLOTS — {SEASON_LABEL.toUpperCase()}</p>
          <h2 className="display text-[clamp(2.4rem,6vw,5.5rem)]">
            Your athlete.
            <br />
            The champion&rsquo;s standard.
          </h2>
          <a
            href="#book"
            className="display bg-gold px-8 py-4 text-[0.8rem] tracking-[0.14em] text-onyx-deep transition-colors hover:bg-stone"
          >
            Book a Session
          </a>
        </div>
      </section>
    </>
  );
}
