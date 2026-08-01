/**
 * ============================================================================
 * /private/calendar — the coach calendar
 * ============================================================================
 *
 * Month / Week / Day over the shared ops dataset, in the hub's dark register.
 * The loader hands the seed straight through; when Google and Supabase are
 * live the same shapes arrive from the real sources and nothing below changes.
 *
 * There is no calendar backend yet, and this page never pretends otherwise:
 * edits are held in client state behind a visible "local preview" marker, and
 * the Google panel posts to the action below, which reports the real, honest
 * connection state instead of faking a handshake.
 */

import {useMemo} from 'react';
import {Link, useActionData, useLoaderData} from 'react-router';
import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';
import type {DemoAuthContext} from '~/lib/demoAuth';
import {requireDemoRole} from '~/lib/demoAuth';
import {OPS_DATASET} from '~/lib/ops/seed';
import {addDays, daysBetween} from '~/lib/ops/types';
import {CalendarShell} from '~/components/calendar/CalendarShell';
import {startOfWeek} from '~/components/calendar/layout';
import styles from '~/styles/calendar.css?url';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Calendar — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: LoaderFunctionArgs) {
  // Coach role only. Throws a redirect to /private when signed out.
  requireDemoRole(context as unknown as DemoAuthContext, 'coach');

  const {calendar, clients, integrations, anchorDate} = OPS_DATASET;

  const google =
    integrations.find((entry) => entry.id === 'google-calendar') ?? null;
  const googleCalendarId =
    calendar.find((event) => event.calendarId)?.calendarId ?? null;

  // De-identified roster labels only — the edit form attaches athletes by id.
  const roster = clients.map((client) => ({id: client.id, name: client.name}));

  // Week summary, computed once on the server against the anchor so the figure
  // is identical in both renders.
  const weekStart = startOfWeek(anchorDate);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = calendar.filter((event) => {
    const day = event.start.slice(0, 10);
    return day >= weekStart && day <= weekEnd;
  });
  const matMinutes = inWeek.reduce((total, event) => {
    if (event.allDay || event.source !== 'jvgold') return total;
    const start = Number(event.start.slice(11, 13)) * 60 + Number(event.start.slice(14, 16));
    const end = Number(event.end.slice(11, 13)) * 60 + Number(event.end.slice(14, 16));
    const span = daysBetween(event.start.slice(0, 10), event.end.slice(0, 10)) * 1440;
    return total + Math.max(0, span + end - start);
  }, 0);

  return {
    events: calendar,
    roster,
    anchorDate,
    google,
    googleCalendarId,
    summary: {
      sessions: inWeek.filter((event) => event.source === 'jvgold').length,
      imported: inWeek.filter((event) => event.source === 'google').length,
      matHours: Math.round(matMinutes / 6) / 10,
      weekStart,
      weekEnd,
    },
  };
}

/**
 * The connect handshake. This is the stub the "Connect Google Calendar" button
 * posts to: it reports what is actually missing rather than starting a fake
 * OAuth flow. When credentials exist, this is the place that redirects to
 * Google's consent screen.
 */
export async function action({request, context}: ActionFunctionArgs) {
  requireDemoRole(context as unknown as DemoAuthContext, 'coach');

  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent !== 'connect-google') {
    return {message: 'Unknown request. Nothing was changed.'};
  }

  return {
    message:
      'OAuth is not configured on this environment. Connecting needs a Google Cloud project with the Calendar API enabled, a client id and secret in the environment, and this site’s callback URL on the authorised redirect list. Until those exist there is nothing to hand off to, so nothing was connected and no data left this page.',
  };
}

export default function PrivateCalendarRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const summaryFigures = useMemo(
    () => [
      {label: 'Sessions', value: String(data.summary.sessions), gold: true},
      {label: 'Mat hours', value: data.summary.matHours.toFixed(1), gold: false},
      {label: 'Imported', value: String(data.summary.imported), gold: false},
    ],
    [data.summary],
  );

  return (
    <div className="min-h-screen bg-onyx-deep text-stone">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b rule-light pb-6">
          <div>
            <p className="tag text-gold-deep">Calendar</p>
            <h1 className="display mt-2 text-2xl leading-none sm:text-3xl">
              The week ahead
            </h1>
            <Link
              to="/private/dashboard"
              className="mt-3 inline-block text-[0.625rem] uppercase tracking-[0.2em] text-steel underline-offset-4 hover:text-gold"
            >
              ← Management view
            </Link>
          </div>

          <dl className="flex gap-7">
            {summaryFigures.map((figure) => (
              <div key={figure.label}>
                <dt className="text-[0.5625rem] uppercase tracking-[0.2em] text-steel">
                  {figure.label}
                </dt>
                <dd
                  className={`tabular mt-1 text-2xl leading-none sm:text-3xl ${
                    figure.gold ? 'text-gold' : 'text-stone'
                  }`}
                >
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <CalendarShell
          events={data.events}
          roster={data.roster}
          anchorDate={data.anchorDate}
          google={data.google}
          googleCalendarId={data.googleCalendarId}
          connectMessage={actionData?.message ?? null}
        />
      </div>
    </div>
  );
}
