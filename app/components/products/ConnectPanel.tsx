/**
 * Two honest panels.
 *
 * `ConnectPanel` explains, in plain language, what the catalogue below becomes
 * once the Shopify store is linked — because right now it is a list of things
 * that do not exist in any store, and the coach deserves to know that.
 *
 * `OfferingCoverage` reconciles the six real bookable offerings in
 * `~/lib/offerings.ts` against the catalogue, so a missing or mispriced
 * product is visible rather than inferred.
 */

import {formatMoney} from '~/lib/ops/types';
import type {IntegrationStatus} from '~/lib/ops/types';
import {StatusDot} from './ProductRow';
import type {OfferingCoverage as Coverage} from './productsState';

/* ------------------------------------------------------- what happens next */

interface ConnectPanelProps {
  notSynced: number;
  total: number;
  shopify: IntegrationStatus | null;
}

const STEPS: {index: string; title: string; body: string}[] = [
  {
    index: '01',
    title: 'Each row becomes a Shopify product',
    body: 'Title, handle, description, tags, vendor and status are created as a real product record. The handle set here becomes the store URL, so it is fixed from that moment on.',
  },
  {
    index: '02',
    title: 'Each price becomes a variant',
    body: 'Price, compare-at price and SKU are written to the default variant. Camps and apparel keep their per-variant inventory; sessions stay untracked, because a coaching hour has no stock count.',
  },
  {
    index: '03',
    title: 'They appear in the Shopify mobile app',
    body: 'Once created, the catalogue shows up in the Shopify app on Jesse’s phone — the same products, editable from either place, with orders and payouts landing in the same account.',
  },
  {
    index: '04',
    title: 'Bookings and reporting connect',
    body: '/train checkout starts creating real orders against these products, and Shopify analytics starts reporting on them — units sold, revenue and conversion per offering, no longer seed figures.',
  },
];

export function ConnectPanel({notSynced, total, shopify}: ConnectPanelProps) {
  return (
    <section
      className="pm-connect"
      data-reveal
      aria-labelledby="pm-connect-heading"
    >
      <div className="pm-connect-head">
        <p className="tag text-gold-deep">What happens on connect</p>
        <h2 id="pm-connect-heading" className="display pm-connect-title">
          Nothing here is in Shopify yet
        </h2>
        <p className="pm-connect-lede">
          {shopify?.detail ??
            'Store not linked. Everything below is held locally.'}{' '}
          <span className="tabular">{notSynced}</span> of{' '}
          <span className="tabular">{total}</span> products would be created the
          first time the store is linked.
        </p>
      </div>

      <ol className="pm-steps">
        {STEPS.map((step) => (
          <li key={step.index} className="pm-step">
            <p className="tabular pm-step-index">{step.index}</p>
            <div>
              <h3 className="pm-step-title">{step.title}</h3>
              <p className="pm-step-body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="pm-connect-foot">
        Until then, edits on this page live in this browser tab and are lost on
        reload. That is deliberate — a saved change that quietly went nowhere
        would be worse than no save at all.
      </p>
    </section>
  );
}

/* ------------------------------------------------------ offering coverage */

export function OfferingCoveragePanel({rows}: {rows: readonly Coverage[]}) {
  const covered = rows.filter((r) => r.productId !== null).length;

  return (
    <section
      className="pm-coverage"
      data-reveal
      aria-labelledby="pm-coverage-heading"
    >
      <div className="pm-section-head">
        <h2 id="pm-coverage-heading" className="tag text-gold-deep">
          Offering coverage
        </h2>
        <p className="tabular pm-section-meta">
          {covered} of {rows.length} offerings sold
        </p>
      </div>

      <ul className="pm-coverage-list">
        {rows.map((row) => (
          <li key={row.offeringId} className="pm-coverage-row">
            <p className="tabular pm-coverage-index">{row.index}</p>
            <div className="pm-coverage-main">
              <p className="pm-coverage-name">{row.name}</p>
              <p className="pm-coverage-sub">
                /train advertises {row.advertised}
              </p>
            </div>
            <div className="pm-coverage-state">
              {row.productId ? (
                <>
                  <p className="tabular pm-coverage-price">
                    {formatMoney(row.priceCents ?? 0)}
                  </p>
                  <div className="pm-coverage-badges">
                    {row.productStatus ? (
                      <StatusDot status={row.productStatus} />
                    ) : null}
                    <span className="pm-sync" data-sync={row.synced ? 'synced' : 'pending'}>
                      <span className="pm-sync-mark" aria-hidden="true" />
                      {row.synced ? 'Synced' : 'Not synced'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="pm-coverage-missing">No product attached</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
