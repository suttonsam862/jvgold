import {useCallback, useRef, useState} from 'react';
import {Link} from 'react-router';
import Ticks from '~/components/site/Ticks';
import {Img} from '~/components/site/Img';
import {byEra, photo, type Era} from '~/lib/photos';
import {
  MilestoneModal,
  type ArchivePlate,
} from '~/components/archive/MilestoneModal';
import {ProgressRail, type RailStop} from '~/components/archive/ProgressRail';
import {PlateFigure, MilestoneMarker} from '~/components/archive/Plate';
import {
  Scene,
  Stage,
  Flow,
  Ghost,
  TitleScreen,
  useSceneProgress,
} from '~/components/archive/Scene';
import styles from '~/styles/archive.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'The Archive — Jesse Vasquez | JV GOLD'},
    {
      name: 'description',
      content:
        'A scroll-through roadmap of Jesse Vasquez: four straight California state titles, a Pac-12 championship in the desert, a final season at California Baptist, and the build that came next.',
    },
  ];
}

/* ---------------------------------------------------------------- the plates
   Every photograph in the library is placed here — the curated milestones get
   a marker, a result line and a story; the rest are archive plates carrying
   only what the library actually records about them. */

const ERA_LABEL: Record<Era, string> = {
  'four-peat': '2017–2020 — The Four-Peat',
  asu: '2021–2025 — The Desert Years',
  cbu: '2025–2026 — The Last Stand',
  training: '2026 → — The Build',
};

interface MilestoneSeed {
  photoId: string;
  marker: string;
  title: string;
  result: string;
  story: string;
}

/** A plain archive plate — everything it says comes out of the library. */
function eraPlate(era: Era, photoId: string): ArchivePlate {
  const source = photo(photoId);
  return {
    id: source.id,
    photoId: source.id,
    alt: source.alt,
    caption: source.caption,
    eraLabel: ERA_LABEL[era],
  };
}

/**
 * Splits an era's photographs into curated milestones and the gallery wall.
 * `featured` names the frames that get a bespoke placement elsewhere in the
 * chapter, so they are lifted out of the grid instead of appearing twice.
 */
function buildEra(era: Era, seeds: MilestoneSeed[], featured: string[] = []) {
  const eraLabel = ERA_LABEL[era];
  const placed = new Set([...seeds.map((s) => s.photoId), ...featured]);

  const milestones: ArchivePlate[] = seeds.map((seed) => ({
    ...eraPlate(era, seed.photoId),
    marker: seed.marker,
    title: seed.title,
    result: seed.result,
    story: seed.story,
  }));

  const gallery: ArchivePlate[] = byEra(era)
    .filter((p) => !placed.has(p.id))
    .map((p) => ({
      id: p.id,
      photoId: p.id,
      alt: p.alt,
      caption: p.caption,
      eraLabel,
    }));

  return {milestones, gallery};
}

const fourPeat = buildEra('four-peat', [
  {
    photoId: '19HSWCIFF9832',
    marker: 'MARKER 01 — 2019',
    title: 'The Third Title',
    result: 'CIF California State Finals, 2019 — third consecutive title.',
    story:
      'By his junior year the question had stopped being whether he could win a state title and started being whether anyone could stop the streak. Three finals, three times on the top step, and a fourth school year still to come.',
  },
  {
    photoId: '19HSWCIFF9929',
    marker: 'MARKER 02 — 2019',
    title: 'Mind Over Everything',
    result: 'CIF California State Finals, 2019.',
    story:
      'The finger to the temple became the signature. Three high schools in four years — St. John Bosco, Santiago, then Excelsior — meant a new room, a new corner and a new set of doubters every season. The only constant he could carry between them was the way he thought.',
  },
  {
    photoId: '20CIFFNL3798',
    marker: 'MARKER 03 — 2020',
    title: 'The Four-Peat',
    result:
      'Fourth consecutive CIF California state championship — fourth male in state history, first ever from Southern California.',
    story:
      'Four straight state titles across three different high schools. California had produced only three male four-timers before him, and none of them had come out of the southern half of the state. He is a National Wrestling Hall of Fame honoree.',
  },
  {
    photoId: '20CIFFNL3895',
    marker: 'MARKER 04 — 2020',
    title: 'The Name on the Back',
    result: 'CIF California State Finals, 2020 — the fourth title.',
    story:
      'The uniform changed three times. The name across the back never did. By 2020, VASQUEZ was something California wrestling read as a result rather than a surname.',
  },
]);

/* The walkout doubles as this chapter's pinned stage; the stance frame is
   lifted out of the grid and hung full width. */
