/**
 * GOOGLE CALENDAR CONNECTION — an honest connect surface.
 *
 * This panel must never imply a connection exists. It states the real state
 * (disconnected), lists the exact OAuth scopes that WOULD be requested, spells
 * out what a sync would and would not do, and posts to the route's own action,
 * which replies that OAuth is not configured. No spinner theatre, no fake
 * "Connected ✓".
 */

import {Form, useNavigation} from 'react-router';
import type {IntegrationStatus} from '~/lib/ops/types';

/** The two scopes a read/write calendar sync actually needs. */
const SCOPES = [
  {
    code: 'calendar.readonly',
    detail:
      'Read events from every calendar on the account, so school duals, travel and family blocks appear beside JV Gold sessions.',
  },
  {
    code: 'calendar.events',
    detail:
      'Create and update events on the primary calendar, so a session booked here also lands on the phone.',
  },
];

const WOULD = [
  'Pull events from the linked Google account into this view on a schedule.',
  'Push sessions created here back to the primary Google calendar.',
  'Keep imported events read-only until each one is claimed as a JV Gold session.',
];

const WOULD_NOT = [
  'Delete anything on the Google side.',
  'Touch calendars that are not explicitly selected.',
  'Move athlete or payment records anywhere outside this hub.',
];

interface ConnectPanelProps {
  status: IntegrationStatus | null;
  /** The seeded Google calendar id, shown so the target is unambiguous. */
  calendarId: string | null;
  importedCount: number;
  /** Reply from the route action after the connect attempt. */
  message: string | null;
}

export function ConnectPanel({
  status,
  calendarId,
  importedCount,
  message,
}: ConnectPanelProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  const state = status?.state ?? 'disconnected';

  return (
    <section
      className="border-t border-[color:var(--cal-line-strong)] pt-8"
      data-reveal
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--cal-line)] pb-3">
        <h2 className="tag text-gold-deep">Google Calendar</h2>
        <span className="cal-state" data-state={state}>
          {state}
        </span>
      </div>

      <div className="grid gap-8 pt-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm leading-relaxed text-[color:var(--cal-dim)]">
            {status?.detail ??
              'No Google account is linked. Imported events shown here are seed data.'}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
                Target calendar
              </dt>
              <dd className="cal-tabular mt-1 break-all text-xs">
                {calendarId ?? 'Not selected'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
                Imported events
              </dt>
              <dd className="cal-tabular mt-1 text-2xl text-gold">
                {importedCount}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
                Last sync
              </dt>
              <dd className="cal-tabular mt-1 text-xs">
                {status?.lastSyncedAt
                  ? `${status.lastSyncedAt.slice(0, 10)} · ${status.lastSyncedAt.slice(11, 16)}`
                  : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
                Direction
              </dt>
              <dd className="mt-1 text-xs">Read only until connected</dd>
            </div>
          </dl>

          <Form method="post" className="mt-7">
            <input type="hidden" name="intent" value="connect-google" />
            <button type="submit" className="cal-primary w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Connect Google Calendar'}
            </button>
          </Form>

          <p
            className="mt-3 text-xs leading-relaxed text-[color:var(--cal-dim)]"
            role="status"
          >
            {message ??
              'The button runs the real handshake check. OAuth credentials are not configured on this environment yet, so it will tell you exactly what is missing rather than pretending to connect.'}
          </p>
        </div>

        <div>
          <h3 className="text-[0.5625rem] uppercase tracking-[0.22em] text-steel">
            Scopes requested
          </h3>
          <div className="mt-3">
            {SCOPES.map((scope) => (
              <div key={scope.code} className="cal-scope">
                <span className="cal-scope-code">{scope.code}</span>
                <span className="text-xs leading-relaxed text-[color:var(--cal-dim)]">
                  {scope.detail}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-[0.5625rem] uppercase tracking-[0.22em] text-steel">
                Sync would
              </h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[color:var(--cal-dim)]">
                {WOULD.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[0.5625rem] uppercase tracking-[0.22em] text-steel">
                Sync would not
              </h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[color:var(--cal-dim)]">
                {WOULD_NOT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
