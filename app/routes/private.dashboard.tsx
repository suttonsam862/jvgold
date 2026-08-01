import {Form, Link} from 'react-router';
import {requireDemoRole} from '~/lib/demoAuth';
import {Figure, Panel} from '~/components/private/DashboardPrimitives';
import {PrivateMark} from '~/components/private/PrivateMark';
import styles from '~/styles/private.css?url';
import type {Route} from './+types/private.dashboard';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Management View — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  // Coach role only — a /portal (customer) session does not open this door.
  requireDemoRole(context, 'coach');
  return null;
}

/**
 * MOCK DATA — this is a preview of the real management portal, which will
 * eventually read live from Supabase. Everything below is illustrative,
 * not production data.
 */

/** Sample "today" — held as a constant so server and client render alike. */
const TODAY_LABEL = 'Thursday · August 7';

const todaySessions = [
  {
    time: '6:00 AM',
    name: 'Open Mat — Varsity',
    athletes: 14,
    location: 'Riverside Mat Room',
    note: 'Live goes 90 min',
  },
  {
    time: '4:00 PM',
    name: 'Deep Waters — Youth',
    athletes: 22,
    location: 'Riverside Mat Room',
    note: 'Two new intros',
  },
  {
    time: '6:30 PM',
    name: '1:1 — M. Alvarez',
    athletes: 1,
    location: 'Private Studio',
    note: 'Bottom-half film',
  },
];

const weekSchedule = [
  {day: 'Mon', focus: 'Live wrestling + conditioning', sessions: 3},
  {day: 'Tue', focus: 'Technique — bottom half', sessions: 2},
  {day: 'Wed', focus: 'Open mat + film review', sessions: 3},
  {day: 'Thu', focus: 'Technique — top half', sessions: 3, today: true},
  {day: 'Fri', focus: 'Live wrestling', sessions: 2},
  {day: 'Sat', focus: 'Youth clinic (Deep Waters)', sessions: 4},
  {day: 'Sun', focus: 'Rest / recovery', sessions: 0},
];

/*
 * Placeholder records are deliberately DE-IDENTIFIED.
 *
 * Earlier drafts invented named minors with ages, weight classes and injury
 * status, and named families carrying overdue balances. Rendered at a glance
 * that is indistinguishable from real athlete data about real children, and a
 * screenshot would carry it out of context. Never reintroduce names here — the
 * production portal reads real records from Supabase behind the login.
 */
const roster = [
  {name: 'Athlete 01', age: 16, weight: '132', status: 'Active', attendance: '96%'},
  {name: 'Athlete 02', age: 14, weight: '106', status: 'Active', attendance: '88%'},
  {name: 'Athlete 03', age: 17, weight: '145', status: 'Active', attendance: '92%'},
  {name: 'Athlete 04', age: 15, weight: '120', status: 'Out — cleared to return', attendance: '41%'},
  {name: 'Athlete 05', age: 13, weight: '95', status: 'Active', attendance: '79%'},
];

/*
 * No revenue figures. A screenshot of this screen must never show what Jesse's
 * business grosses. Operational counts only — these are the numbers he actually
 * opens the portal to check.
 */
const roomStatus = {
  sessionsThisWeek: '18',
  athletesOnMat: '29',
  familiesEnrolled: '3',
  outstandingAccounts: 4,
};

const outstandingAccounts = [
  {name: 'Account 01', amount: '—', overdue: '18 days'},
  {name: 'Account 02', amount: '—', overdue: '11 days'},
  {name: 'Account 03', amount: '—', overdue: '6 days'},
  {name: 'Account 04', amount: '—', overdue: '3 days'},
];

const upcomingCamps = [
  {
    name: 'Summer Grind Camp',
    dates: 'Aug 10–14',
    location: 'Riverside, CA',
    spots: '6 spots left',
    filled: '18 / 24 filled',
  },
  {
    name: 'Mexico National Team Exchange',
    dates: 'Sep 4–7',
    location: 'Mexico City, MX',
    spots: 'Waitlist',
    filled: '16 / 16 filled',
  },
  {
    name: 'Winter Intensive',
    dates: 'Dec 27–30',
    location: 'Riverside, CA',
    spots: 'Open',
    filled: '4 / 30 filled',
  },
];