const desertLead = eraPlate('asu', 'asu_jesse_in_stance');

const desert = buildEra(
  'asu',
  [
    {
      photoId: 'ASU_Walkout_Red',
      marker: 'MARKER 05 — ARIZONA STATE',
      title: 'The Walkout',
      result: 'Arizona State — four seasons, 2021 to 2025.',
      story:
        'Haze, two flame jets and a corridor that opens onto a mat. Nothing is decided in the walk. Everything that decides it already happened months earlier, in a room nobody photographs.',
    },
    {
      photoId: '24COL_NCAA_QRTS_0063',
      marker: 'MARKER 06 — 2024',
      title: 'Pac-12 Champion',
      result: '2023–24 — 11–4, Pac-12 champion at 141 lbs, NCAA qualifier.',
      story:
        'The summit of the desert years. A conference title at 141 pounds and a ticket to the NCAA Championships — earned in the season after an injury-shortened freshman year and a sophomore campaign spent proving the freshman one had not been a fluke.',
    },
    {
      photoId: '24COL_NCAA_RND16_9991',
      marker: 'MARKER 07 — 2024',
      title: 'The National Stage',
      result: 'NCAA Championships, 2024 — 2–2.',
      story:
        'Four matches against the best 141-pounders in the country. Two wins, two losses, and the education that comes from finding the exact line between where you are and where the podium starts.',
    },
    {
      photoId: 'Asu_Match_Shot',
      marker: 'MARKER 08 — ARIZONA STATE',
      title: 'The Moment It Shows',
      result: 'Four desert seasons — 7–1 before injury, then 16–7, 11–4, 13–7.',
      story:
        'A shout at the edge of the mat, the arena out of focus behind it. Four seasons stack up behind a second like this one: the year cut short by injury, the breakout, the conference title, and the last one a weight class up at 149.',
    },
  ],
  [desertLead.photoId],
);

const lastStand = buildEra('cbu', [
  {
    photoId: '25CMW_SCUFFLE_QF_6647',
    marker: 'MARKER 09 — 2025–26',
    title: 'Pinned the No. 20',
    result:
      '2025–26 — 14 matches at 141, seven dual wins, ranked as high as No. 23 nationally.',
    story:
      'A graduate transfer season as a Big 12 starter, wrestling with an MBA course load underneath it. The signature result: a pin over then-No. 20 Pierson Manville — the kind of win that reminds a division a fifth-year competitor is still dangerous.',
  },
  {
    photoId: '25CMW_SCUFFLE_QF_6387',
    marker: 'MARKER 10 — 2026',
    title: 'The Last Uniform',
    result: 'California Baptist University — the last college singlet.',
    story:
      'The season ended the way no athlete plans for: the university cut the wrestling program. He did not go quietly. He became one of three plaintiffs in federal litigation to restore it, and kept training with the Mexico National Team while the case moved.',
  },
]);

/* Chapter 04. Two frames are lifted out of the grid: the wide group shot that
   establishes the room, and the matside portrait that closes the archive and
   doubles as this chapter's pinned stage. */
const theRoom = eraPlate('training', 'deep_waters_team_pic_1');
const afterTheSession = eraPlate('training', 'jesse_sitting_matside');

const build = buildEra(
  'training',
  [
    {
      photoId: 'jesse_coach_behind_shot',
      marker: 'MARKER 11 — MAY 2026',
      title: 'The Room Opens',
      result:
        'Deep Waters Wrestling RTC — founded May 2026, Riverside, California.',
      story:
        'A mat, a roll-up door, and a room that had to be filled one athlete at a time. Between 11 May and 14 June 2026 the club logged 29 registered athletes and 25 active monthly memberships — three of them families training together. That is the whole record so far, and it is the part he is proudest of.',
    },
    {
      photoId: 'Jesse_Coach_Stance',
      marker: 'MARKER 12 — 2026',
      title: 'Same Standard, Other Side',
      result: 'JV GOLD LLC — private coaching, camps and the brand.',
      story:
        'He coaches the way he was coached: position first, no shortcuts, and an honest answer when the honest answer is that you are not there yet. The warm-up top still reads Arizona State. The standard underneath it has not moved.',
    },
    {
      photoId: 'jesse_deep_waters_duo_pic',
      marker: 'MARKER 13 — IN FORMATION',
      title: 'Greater Later',
      result: 'Future Champions — co-founded, not yet launched.',
      story:
        'The nonprofit arm is being built to put this room within reach of families who could not otherwise pay for it. It has not launched, and its 501(c)(3) status is not confirmed. The motto is the only part already finished: Greater Later.',
    },
  ],
  [theRoom.photoId, afterTheSession.photoId],
);

