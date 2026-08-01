/**
 * ============================================================================
 * CLIENT LIST — DETAIL SHEET
 * ============================================================================
 *
 * The full record behind one roster row: profile, package, compliance
 * checklist, session history and payment history.
 *
 * It is a modal dialog and is built like one:
 *   - `role="dialog"` + `aria-modal` + a labelled heading;
 *   - focus moves in on open and is RESTORED to the row button on close;
 *   - Tab and Shift+Tab wrap inside the panel — the roster behind it is never
 *     reachable while the sheet is up;
 *   - Escape closes, as does the backdrop and the close button;
 *   - the document scroll is locked so the page behind does not slide away
 *     under a phone thumb.
 *
 * The sheet is driven by the `client` URL param, not by component state, so a
 * link to one athlete's record is shareable and the browser's back button
 * closes the sheet rather than leaving the page.
 */

import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import type {Client, IsoDate, Payment, TrainingSession} from '~/lib/ops/types';
import {ageOn, daysBetween, formatClock, formatMoney} from '~/lib/ops/types';
import {formatDate, formatSince} from './filterModel';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ClientDetailSheet({
  client,
  sessions,
  payments,
  anchorDate,
  onClose,
}: {
  client: Client;
  /** This athlete's sessions, newest first. */
  sessions: TrainingSession[];
  /** This athlete's payments, newest first. */
  payments: Payment[];
  anchorDate: IsoDate;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = panelRef.current;
      if (!node) return;
      // Re-queried on every Tab: the panel's content is long and scrolls, and
      // a list captured at mount would go stale the moment anything re-renders.
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Send focus back where it came from, or the roster loses its place.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [client.id, onClose]);

  const age = client.dateOfBirth ? ageOn(client.dateOfBirth, anchorDate) : null;
  const pkg = client.packages;
  const compliance = client.compliance;

  const paidSessions = sessions.filter((s) => s.paid).length;
  const unpaidSessions = sessions.filter(
    (s) => !s.paid && s.amountCents > 0 && s.status !== 'cancelled',
  );

  const checklist: {label: string; ok: boolean; detail: string}[] = [
    {
      label: 'USA Wrestling card',
      ok: Boolean(compliance.usawCardNumber),
      detail: compliance.usawCardNumber ?? 'Not on file — required to compete',
    },
    {
      label: 'Health insurance',
      ok: compliance.hasHealthInsurance === true,
      detail:
        compliance.hasHealthInsurance === true
          ? [compliance.insuranceProvider, compliance.insurancePolicyNumber]
              .filter(Boolean)
              .join(' · ') || 'Confirmed'
          : compliance.hasHealthInsurance === false
            ? 'Declared none'
            : 'Never asked',
    },
    {
      label: 'Liability waiver',
      ok: compliance.waiverSigned,
      detail: compliance.waiverSigned ? 'Signed' : 'Unsigned — blocks mat time',
    },
    {
      label: 'Emergency contact',
      ok: Boolean(compliance.emergencyContactPhone),
      detail:
        [compliance.emergencyContactName, compliance.emergencyContactPhone]
          .filter(Boolean)
          .join(' · ') || 'Not on file',
    },
  ];

  return (
    <div className="clients-sheet-root">
      {/* Backdrop. Presentational — Escape and the close button are the real
          controls, and the button below is a genuine focusable element. */}
      <button
        type="button"
        className="clients-sheet-scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className="clients-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-sheet-title"
        ref={panelRef}
      >
        <header className="clients-sheet-head">
          <div className="clients-sheet-head-id">
            <p className="tag text-gold-deep">{client.accountLabel}</p>
            <h2 id="clients-sheet-title" className="display clients-sheet-title">
              {client.name}
            </h2>
            <p className="clients-sheet-meta">
              <span className="clients-status" data-status={client.status}>
                <span className="clients-status-dot" aria-hidden="true" />
                {client.status}
              </span>
              <span className="clients-sheet-dot" aria-hidden="true" />
              {client.level}
              {age !== null ? ` · ${age}` : ''}
              {client.familyGroup ? (
                <>
                  <span className="clients-sheet-dot" aria-hidden="true" />
                  {client.familyGroup}
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="clients-sheet-close"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close client record</span>
          </button>
        </header>

        <div className="clients-sheet-body">
          {/* ------------------------------------------------------ FIGURES */}
          <dl className="clients-sheet-figures">
            <Figure
              label="Lifetime value"
              value={formatMoney(client.lifetimeValueCents)}
              accent
            />
            <Figure
              label="Balance"
              value={
                client.balanceCents > 0 ? formatMoney(client.balanceCents) : '—'
              }
              tone={client.balanceCents > 0 ? 'owing' : undefined}
            />
            <Figure label="Sessions left" value={`${pkg.remaining ?? 0}`} />
            <Figure
              label="Last session"
              value={formatSince(
                client.lastSessionAt
                  ? daysBetween(client.lastSessionAt, anchorDate)
                  : null,
              )}
            />
          </dl>

          {/* ------------------------------------------------------ PROFILE */}
          <Section title="Profile">
            <dl className="clients-sheet-list">
              <Row label="Guardian" value={client.guardian ?? '—'} />
              <Row label="Email" value={client.email ?? '—'} />
              <Row label="Phone" value={client.phone ?? '—'} />
              <Row label="School" value={client.school ?? '—'} />
              <Row label="Joined" value={formatDate(client.joinedAt)} />
              <Row label="Source" value={client.source} />
              <Row
                label="Custom rate"
                value={client.rateCents ? `${formatMoney(client.rateCents)} / hr` : 'Standard'}
              />
              <Row
                label="Shopify customer"
                value={client.shopifyCustomerId ?? 'Not synced'}
              />
            </dl>
            {client.tags.length ? (
              <p className="clients-sheet-tags">
                {client.tags.map((tag) => (
                  <span key={tag} className="clients-sheet-tag">
                    {tag}
                  </span>
                ))}
              </p>
            ) : null}
            {client.notes ? (
              <p className="clients-sheet-note">{client.notes}</p>
            ) : null}
          </Section>

          {/* ------------------------------------------------------ PACKAGE */}
          <Section title="Package">
            {pkg.name ? (
              <>
                <p className="display clients-sheet-package">{pkg.name}</p>
                <dl className="clients-sheet-list">
                  <Row
                    label="Price"
                    value={pkg.priceCents !== null ? formatMoney(pkg.priceCents) : '—'}
                  />
                  <Row label="Purchased" value={`${pkg.purchased ?? 0}`} />
                  <Row label="Used" value={`${pkg.used ?? 0}`} />
                  <Row label="Remaining" value={`${pkg.remaining ?? 0}`} />
                </dl>
              </>
            ) : (
              <p className="clients-sheet-empty">
                No package on file. Sessions are billed one at a time.
              </p>
            )}
          </Section>

          {/* --------------------------------------------------- COMPLIANCE */}
          <Section title="Compliance">
            <ul className="clients-check">
              {checklist.map((item) => (
                <li key={item.label} data-ok={item.ok ? 'true' : 'false'}>
                  <span className="clients-check-mark" aria-hidden="true">
                    {item.ok ? '✓' : '!'}
                  </span>
                  <span className="clients-check-text">
                    <span className="clients-check-label">{item.label}</span>
                    <span className="clients-check-detail">{item.detail}</span>
                  </span>
                  <span className="sr-only">
                    {item.ok ? 'On file' : 'Missing'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* ----------------------------------------------------- SESSIONS */}
          <Section
            title="Session history"
            meta={`${sessions.length} on the ledger · ${paidSessions} paid · ${unpaidSessions.length} unpaid`}
          >
            {sessions.length ? (
              <ul className="clients-ledger">
                {sessions.slice(0, 14).map((session) => (
                  <li key={session.id}>
                    <span className="tabular clients-ledger-date">
                      {formatDate(session.start.slice(0, 10))}
                    </span>
                    <span className="clients-ledger-main">
                      <span className="clients-ledger-title">{session.focus}</span>
                      <span className="clients-ledger-sub">
                        {formatClock(session.start)} · {session.minutes} min ·{' '}
                        {session.kind}
                        {session.status !== 'completed'
                          ? ` · ${session.status}`
                          : ''}
                      </span>
                    </span>
                    <span
                      className={`tabular clients-ledger-amount ${
                        !session.paid && session.amountCents > 0
                          ? 'clients-owing'
                          : ''
                      }`}
                    >
                      {session.amountCents > 0
                        ? formatMoney(session.amountCents)
                        : 'Included'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="clients-sheet-empty">No sessions on the ledger yet.</p>
            )}
          </Section>

          {/* ----------------------------------------------------- PAYMENTS */}
          <Section title="Payment history" meta={`${payments.length} recorded`}>
            {payments.length ? (
              <ul className="clients-ledger">
                {payments.slice(0, 14).map((payment) => (
                  <li key={payment.id}>
                    <span className="tabular clients-ledger-date">
                      {formatDate(payment.date)}
                    </span>
                    <span className="clients-ledger-main">
                      <span className="clients-ledger-title">
                        {payment.description}
                      </span>
                      <span className="clients-ledger-sub">
                        {payment.method} · {payment.status}
                        {payment.refundedCents > 0
                          ? ` · ${formatMoney(payment.refundedCents)} refunded`
                          : ''}
                      </span>
                    </span>
                    <span className="tabular clients-ledger-amount">
                      {formatMoney(payment.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="clients-sheet-empty">Nothing collected yet.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="clients-sheet-section">
      <div className="clients-sheet-section-head">
        <h3 className="tag text-gold-deep">{title}</h3>
        {meta ? <p className="clients-sheet-section-meta">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Figure({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: 'owing';
}) {
  return (
    <div className="clients-sheet-figure">
      <dt className="tag text-steel">{label}</dt>
      <dd
        className={`display tabular clients-sheet-figure-value ${
          accent ? 'text-gold' : tone === 'owing' ? 'clients-owing' : 'text-stone'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <div className="clients-sheet-row">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