const totalAthletesToday = todaySessions.reduce(
  (sum, session) => sum + session.athletes,
  0,
);

const HUB_SECTIONS = [
  {to: '/private/calendar', label: 'Calendar'},
  {to: '/private/clients', label: 'Clients'},
  {to: '/private/finance', label: 'Finance'},
  {to: '/private/products', label: 'Products'},
];

export default function PrivateDashboardPage() {
  return (
    <div className="min-h-[100svh] bg-onyx-deep text-stone">
      <header className="private-sticky border-b rule-light">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-5">
          <div className="flex items-center gap-4 md:gap-5">
            <PrivateMark className="hidden h-9 w-auto text-gold sm:block" />
            <div>
              <p className="tag text-gold-deep">Management View</p>
              <h1 className="display mt-1 text-xl leading-none md:text-2xl">
                Welcome back, Jesse
              </h1>
            </div>
          </div>
          <Form method="post" action="/private/logout">
            <button
              type="submit"
              className="tag border border-stone/25 px-4 py-2 text-steel transition-colors duration-500 hover:border-gold hover:text-gold focus-visible:border-gold focus-visible:text-gold"
            >
              Log Out
            </button>
          </Form>
        </div>

        {/* Hub nav. The subpages all link back here, so without this the
            dashboard is a dead end and they are URL-only. */}
        <nav
          aria-label="Management sections"
          className="mx-auto flex max-w-[1440px] gap-6 overflow-x-auto border-t rule-light px-5 py-3 md:gap-8 md:px-10"
        >
          {HUB_SECTIONS.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="tag whitespace-nowrap text-steel transition-colors duration-500 hover:text-gold focus-visible:text-gold"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>

      <p
        role="status"
        className="border-b border-gold/25 bg-gold/[0.07] px-5 py-3 text-center text-[0.6875rem] uppercase leading-relaxed tracking-[0.18em] text-gold md:px-10"
      >
        Sample data — illustrative preview only. The production portal will
        read live from Supabase.
      </p>

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-14 md:px-10 md:pb-32 md:pt-20">
        {/* ---------------------------------------------------------- TODAY */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-7 xl:col-span-8">
            <div
              className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b rule-light pb-8"
              data-reveal
            >
              <div>
                <p className="tag text-gold">Today</p>
                <p className="display mt-4 text-[clamp(2rem,5.5vw,3.5rem)]">
                  {TODAY_LABEL}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-steel">
                <span className="display private-figure mr-2 text-2xl text-gold">
                  {todaySessions.length}
                </span>
                sessions
                <span className="mx-3 text-steel/40">/</span>
                <span className="tabular">{totalAthletesToday}</span> athletes
                on the mat
              </p>
            </div>

            <Panel
              label="Today’s Sessions"
              meta={`${todaySessions.length} scheduled`}
              delay="80ms"
            >
              <ul>
                {todaySessions.map((session, index) => (
                  <li
                    key={session.time + session.name}
                    className={`flex flex-wrap items-baseline gap-x-6 gap-y-2 py-6 ${
                      index === 0 ? '' : 'border-t rule-light'
                    }`}
                  >
                    <p className="tabular w-24 shrink-0 text-sm tracking-[0.08em] text-gold">
                      {session.time}
                    </p>
                    <div className="min-w-0 flex-1">
                      <p className="display text-lg md:text-xl">
                        {session.name}
                      </p>
                      <p className="mt-2 text-sm text-steel">
                        {session.location}
                        <span className="mx-2 text-steel/40">·</span>
                        {session.note}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-sm text-steel">
                      {session.athletes} athlete
                      {session.athletes === 1 ? '' : 's'}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* ------------------------------------------------- THIS WEEK */}
            <Panel
              label="This Week"
              meta="17 sessions"
              className="mt-16"
              delay="120ms"
            >
              <ol className="private-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {weekSchedule.map((day) => (
                  <li
                    key={day.day}
                    className="flex items-baseline gap-4 p-5 sm:block"
                    aria-current={day.today ? 'date' : undefined}
                  >
                    <p
                      className={`display w-12 shrink-0 text-sm sm:w-auto ${
                        day.today ? 'text-gold' : 'text-steel'
                      }`}
                    >
                      {day.day}
                    </p>
                    <p className="mt-0 text-sm leading-relaxed text-stone/85 sm:mt-3">
                      {day.focus}
                    </p>
                    <p className="tabular mt-0 shrink-0 text-xs uppercase tracking-[0.18em] text-steel sm:mt-3">
                      {day.sessions === 0 ? '—' : `${day.sessions} sessions`}
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          {/* -------------------------------------------------- MONEY RAIL */}
          <div className="lg:col-span-5 xl:col-span-4">
            <Panel label="Room Snapshot" meta="This week" delay="160ms">
              <div className="space-y-10">
                <Figure
                  value={roomStatus.sessionsThisWeek}
                  label="Sessions this week"
                  sub="Across private, youth and open mat"
                  accent
                />
                <div className="grid grid-cols-2 gap-8 border-t rule-light pt-8">
                  <div>
                    <p className="display private-figure text-3xl">
                      {roomStatus.athletesOnMat}
                    </p>
                    <p className="mt-2 text-sm text-steel">
                      Athletes on the mat
                    </p>
                  </div>
                  <div>
                    <p className="display private-figure text-3xl">
                      {roomStatus.familiesEnrolled}
                    </p>
                    <p className="mt-2 text-sm text-steel">
                      Families training together
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              label="Outstanding"
              meta={`${roomStatus.outstandingAccounts} accounts`}
              className="mt-16"
              delay="200ms"
            >
              <ul>
                {outstandingAccounts.map((account, index) => (
                  <li
                    key={account.name}
                    className={`flex items-baseline justify-between gap-4 py-4 ${
                      index === 0 ? '' : 'border-t rule-light'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-stone">
                        {account.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-steel">
                        {account.overdue} overdue
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-base text-stone">
                      {account.amount}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        {/* ---------------------------------------------------------- ROSTER */}
        <Panel
          label="Roster Snapshot — Placeholder Records"
          meta={`${roster.length} shown / ${roomStatus.athletesOnMat} enrolled`}
          className="mt-20 md:mt-28"
          delay="80ms"
        >
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="private-table w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b rule-light">
                  <th className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel">
                    Name
                  </th>
                  <th className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel">
                    Age
                  </th>
                  <th className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel">
                    Weight
                  </th>
                  <th className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel">
                    Attendance
                  </th>
                  <th className="py-3 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.map((athlete, index) => (
                  <tr
                    key={athlete.name}
                    className={index === 0 ? '' : 'border-t rule-light'}
                  >
                    <td className="display py-4 pr-6 text-base">
                      {athlete.name}
                    </td>
                    <td className="tabular py-4 pr-6 text-steel">
                      {athlete.age}
                    </td>
                    <td className="tabular py-4 pr-6 text-steel">
                      {athlete.weight} lbs
                    </td>
                    <td
                      className={`tabular py-4 pr-6 ${
                        athlete.status === 'Active' ? 'text-gold' : 'text-steel'
                      }`}
                    >
                      {athlete.attendance}
                    </td>
                    <td className="py-4 text-steel">
                      <span
                        className={`private-dot mr-3 ${
                          athlete.status === 'Active'
                            ? 'text-gold'
                            : 'text-steel/60'
                        }`}
                        aria-hidden="true"
                      />
                      {athlete.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ----------------------------------------------------------- CAMPS */}
        <Panel
          label="Upcoming Camps"
          meta={`${upcomingCamps.length} on the calendar`}
          className="mt-20 md:mt-28"
          delay="120ms"
        >
          <ul className="private-grid grid-cols-1 md:grid-cols-3">
            {upcomingCamps.map((camp) => (
              <li key={camp.name} className="flex flex-col gap-6 p-6 md:p-8">
                <p className="tabular text-sm tracking-[0.08em] text-gold">
                  {camp.dates}
                </p>
                <div className="flex-1">
                  <p className="display text-xl leading-tight">{camp.name}</p>
                  <p className="mt-3 text-sm text-steel">{camp.location}</p>
                </div>
                <p className="flex items-baseline justify-between gap-4 border-t rule-light pt-4 text-xs uppercase tracking-[0.16em] text-steel">
                  <span className="tabular">{camp.filled}</span>
                  <span className="text-gold">{camp.spots}</span>
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  );
}