/* Flat, ordered set — this is the walk order in the lightbox, and it follows
   the order the plates appear on the page. */
const plates: ArchivePlate[] = [
  ...fourPeat.milestones,
  ...fourPeat.gallery,
  ...desert.milestones,
  desertLead,
  ...desert.gallery,
  ...lastStand.milestones,
  ...lastStand.gallery,
  theRoom,
  ...build.milestones,
  ...build.gallery,
  afterTheSession,
];

/* ------------------------------------------------------------ gallery layout
   Hand-placed on a 12-column grid so the archive reads as a curated wall
   rather than a uniform contact sheet. */

interface PlateLayout {
  className: string;
  aspect: string;
}

/**
 * The layout arrays are hand-written per chapter, so they only match the
 * library as it stood when they were placed. A photograph added to photos.ts
 * later should land in a plain cell at the end of its wall — never take the
 * route down with an undefined lookup.
 */
const DEFAULT_SLOT: PlateLayout = {
  className: 'col-span-6 md:col-span-4',
  aspect: 'aspect-[4/3]',
};

const slot = (layout: PlateLayout[], i: number): PlateLayout =>
  layout[i] ?? DEFAULT_SLOT;

const fourPeatLayout: PlateLayout[] = [
  {
    className: 'col-span-12 md:col-span-7 md:col-start-1',
    aspect: 'aspect-[16/10]',
  },
  {
    className: 'col-span-6 md:col-span-4 md:col-start-9 md:mt-24',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-6 md:col-span-5 md:col-start-2 md:mt-10',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-8 md:mt-32',
    aspect: 'aspect-square',
  },
  {
    className: 'col-span-6 md:col-span-4 md:col-start-1',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-6 md:mt-20',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-12 md:col-span-3 md:col-start-10 md:mt-8',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-12 md:col-span-8 md:col-start-3 md:mt-16',
    aspect: 'aspect-[16/9]',
  },
];

/* Desert wall — the recruiting graphic and the interview grab are low-resolution
   source material, so both are held small. */
const desertLayout: PlateLayout[] = [
  {
    className: 'col-span-12 md:col-span-6 md:col-start-1',
    aspect: 'aspect-[3/2]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-8 md:mt-24',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-6 md:col-span-5 md:col-start-2 md:mt-12',
    aspect: 'aspect-[16/9]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-9 md:mt-6',
    aspect: 'aspect-[3/4]',
  },
];

const lastStandLayout: PlateLayout[] = [
  {
    className: 'col-span-12 md:col-span-7 md:col-start-1',
    aspect: 'aspect-[16/10]',
  },
  {
    className: 'col-span-10 col-start-3 md:col-span-4 md:col-start-9 md:mt-24',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-8 col-start-3 md:col-span-4 md:col-start-3 md:mt-10',
    aspect: 'aspect-[3/4]',
  },
];

/* The build wall — the widest of the four, because this is the chapter with the
   most people in it. */
const buildLayout: PlateLayout[] = [
  {
    className: 'col-span-12 md:col-span-7 md:col-start-1',
    aspect: 'aspect-[3/2]',
  },
  {
    className: 'col-span-6 md:col-span-4 md:col-start-9 md:mt-24',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-2 md:mt-14',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-12 md:col-span-6 md:col-start-6 md:mt-28',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-6 md:col-span-3 md:col-start-1 md:mt-10',
    aspect: 'aspect-[3/4]',
  },
  {
    className: 'col-span-6 md:col-span-5 md:col-start-5 md:mt-20',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-12 md:col-span-7 md:col-start-6 md:mt-12',
    aspect: 'aspect-[16/9]',
  },
  {
    className: 'col-span-6 md:col-span-4 md:col-start-1 md:mt-16',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-6 md:col-span-4 md:col-start-6 md:mt-24',
    aspect: 'aspect-[4/3]',
  },
  {
    className: 'col-span-12 md:col-span-5 md:col-start-8 md:mt-8',
    aspect: 'aspect-[3/2]',
  },
];

/* --------------------------------------------------------------- the ledger */

const asuSeasons = [
  {
    season: '2021–22',
    record: '7–1 start',
    note: 'Won the Mountaineer Invitational. The season was cut short by injury.',
    peak: false,
  },
  {
    season: '2022–23',
    record: '16–7',
    note: 'Upset No. 6 Allan Hart. Named Pac-12 Wrestler of the Week.',
    peak: false,
  },
  {
    season: '2023–24',
    record: '11–4',
    note: 'Pac-12 champion at 141 lbs. NCAA qualifier — 2–2 at the championships.',
    peak: true,
  },
  {
    season: '2024–25',
    record: '13–7',
    note: 'Moved up to 149 lbs. Six dual wins in his final ASU season.',
    peak: false,
  },
];

