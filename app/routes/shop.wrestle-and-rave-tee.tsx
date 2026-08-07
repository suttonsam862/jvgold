import {useState} from 'react';
import {Link} from 'react-router';
import {GarmentPlate} from '~/components/shop/GarmentPlate';
import {SizeSelector, type SizeOption} from '~/components/shop/SizeSelector';
import styles from '~/styles/shop.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Wrestle and Rave Tee — JV GOLD'},
    {
      name: 'description',
      content:
        'The Wrestle and Rave Tee — $30, black cotton, 1990s bootleg rap tee graphic, screen printed with 92 grain screens. Youth S through Adult XL.',
    },
  ];
}

/* ------------------------------------------------------------------ stock
 * INVENTORY — the single source of truth for size availability.
 *
 * The client has not sent quantities yet, so every size is `null`: "not
 * confirmed". A null size renders neutral and selectable with no badge and no
 * count. Set a size to `false` the moment it is confirmed sold out and it will
 * strike through and stop being selectable; set it to `true` for confirmed in
 * stock. Never put a number or a scarcity line in here — the UI does not have
 * a place to show one and it is not going to grow one.
 */
const INVENTORY: Record<string, boolean | null> = {
  'youth-s': null,
  'youth-m': null,
  'youth-l': null,
  'adult-s': null,
  'adult-m': null,
  'adult-l': null,
  'adult-xl': null,
};

const SIZES: SizeOption[] = [
  {value: 'youth-s', label: 'YS', name: 'Youth Small'},
  {value: 'youth-m', label: 'YM', name: 'Youth Medium'},
  {value: 'youth-l', label: 'YL', name: 'Youth Large'},
  {value: 'adult-s', label: 'S', name: 'Adult Small'},
  {value: 'adult-m', label: 'M', name: 'Adult Medium'},
  {value: 'adult-l', label: 'L', name: 'Adult Large'},
  {value: 'adult-xl', label: 'XL', name: 'Adult Extra Large'},
].map((size) => ({...size, available: INVENTORY[size.value] ?? null}));

const DETAILS = [
  ['Price', '$30'],
  ['Colour', 'Black'],
  ['Sizes', 'Youth S–L, Adult S–XL'],
  ['Print', 'Screen printed, 92 grain screens'],
  ['Graphic', 'Chrome gradient lettering, cut-out photography, firework bursts'],
];

export default function WrestleAndRaveTee() {
  const [size, setSize] = useState<string | null>(null);
  const selected = SIZES.find((s) => s.value === size) ?? null;

  return (
    <div className="shop">
      <div className="mx-auto max-w-[1440px] px-5 pt-8 md:px-10 md:pt-10">
        <nav aria-label="Breadcrumb">
          <ol className="tag flex items-center gap-2 text-onyx/50">
            <li>
              <Link to="/shop" className="transition-colors hover:text-onyx">
                SHOP
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-onyx/80">
              WRESTLE AND RAVE TEE
            </li>
          </ol>
        </nav>
      </div>

      <section className="mx-auto grid max-w-[1440px] items-start gap-12 px-5 pb-16 pt-8 md:grid-cols-2 md:gap-16 md:px-10 md:pb-24 md:pt-12">
        <GarmentPlate
          alt="The Wrestle and Rave Tee, black, with chrome gradient WRESTLE AND RAVE lettering, cut-out wrestler photography and firework bursts"
          loading="eager"
        />

        <div>
          <p className="tag mb-5 text-gold-deep">92 GRAIN — SMALL RUN</p>
          <h1 className="display text-[clamp(2.2rem,5vw,4rem)] leading-[0.95]">
            Wrestle and
            <br />
            Rave Tee
          </h1>
          <p className="display mt-6 text-2xl">$30</p>

          <p className="mt-6 max-w-lg leading-relaxed text-onyx/75">
            A 1990s bootleg rap tee, done properly: chrome gradient lettering
            over cut-out wrestler photography and firework bursts, on black
            cotton. Printed through 92 grain screens, so the ink lays thin and
            sits in the fabric instead of on top of it — soft on day one and
            softer after every wash.
          </p>

          {/* SIZE */}
          <div className="mt-10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="size-label" className="tag text-onyx/60">
                SIZE
              </h2>
              <p className="text-sm text-onyx/60" aria-live="polite">
                {selected ? selected.name : 'Choose a size'}
              </p>
            </div>
            <div className="mt-4">
              <SizeSelector
                sizes={SIZES}
                value={size}
                onChange={setSize}
                labelledBy="size-label"
                describedBy="size-hint"
              />
            </div>
            <p id="size-hint" className="mt-3 text-sm leading-relaxed text-onyx/55">
              Youth S through Adult XL. Availability by size is still being
              confirmed and will be shown here before the tee goes on sale.
            </p>
          </div>

          {/* CTA — honest, and deliberately inert.
              There is no Shopify product and no cart wiring behind this shirt,
              so the button announces that instead of pretending to check out. */}
          <div className="mt-9">
            <button
              type="button"
              disabled
              aria-describedby="cta-note"
              className="display w-full cursor-not-allowed border border-onyx/25 bg-transparent px-8 py-4 text-[0.8rem] tracking-[0.16em] text-onyx/45 sm:w-auto"
            >
              Available soon
            </button>
            <p id="cta-note" className="mt-3 max-w-md text-sm leading-relaxed text-onyx/55">
              Not on sale yet. The run is still on the press — when it is ready
              this page takes orders.
            </p>
          </div>

          {/* DETAILS */}
          <dl className="mt-12 border-t rule">
            {DETAILS.map(([term, value]) => (
              <div
                key={term}
                className="flex flex-col gap-1 border-b rule py-4 sm:flex-row sm:gap-8"
              >
                <dt className="tag w-40 shrink-0 text-onyx/50">
                  {term.toUpperCase()}
                </dt>
                <dd className="leading-relaxed text-onyx/75">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* PRINT NOTE */}
      <section className="border-y rule bg-stone-warm">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-10 md:py-20">
          <h2 className="display text-[clamp(1.7rem,3.8vw,2.8rem)] leading-tight">
            Why it feels like a shirt you already own
          </h2>
          <div className="space-y-5 leading-relaxed text-onyx/70">
            <p>
              A 92 grain screen holds back most of the ink. What passes through
              is a thin film that settles into the weave and takes the texture
              of the cotton with it — you can still see the knit through the
              graphic, which is exactly what a coarse screen and a heavy pad of
              plastisol destroy.
            </p>
            <p>
              Thick prints go stiff, catch the light, and crack off in sheets.
              Thin ones stay soft, move with the fabric and fade evenly, so the
              shirt gets better instead of dying. That is the whole trick behind
              every vintage tee worth keeping, and there is no shortcut to it.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING BAND */}
      <section className="shop-dark bg-onyx text-stone">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-6 px-5 py-20 md:px-10 md:py-28">
          <p className="tag text-gold">JV GOLD</p>
          <h2 className="display max-w-2xl text-[clamp(2rem,5vw,4rem)] leading-[0.95]">
            One style, printed right.
          </h2>
          <Link
            to="/shop"
            className="display border border-stone/40 px-8 py-4 text-[0.8rem] tracking-[0.14em] transition-colors hover:bg-stone hover:text-onyx-deep"
          >
            Back to the Shop
          </Link>
        </div>
      </section>
    </div>
  );
}
