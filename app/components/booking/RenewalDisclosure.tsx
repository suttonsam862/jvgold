import {PRE_RENEWAL_NOTICE_WIRED} from '~/lib/offerings';
import type {RenewalTerms} from '~/lib/offerings';

/**
 * The auto-renewal disclosure block.
 *
 * California's Automatic Renewal Law (Bus & Prof Code 17600 et seq., amended by
 * AB 2863, effective July 2025) and federal ROSCA both require these four facts
 * to be "clear and conspicuous" before a recurring charge is authorised: that it
 * continues until cancelled, the recurring amount and its frequency, the minimum
 * commitment, and how to get out. Jesse sells from Riverside to California
 * families, so this applies to every renewing plan on /train.
 *
 * "Clear and conspicuous" is why this is a set-off box in larger, higher-contrast
 * type rather than another line of body copy — the same words at `text-xs
 * text-stone/45` would not satisfy it. It renders twice on purpose: beside the
 * term selector, and again beside the consent control and the billing figures.
 *
 * EVERY SENTENCE HERE COMES FROM `renewalTerms()`. Do not hand-write a rate, a
 * cycle count or a cancellation promise into this file — a disclosure that
 * drifts from the money is worse than no disclosure at all.
 *
 * This is researched fact, not legal advice: a California attorney should review
 * this flow before launch.
 */
interface RenewalDisclosureProps {
  renewal: RenewalTerms;
  /** `compact` drops to the two lines the receipt rail has room for. */
  variant?: 'full' | 'compact';
  className?: string;
}

export function RenewalDisclosure({
  renewal,
  variant = 'full',
  className = '',
}: RenewalDisclosureProps) {
  const lines =
    variant === 'compact'
      ? [renewal.amountLine, renewal.cancelLine]
      : [renewal.amountLine, renewal.commitmentLine, renewal.cancelLine];

  return (
    <div className={`bk-disclose ${className}`.trim()}>
      <p className="tag bk-disclose-tag">AUTOMATIC RENEWAL</p>
      <p className="display bk-disclose-head mt-2">{renewal.headline}</p>
      <ul className="bk-disclose-list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {/*
         * The 15–45 day pre-renewal reminder a 12-month term requires is an
         * obligation Jesse owes, not a promise the site may make while nothing
         * sends it. `PRE_RENEWAL_NOTICE_WIRED` stays false until the send is
         * genuinely wired; telling a family a reminder is coming when none is
         * scheduled is the exact failure the notice exists to prevent.
         */}
        {PRE_RENEWAL_NOTICE_WIRED && renewal.preRenewalNoticeDays ? (
          <li>
            We email you between {renewal.preRenewalNoticeDays.max} and{' '}
            {renewal.preRenewalNoticeDays.min} days before it renews.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