const caseFile = [
  ['FILED WITH', 'Pacific Legal Foundation — federal litigation'],
  ['PLAINTIFFS', 'Jesse Vasquez, one of three'],
  ['AT ISSUE', 'The elimination of the men’s wrestling program'],
  ['JUN 3, 2026', 'Preliminary injunction denied'],
  ['JUL 1, 2026', 'Amended complaint filed'],
];

/* Straight off the club's own records for 11 May – 14 June 2026. Nothing here
   is projected, and no money is counted. */
const clubLog = [
  ['29', 'athletes registered with Deep Waters Wrestling RTC'],
  ['25', 'active monthly memberships'],
  ['3', 'families training together in the same room'],
];

const futureChampionsFile = [
  ['ROLE', 'Co-founder'],
  [
    'PURPOSE',
    'To put the same room within reach of families who could not otherwise pay for it',
  ],
  ['LAUNCH', 'Not launched'],
  ['501(C)(3)', 'Status not confirmed'],
  ['MOTTO', 'Greater Later'],
];

const railStops: RailStop[] = [
  {
    id: 'chapter-four-peat',
    index: '01',
    label: 'Four-Peat',
    years: '2017–2020',
  },
  {id: 'chapter-desert', index: '02', label: 'The Desert', years: '2021–2025'},
  {
    id: 'chapter-last-stand',
    index: '03',
    label: 'Last Stand',
    years: '2025–2026',
  },
  {id: 'chapter-build', index: '04', label: 'The Build', years: '2026 →'},
];

/* ------------------------------------------------------------------- route */

export default function ArchiveRoute() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  useSceneProgress(heroRef);

  const openPlate = useCallback((plate: ArchivePlate) => {
    const index = plates.indexOf(plate);
    if (index >= 0) setOpenIndex(index);
  }, []);

  const closePlate = useCallback(() => setOpenIndex(null), []);

  return (
    <div className="ar-root bg-onyx-deep">
      {/* ================================================== HERO — THE ROADMAP */}
      <section
        ref={heroRef}
        className="ar-hero"
        aria-labelledby="ar-hero-title"
      >
        <div className="ar-hero__stage">
          <Img
            id="20CIFFNL3895"
            alt="Jesse Vasquez from behind, arms raised, VASQUEZ across his back"
            size="hero"
            sizes="100vw"
            fill
            className="img-mono ar-hero__bg opacity-55"
          />
          <span className="ar-scrim ar-scrim--vignette" aria-hidden="true" />

          <Ghost
            drift={false}
            className="ar-ghost--stroke left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(9rem,30vw,26rem)] opacity-40"
          >
            2017
          </Ghost>

          <div className="ar-hero__fore ar-container relative flex h-full flex-col justify-end pb-16 text-stone">
            <p className="tag text-gold">THE ROADMAP — 2017 TO NOW</p>
            <h1
              id="ar-hero-title"
              className="display mt-5 text-[clamp(3.2rem,12vw,11rem)]"
            >
              The Arch<span className="text-gold">i</span>ve
            </h1>
            <div className="mt-7 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <p className="max-w-lg text-sm leading-relaxed text-stone/75 md:text-base">
                Not a highlight reel. A road — four chapters long, with every
                marker still standing where it happened. Scroll it end to end,
                or jump to the year you came for.
              </p>
              <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
                <Ticks />
                <span className="ar-scroll-cue tag text-stone/50">
                  SCROLL TO TRAVEL
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== THE ROAD */}
      <div id="ar-road" className="ar-road relative">
        <ProgressRail stops={railStops} roadId="ar-road" />

        {/* ------------------------------------------- 01 — THE FOUR-PEAT */}
        <Scene id="chapter-four-peat" index={1}>
          <Stage>
            <Img
              id="20CIFFNL3798"
              alt=""
              aria-hidden="true"
              size="hero"
              sizes="100vw"
              fill
              className="img-mono ar-parallax opacity-70"
            />
            <span className="ar-scrim ar-scrim--floor" aria-hidden="true" />
            <Ghost className="ar-ghost--stroke right-[-2vw] top-[8vh] text-[clamp(11rem,34vw,30rem)]">
              IV
            </Ghost>
          </Stage>

          <Flow>
            <TitleScreen
              id="chapter-four-peat"
              chapter="01"
              years="2017–2020"
              title={
                <>
                  The Four
                  <span className="text-gold">-</span>Peat
                </>
              }
              standfirst="Three high schools. Four straight California state championships. The singlet kept changing; the result did not."
            />

            <div className="relative bg-onyx-deep pb-24 text-stone md:pb-32">
              <div className="ar-container grid gap-10 border-t rule-light pt-16 md:grid-cols-[1.25fr_1fr] md:gap-16">
                <div data-reveal>
                  <p className="tag text-gold">THE RUN</p>
                  <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone/80">
                    St. John Bosco. Santiago. Excelsior. Four seasons, three
                    schools, four CIF California state titles — the fourth male
                    wrestler in the state&rsquo;s history to win four in a row,
                    and the first ever to do it out of Southern California. A
                    National Wrestling Hall of Fame honoree.
                  </p>
                  <Ticks className="mt-8" />
                </div>

                <ul className="ar-records" data-reveal>
                  {[
                    '4× consecutive CIF California state champion',
                    'First Southern California wrestler ever to four-peat',
                    'Fourth male in California history to win four straight',
                    'National Wrestling Hall of Fame honoree',
                    '2× Super 32 finalist · Doc Buchanan finalist',
                    'Walsh Ironman runner-up as a freshman',
                  ].map((record) => (
                    <li key={record}>{record}</li>
                  ))}
                </ul>
              </div>

              <div className="ar-container mt-20">
                <p className="tag mb-8 text-stone/45" data-reveal>
                  MARKERS 01 — 04 · OPEN ONE
                </p>
                <ol className="ar-markers">
                  {fourPeat.milestones.map((plate, i) => (
                    <MilestoneMarker
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      offset={i % 2 === 1}
                      revealDelay={i * 70}
                    />
                  ))}
                </ol>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-stone/45" data-reveal>
                  PLATES 05–12 · THE HIGH SCHOOL YEARS
                </p>
                <div className="grid grid-cols-12 gap-x-4 gap-y-10 md:gap-x-6">
                  {fourPeat.gallery.map((plate, i) => (
                    <PlateFigure
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      aspect={slot(fourPeatLayout, i).aspect}
                      className={slot(fourPeatLayout, i).className}
                      sizes="(min-width: 768px) 40vw, 50vw"
                      revealDelay={(i % 3) * 90}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Flow>
        </Scene>

        {/* -------------------------------------- 02 — THE DESERT YEARS */}
        <Scene id="chapter-desert" index={2}>
          <Stage>
            <Img
              id="ASU_Walkout_Red"
              alt=""
              aria-hidden="true"
              size="hero"
              sizes="100vw"
              fill
              className="img-mono ar-parallax object-[50%_30%] opacity-75"
            />
            <span className="ar-scrim ar-scrim--arena" aria-hidden="true" />
            <Ghost className="ar-ghost--solid left-[-3vw] top-1/2 -translate-y-1/2 text-[clamp(9rem,26vw,22rem)]">
              ASU
            </Ghost>
          </Stage>

          <Flow>
            <TitleScreen
              id="chapter-desert"
              chapter="02"
              years="2021–2025"
              align="right"
              title={
                <>
                  The Desert
                  <br />
                  Years
                </>
              }
              standfirst="Four seasons at Arizona State. An injury, a comeback, and then a conference crown."
            />

            <div className="relative bg-onyx pb-24 text-stone md:pb-32">
              <div className="ar-container border-t border-gold/40 pt-16">
                <div className="grid gap-10 md:grid-cols-[1fr_1.15fr] md:gap-16">
                  <div data-reveal>
                    <p className="tag text-gold">ARIZONA STATE</p>
                    <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone/80">
                      A 7–1 start as a freshman, ended early by injury. A
                      breakout sophomore season with an upset of the
                      nation&rsquo;s No.{'\u00a0'}6. Then the summit: the 2024
                      Pac-12 championship at 141 pounds and a trip to the NCAA
                      Championships. He finished the degree on the way through —
                      a B.S. in Interdisciplinary Studies, psychology and
                      business, December 2024.
                    </p>
                    <Ticks className="mt-8" />
                  </div>

                  <div
                    data-reveal
                    style={{'--reveal-delay': '120ms'} as React.CSSProperties}
                  >
                    <table className="ar-ledger tabular">
                      <caption>Season ledger — Arizona State</caption>
                      <thead>
                        <tr>
                          <th scope="col">Season</th>
                          <th scope="col">Record</th>
                          <th scope="col">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asuSeasons.map((row) => (
                          <tr
                            key={row.season}
                            data-peak={row.peak ? 'true' : undefined}
                          >
                            <th scope="row">{row.season}</th>
                            <td>{row.record}</td>
                            <td>{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="ar-container mt-20">
                <p className="tag mb-8 text-stone/45" data-reveal>
                  MARKERS 05 — 08 · OPEN ONE
                </p>
                <ol className="ar-markers">
                  {desert.milestones.map((plate, i) => (
                    <MilestoneMarker
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      offset={i % 2 === 1}
                      revealDelay={i * 70}
                    />
                  ))}
                </ol>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-stone/45" data-reveal>
                  PLATE 17 · ABANDON ALL HOPE
                </p>
                {/* Hung uncropped: the banner runs along the very top edge and
                    his feet sit on the very bottom one, so any band crop loses
                    one or the other. Width does the work instead. */}
                <PlateFigure
                  plate={desertLead}
                  onOpen={openPlate}
                  aspect="aspect-[3/2]"
                  className="mx-auto w-full max-w-5xl"
                  sizes="(min-width: 1024px) 64rem, 100vw"
                  focus="center"
                  priority
                />
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-stone/45" data-reveal>
                  PLATES 18–21 · THE DESERT
                </p>
                <div className="grid grid-cols-12 gap-x-4 gap-y-10 md:gap-x-6">
                  {desert.gallery.map((plate, i) => (
                    <PlateFigure
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      aspect={slot(desertLayout, i).aspect}
                      className={slot(desertLayout, i).className}
                      sizes="(min-width: 768px) 40vw, 50vw"
                      revealDelay={(i % 3) * 90}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Flow>
        </Scene>

        {/* ---------------------------------------- 03 — THE LAST STAND */}
        <Scene id="chapter-last-stand" index={3}>
          <Stage>
            <Img
              id="25CMW_SCUFFLE_QF_6647"
              alt=""
              aria-hidden="true"
              size="hero"
              sizes="100vw"
              fill
              className="img-mono ar-parallax opacity-65"
            />
            <span className="ar-scrim ar-scrim--vignette" aria-hidden="true" />
            <Ghost className="ar-ghost--stroke left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[clamp(8rem,26vw,22rem)]">
              2026
            </Ghost>
          </Stage>

          <Flow>
            <TitleScreen
              id="chapter-last-stand"
              chapter="03"
              years="2025–2026"
              align="center"
              title={
                <>
                  The Last
                  <br />
                  Stand
                </>
              }
              standfirst="A graduate transfer, a Big 12 starting spot, and a program cut out from under him."
            />

            <div className="relative bg-onyx-deep pb-24 text-stone md:pb-32">
              <div className="ar-container border-t rule-light pt-16">
                <p
                  className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-stone/80"
                  data-reveal
                >
                  He came to California Baptist for an MBA program and one last
                  college season. He got both: 14{' '}matches at 141, seven dual
                  wins, a Big{' '}12 starting spot and a national ranking as
                  high as No.{' '}23, capped by a pin over then-No.{' '}20
                  Pierson Manville. Then the university eliminated the wrestling
                  program — and he chose to fight for it rather than fade out of
                  it.
                </p>

                <ul
                  className="ar-records mx-auto mt-12 max-w-2xl"
                  data-reveal
                  style={{'--reveal-delay': '110ms'} as React.CSSProperties}
                >
                  {[
                    '14 matches at 141 lbs · seven dual wins',
                    'Ranked as high as No. 23 nationally',
                    'Big 12 starter · pin over then-No. 20 Pierson Manville',
                    'Mexico National Team athlete',
                    'MBA candidate at California Baptist — targeting August 2026',
                  ].map((record) => (
                    <li key={record}>{record}</li>
                  ))}
                </ul>
              </div>

              <div className="ar-container mt-20">
                <div
                  className="ar-file mx-auto max-w-3xl p-6 md:p-9"
                  data-reveal
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="tag text-gold">THE CASE FILE</p>
                    <p className="ar-file__status tag text-gold">
                      <span className="ar-file__pulse" aria-hidden="true" />
                      STATUS — ACTIVE
                    </p>
                  </div>

                  <dl className="mt-6">
                    {caseFile.map(([term, detail]) => (
                      <div key={term} className="ar-file__row">
                        <dt className="tag text-stone/45">{term}</dt>
                        <dd className="m-0 text-stone/80">{detail}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-6 text-xs leading-relaxed text-stone/45">
                    The case is open. Nothing here predicts how it ends — the
                    archive only keeps the record.
                  </p>
                </div>
              </div>

              <div className="ar-container mt-20">
                <p className="tag mb-8 text-stone/45" data-reveal>
                  MARKERS 09 — 10 · OPEN ONE
                </p>
                <ol className="ar-markers">
                  {lastStand.milestones.map((plate, i) => (
                    <MilestoneMarker
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      offset={i % 2 === 1}
                      revealDelay={i * 70}
                    />
                  ))}
                </ol>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-stone/45" data-reveal>
                  PLATES 24–26 · THE LAST SEASON
                </p>
                <div className="grid grid-cols-12 gap-x-4 gap-y-10 md:gap-x-6">
                  {lastStand.gallery.map((plate, i) => (
                    <PlateFigure
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      aspect={slot(lastStandLayout, i).aspect}
                      className={slot(lastStandLayout, i).className}
                      sizes="(min-width: 768px) 55vw, 90vw"
                      revealDelay={i * 100}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Flow>
        </Scene>

        {/* ------------------------------------------- 04 — THE BUILD */}
        <Scene id="chapter-build" index={4} className="ar-tone-light">
          <Stage className="bg-stone-warm">
            <Img
              id="jesse_sitting_matside"
              alt=""
              aria-hidden="true"
              size="hero"
              sizes="100vw"
              fill
              className="img-mono ar-parallax object-[42%_28%] opacity-75"
            />
            <span className="ar-scrim ar-scrim--warm" aria-hidden="true" />
            <span className="ar-scrim ar-scrim--grid" aria-hidden="true" />
            <Ghost className="ar-ghost--stroke-deep right-[-2vw] top-[10vh] text-[clamp(8rem,26vw,22rem)]">
              NOW
            </Ghost>
          </Stage>

          <Flow>
            <TitleScreen
              id="chapter-build"
              chapter="04"
              years="2026 →"
              tone="light"
              title={
                <>
                  The <span className="text-gold-deep">Build</span>
                </>
              }
              standfirst="The competing chapter closes. The building chapter is the one he was training for."
            />

            <div className="relative bg-stone pb-24 text-onyx md:pb-32">
              <div className="ar-container border-t rule pt-16">
                <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
                  <div data-reveal>
                    <p className="tag text-gold-deep">RIVERSIDE, CALIFORNIA</p>
                    <h3 className="display mt-5 text-[clamp(1.9rem,4.4vw,3.4rem)]">
                      Greater Later
                    </h3>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-onyx/75">
                      Deep Waters Wrestling RTC opened in Riverside in May 2026.
                      JV GOLD LLC carries the private coaching. Future
                      Champions, the nonprofit arm, is being co-founded and has
                      not launched. No trophies in this chapter yet — only a
                      room, a schedule and the people who keep turning up to it.
                    </p>
                    <Ticks className="mt-8" />
                  </div>

                  <ul className="ar-records" data-reveal>
                    {[
                      'Deep Waters Wrestling RTC — Riverside, California, founded May 2026',
                      'JV GOLD LLC — private coaching',
                      'Future Champions — co-founded, not yet launched',
                      'Mexico National Team athlete',
                      'MBA candidate, California Baptist — August 2026',
                    ].map((record) => (
                      <li key={record}>{record}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="ar-container mt-20">
                <p className="tag mb-10 text-steel" data-reveal>
                  FROM THE CLUB RECORDS — 11 MAY TO 14 JUNE 2026
                </p>
                <div className="grid gap-10 sm:grid-cols-3">
                  {clubLog.map(([stat, label], i) => (
                    <div
                      key={label}
                      data-reveal
                      style={
                        {'--reveal-delay': `${i * 90}ms`} as React.CSSProperties
                      }
                    >
                      <p className="display outline-type tabular text-[clamp(2.6rem,6vw,5rem)]">
                        {stat}
                      </p>
                      <p className="mt-4 max-w-[26ch] text-xs leading-relaxed text-steel">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-steel" data-reveal>
                  PLATE 27 · THE WHOLE ROOM
                </p>
                {/* Forty-five faces, none of them large. Full width, and the
                    desktop crop only ever takes ceiling and bare mat. */}
                <PlateFigure
                  plate={theRoom}
                  onOpen={openPlate}
                  aspect="aspect-[3/2] md:aspect-[2/1]"
                  className="w-full"
                  sizes="100vw"
                  focus="center"
                  priority
                />
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-8 text-steel" data-reveal>
                  MARKERS 11 — 13 · OPEN ONE
                </p>
                <ol className="ar-markers">
                  {build.milestones.map((plate, i) => (
                    <MilestoneMarker
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      offset={i % 2 === 1}
                      revealDelay={i * 70}
                    />
                  ))}
                </ol>
              </div>

              <div className="ar-container mt-20">
                <div
                  className="ar-file mx-auto max-w-3xl p-6 md:p-9"
                  data-reveal
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="tag text-gold-deep">FUTURE CHAMPIONS</p>
                    <p className="ar-file__status tag text-gold-deep">
                      <span className="ar-file__pulse" aria-hidden="true" />
                      STATUS — IN FORMATION
                    </p>
                  </div>

                  <dl className="mt-6">
                    {futureChampionsFile.map(([term, detail]) => (
                      <div key={term} className="ar-file__row">
                        <dt className="tag text-steel">{term}</dt>
                        <dd className="m-0 text-onyx/75">{detail}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-6 text-xs leading-relaxed text-steel">
                    Nothing on this card is a promise. When it launches, the
                    archive will say so — and not a day earlier.
                  </p>
                </div>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-steel" data-reveal>
                  PLATES 31–40 · THE ROOM, DAY TO DAY
                </p>
                <div className="grid grid-cols-12 gap-x-4 gap-y-10 md:gap-x-6">
                  {build.gallery.map((plate, i) => (
                    <PlateFigure
                      key={plate.id}
                      plate={plate}
                      onOpen={openPlate}
                      aspect={slot(buildLayout, i).aspect}
                      className={slot(buildLayout, i).className}
                      sizes="(min-width: 768px) 40vw, 50vw"
                      revealDelay={(i % 3) * 90}
                    />
                  ))}
                </div>
              </div>

              <div className="ar-container mt-24">
                <p className="tag mb-10 text-steel" data-reveal>
                  PLATE 41 · AFTER THE SESSION
                </p>
                <PlateFigure
                  plate={afterTheSession}
                  onOpen={openPlate}
                  aspect="aspect-[3/2]"
                  className="mx-auto w-full max-w-6xl"
                  sizes="(min-width: 1152px) 72rem, 100vw"
                  focus="center"
                  priority
                />
              </div>

              <figure className="ar-container mt-20" data-reveal>
                <blockquote className="display max-w-4xl text-[clamp(1.5rem,3.6vw,2.8rem)] text-onyx">
                  “The hard chapter is not the last chapter.”
                </blockquote>
                <figcaption className="tag mt-6 text-steel">
                  #GREATER_LATER
                </figcaption>
              </figure>
            </div>
          </Flow>
        </Scene>
      </div>

      {/* ============================================ THE ROAD CONTINUES */}
      <section className="relative overflow-hidden bg-onyx-deep text-stone">
        <Img
          id="19HSWCIFF9945"
          alt=""
          aria-hidden="true"
          size="hero"
          sizes="100vw"
          fill
          className="img-mono object-top opacity-25"
        />
        <div className="relative">
          <div className="ar-container py-24 md:py-36">
            <p className="tag text-gold" data-reveal>
              THE ROAD CONTINUES
            </p>
            <h2
              className="display mt-6 max-w-4xl text-[clamp(2.4rem,6.5vw,5.6rem)]"
              data-reveal
              style={{'--reveal-delay': '90ms'} as React.CSSProperties}
            >
              The archive stops here.
              <br />
              The work doesn&rsquo;t.
            </h2>

            <div className="mt-14 grid gap-px border rule-light bg-white/10 md:grid-cols-2">
              <Link
                to="/deep-waters"
                className="group flex flex-col justify-between gap-10 bg-onyx-deep p-8 transition-colors hover:bg-onyx md:p-12"
              >
                <div>
                  <p className="tag text-gold-deep">01 — THE ROOM</p>
                  <h3 className="display mt-5 text-[clamp(1.6rem,3.2vw,2.6rem)]">
                    Deep Waters Wrestling
                  </h3>
                  <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone/65">
                    The Riverside club built on technique, discipline and family
                    — elite enough for champions, welcoming enough for a new kid
                    on day one.
                  </p>
                </div>
                <span className="tag text-stone/60 transition-colors group-hover:text-gold">
                  THE DEEP WATERS STORY
                </span>
              </Link>

              <Link
                to="/train"
                className="group flex flex-col justify-between gap-10 bg-onyx-deep p-8 transition-colors hover:bg-onyx md:p-12"
              >
                <div>
                  <p className="tag text-gold-deep">02 — THE STANDARD</p>
                  <h3 className="display mt-5 text-[clamp(1.6rem,3.2vw,2.6rem)]">
                    Train With Jesse
                  </h3>
                  <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone/65">
                    Focused coaching, honest feedback, and a plan built around
                    your athlete — from a coach who has lived every level of
                    this sport.
                  </p>
                </div>
                <span className="tag text-stone/60 transition-colors group-hover:text-gold">
                  BOOK A SESSION
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MilestoneModal
        plates={plates}
        index={openIndex}
        onClose={closePlate}
        onNavigate={setOpenIndex}
      />
    </div>
  );
}
