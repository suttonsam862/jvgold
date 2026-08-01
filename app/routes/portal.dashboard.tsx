import {Form, Link} from 'react-router';
import {
  ComplianceFlag,
  Figure,
  Meter,
  Panel,
  type ComplianceState,
} from '~/components/portal/PortalPrimitives';
import {PortalMark} from '~/components/portal/PortalMark';
import {requireDemoRole} from '~/lib/demoAuth';
import styles from '~/styles/portal.css?url';
import type {Route} from './+types/portal.dashboard';

export function links() {
  return [{rel: 'stylesheet', href: styles}];
}

export function meta() {
  return [
    {title: 'Family Portal — Preview — JV Gold'},
    {name: 'robots', content: 'noindex'},
  ];
}

export async function loader({context}: Route.LoaderArgs) {
  // Customer role only — a /private (coach) session does not open this door.
  requireDemoRole(context, 'customer');
  return null;
}

/**
 * SAMPLE DATA — a preview of the family portal. Every figure below is
 * illustrative. The shape mirrors the real Deep Waters model (packages drawn
 * down by session, camps with a deposit and a balance, per-athlete compliance
 * on USAW card / insurance / waiver) so the client can react to the real thing
 * rather than a lorem-ipsum stand-in. Live data arrives with the Shopify store
 * connection and the club's own records.
 */

const account = {
  parent: 'Maria Alvarez',
  household: 'Alvarez Family',
  memberSince: 'March 2024',
  email: 'parent@deepwaters.com',
  phone: '(951) 555-0148',
};

const upcomingSessions = [
  {
    date: 'Mon · Aug 3',
    time: '4:00 PM',
    type: 'Deep Waters — Youth',
    athlete: 'Mateo',
    coach: 'Jesse Vasquez',
    location: 'Riverside Mat Room',
  },
  {
    date: 'Tue · Aug 4',
    time: '6:30 PM',
    type: '1:1 Private — Bottom Half',
    athlete: 'Marisol',
    coach: 'Jesse Vasquez',
    location: 'Private Studio',
  },
  {
    date: 'Thu · Aug 6',
    time: '4:00 PM',
    type: 'Deep Waters — Youth',
    athlete: 'Mateo',
    coach: 'Andrea Ruiz',
    location: 'Riverside Mat Room',
  },
  {
    date: 'Sat · Aug 8',
    time: '9:00 AM',
    type: 'Open Mat — Varsity',
    athlete: 'Marisol',
    coach: 'Jesse Vasquez',
    location: 'Riverside Mat Room',
  },
];

const packages = [
  {
    name: '1:1 Private — 12 Pack',
    athlete: 'Marisol',
    purchased: 12,
    used: 7,
    expires: 'Expires Oct 31, 2026',
  },
  {
    name: 'Deep Waters — 20 Session Pack',
    athlete: 'Mateo',
    purchased: 20,
    used: 16,
    expires: 'Expires Sep 30, 2026',
  },
];

const campRegistrations = [
  {
    name: 'Summer Grind Camp',
    dates: 'Aug 10–14, 2026',
    location: 'Riverside, CA',
    athlete: 'Marisol',
    total: '$450.00',
    deposit: '$150.00',
    balance: '$300.00',
    balanceValue: 300,
    dueDate: 'Due Aug 3, 2026',
  },
  {
    name: 'Winter Intensive',
    dates: 'Dec 27–30, 2026',
    location: 'Riverside, CA',
    athlete: 'Mateo',
    total: '$375.00',
    deposit: '$375.00',
    balance: '$0.00',
    balanceValue: 0,
    dueDate: 'Paid in full',
  },
];

const billingHistory = [
  {
    date: 'Jul 12, 2026',
    item: '1:1 Private — 12 Pack',
    athlete: 'Marisol',
    amount: '$960.00',
    method: 'Visa •••• 4142',
  },
  {
    date: 'Jul 1, 2026',
    item: 'Deep Waters — 20 Session Pack',
    athlete: 'Mateo',
    amount: '$700.00',
    method: 'Visa •••• 4142',
  },
  {
    date: 'Jun 24, 2026',
    item: 'Summer Grind Camp — deposit',
    athlete: 'Marisol',
    amount: '$150.00',
    method: 'Apple Pay',
  },
  {
    date: 'Jun 2, 2026',
    item: 'Deep Waters — monthly',
    athlete: 'Mateo',
    amount: '$180.00',
    method: 'Visa •••• 4142',
  },
  {
    date: 'May 5, 2026',
    item: 'Winter Intensive — paid in full',
    athlete: 'Mateo',
    amount: '$375.00',
    method: 'Bank transfer',
  },
];

interface Athlete {
  name: string;
  age: number;
  grade: string;
  school: string;
  weight: string;
  focus: string;
  coach: string;
  joined: string;
  compliance: {label: string; detail: string; state: ComplianceState}[];
}

const athletes: Athlete[] = [
  {
    name: 'Marisol Alvarez',
    age: 16,
    grade: 'Sophomore',
    school: 'Riverside Poly HS',
    weight: '132 lbs',
    focus: 'Bottom half and scrambles',
    coach: 'Jesse Vasquez',
    joined: 'March 2024',
    compliance: [
      {
        label: 'USAW card',
        detail: 'Current through Aug 31, 2026',
        state: 'ok',
      },
      {
        label: 'Insurance on file',
        detail: 'Verified Jun 2, 2026',
        state: 'ok',
      },
      {
        label: 'Signed waiver',
        detail: 'Signed Mar 14, 2026',
        state: 'ok',
      },
    ],
  },
  {
    name: 'Mateo Alvarez',
    age: 13,
    grade: '8th grade',
    school: 'Central Middle School',
    weight: '106 lbs',
    focus: 'Stance, motion and first contact',
    coach: 'Andrea Ruiz',
    joined: 'September 2025',
    compliance: [
      {
        label: 'USAW card',
        detail: 'Expired Jul 1, 2026 — renew before Aug 10',
        state: 'attention',
      },
      {
        label: 'Insurance on file',
        detail: 'Not received',
        state: 'missing',
      },
      {
        label: 'Signed waiver',
        detail: 'Signed Sep 8, 2025',
        state: 'ok',
      },
    ],
  },
];

const sessionsRemaining = packages.reduce(
  (sum, pack) => sum + (pack.purchased - pack.used),
  0,
);

const balanceDueTotal = campRegistrations.reduce(
  (sum, camp) => sum + camp.balanceValue,
  0,
);

const outstandingItems = athletes.flatMap((athlete) =>
  athlete.compliance
    .filter((item) => item.state !== 'ok')
    .map((item) => `${athlete.name.split(' ')[0]} — ${item.label}`),
);

const nextSession = upcomingSessions[0];

export default function PortalDashboardPage() {
  return (
    <div className="min-h-[100svh] bg-onyx-deep text-stone">
      <header className="portal-sticky border-b rule-light">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-5">
          <div className="flex items-center gap-4 md:gap-5">
            <PortalMark className="hidden h-9 w-auto text-gold sm:block" />
            <div>
              <p className="tag text-gold-deep">Family Portal</p>
              <h1 className="display mt-1 text-xl leading-none md:text-2xl">
                Welcome back, {account.parent.split(' ')[0]}
              </h1>
            </div>
          </div>
          <Form method="post" action="/portal/logout">
            <button
              type="submit"
              className="tag border border-stone/25 px-4 py-2 text-steel transition-colors duration-500 hover:border-gold hover:text-gold focus-visible:border-gold focus-visible:text-gold"
            >
              Sign Out
            </button>
          </Form>
        </div>
      </header>

      <p
        role="status"
        className="border-b border-gold/25 bg-gold/[0.07] px-5 py-3 text-center text-[0.6875rem] uppercase leading-relaxed tracking-[0.18em] text-gold md:px-10"
      >
        Sample data — preview only. Live customer accounts arrive with the
        Shopify store connection.
      </p>

      <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-14 md:px-10 md:pb-32 md:pt-20">
        {/* ------------------------------------------------------ NEXT UP */}
        <div
          className="mb-16 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 border-b rule-light pb-10 md:mb-20"
          data-reveal
        >
          <div>
            <p className="tag text-gold">Next on the mat</p>
            <p className="display mt-4 text-[clamp(2rem,5.5vw,3.5rem)]">
              {nextSession.date}
              <span className="mx-4 text-steel/30">/</span>
              <span className="tabular">{nextSession.time}</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-steel">
              {nextSession.type}
              <span className="mx-2 text-steel/40">·</span>
              {nextSession.athlete}
              <span className="mx-2 text-steel/40">·</span>
              {nextSession.location}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/train"
              className="portal-submit display flex items-center justify-center border border-gold px-8 py-4 text-sm tracking-[0.18em] text-gold"
            >
              Book a Session
            </Link>
            <Link
              to="/train"
              className="portal-action tag border border-stone/25 px-6 py-4 text-steel transition-colors duration-500 hover:border-gold hover:text-gold"
            >
              Add Sessions
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-7 xl:col-span-8">
            {/* ------------------------------------------------- SESSIONS */}
            <Panel
              label="Upcoming Sessions"
              meta={`${upcomingSessions.length} booked`}
              delay="80ms"
            >
              <ul>
                {upcomingSessions.map((session, index) => (
                  <li
                    key={session.date + session.time}
                    className={`flex flex-wrap items-baseline gap-x-6 gap-y-2 py-6 ${
                      index === 0 ? '' : 'border-t rule-light'
                    }`}
                  >
                    <div className="w-28 shrink-0">
                      <p className="tabular text-sm tracking-[0.08em] text-gold">
                        {session.date}
                      </p>
                      <p className="tabular mt-1 text-xs text-steel">
                        {session.time}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="display text-lg md:text-xl">
                        {session.type}
                      </p>
                      <p className="mt-2 text-sm text-steel">
                        {session.athlete}
                        <span className="mx-2 text-steel/40">·</span>
                        Coach {session.coach}
                        <span className="mx-2 text-steel/40">·</span>
                        {session.location}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm leading-relaxed text-steel">
                Need to move one? Text the front desk at least 24 hours ahead
                and the session goes back on your package.
              </p>
            </Panel>

            {/* ---------------------------------------------------- CAMPS */}
            <Panel
              label="Camp Registrations"
              meta={`${campRegistrations.length} registered`}
              className="mt-20"
              delay="120ms"
            >
              <ul>
                {campRegistrations.map((camp, index) => (
                  <li
                    key={camp.name}
                    className={`py-7 ${index === 0 ? '' : 'border-t rule-light'}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                      <p className="display text-lg md:text-xl">{camp.name}</p>
                      <p className="tabular text-sm tracking-[0.08em] text-gold">
                        {camp.dates}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-steel">
                      {camp.athlete}
                      <span className="mx-2 text-steel/40">·</span>
                      {camp.location}
                    </p>
                    <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t rule-light pt-5 sm:grid-cols-4">
                      <div>
                        <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                          Total
                        </dt>
                        <dd className="tabular mt-2 text-base text-stone">
                          {camp.total}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                          Deposit paid
                        </dt>
                        <dd className="tabular mt-2 text-base text-stone">
                          {camp.deposit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                          Balance due
                        </dt>
                        <dd
                          className={`tabular mt-2 text-base ${
                            camp.balanceValue > 0 ? 'text-gold' : 'text-steel'
                          }`}
                        >
                          {camp.balance}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                          {camp.balanceValue > 0 ? 'Due date' : 'Status'}
                        </dt>
                        <dd className="tabular mt-2 text-base text-steel">
                          {camp.dueDate}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* ------------------------------------------------ PACKAGE RAIL */}
          <div className="lg:col-span-5 xl:col-span-4">
            <Panel label="Package Balance" meta="Across 2 athletes" delay="160ms">
              <Figure
                value={String(sessionsRemaining)}
                label="Sessions remaining"
                sub="Across all active packages"
                accent
              />

              <ul className="mt-10 border-t rule-light">
                {packages.map((pack) => {
                  const remaining = pack.purchased - pack.used;
                  return (
                    <li key={pack.name} className="border-b rule-light py-7">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-sm text-stone">{pack.name}</p>
                        <p className="tabular shrink-0 text-sm text-gold">
                          {remaining} left
                        </p>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-steel">
                        {pack.athlete}
                      </p>
                      <div className="mt-5">
                        <Meter
                          used={pack.used}
                          total={pack.purchased}
                          label={`${pack.name} for ${pack.athlete}`}
                        />
                      </div>
                      <p className="tabular mt-3 flex items-baseline justify-between gap-4 text-xs uppercase tracking-[0.16em] text-steel">
                        <span>
                          {pack.used} used / {pack.purchased} purchased
                        </span>
                        <span>{pack.expires}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>

              <Link
                to="/train"
                className="portal-action tag mt-8 inline-block border-b border-gold/60 pb-1 text-gold transition-colors duration-500 hover:border-gold hover:text-stone"
              >
                Buy More Sessions
              </Link>
            </Panel>

            <Panel label="Balance Due" meta="Camps" className="mt-20" delay="200ms">
              <Figure
                value={`$${balanceDueTotal.toFixed(2)}`}
                label="Outstanding across camp registrations"
                sub={balanceDueTotal > 0 ? 'Next due Aug 3, 2026' : 'Nothing due'}
              />
              <p className="mt-8 text-sm leading-relaxed text-steel">
                Camp balances are collected at checkout once the store is
                connected. Until then the front desk takes payment in person.
              </p>
            </Panel>
          </div>
        </div>

        {/* --------------------------------------------------- ATHLETES */}
        <Panel
          label="Your Athletes"
          meta={`${athletes.length} on the roster`}
          className="mt-20 md:mt-28"
          delay="80ms"
        >
          {outstandingItems.length > 0 ? (
            <div
              role="status"
              className="mb-10 border-l border-gold pl-5 text-sm leading-relaxed"
            >
              <p className="tag text-gold">Needs your attention</p>
              <p className="mt-3 text-stone">
                <span className="tabular">{outstandingItems.length}</span> item
                {outstandingItems.length === 1 ? '' : 's'} outstanding —{' '}
                {outstandingItems.join(', ')}. Bring these to the front desk
                before the next camp check-in.
              </p>
            </div>
          ) : null}

          <ul className="portal-grid grid-cols-1 md:grid-cols-2">
            {athletes.map((athlete) => (
              <li key={athlete.name} className="p-6 md:p-8">
                <p className="display text-xl leading-tight">{athlete.name}</p>
                <p className="tabular mt-3 text-sm text-steel">
                  {athlete.age} · {athlete.grade}
                  <span className="mx-2 text-steel/40">·</span>
                  {athlete.weight}
                </p>

                <dl className="mt-7 space-y-4 border-t rule-light pt-6 text-sm">
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                      School
                    </dt>
                    <dd className="text-right text-stone">{athlete.school}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                      Working on
                    </dt>
                    <dd className="text-right text-stone">{athlete.focus}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                      Primary coach
                    </dt>
                    <dd className="text-right text-stone">{athlete.coach}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                      With the club since
                    </dt>
                    <dd className="tabular text-right text-stone">
                      {athlete.joined}
                    </dd>
                  </div>
                </dl>

                <div className="mt-8 border-t rule-light pt-5">
                  <p className="tag text-gold-deep">Compliance</p>
                  <ul className="mt-3">
                    {athlete.compliance.map((item) => (
                      <ComplianceFlag
                        key={item.label}
                        label={item.label}
                        detail={item.detail}
                        state={item.state}
                      />
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* ---------------------------------------------------- BILLING */}
        <Panel
          label="Billing History"
          meta={`${billingHistory.length} payments`}
          className="mt-20 md:mt-28"
          delay="120ms"
        >
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="portal-table w-full min-w-[40rem] text-sm">
              <caption className="sr-only">
                Past payments on the Alvarez family account — sample data.
              </caption>
              <thead>
                <tr className="border-b rule-light">
                  <th
                    scope="col"
                    className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel"
                  >
                    Item
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel"
                  >
                    Athlete
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-6 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel"
                  >
                    Method
                  </th>
                  <th
                    scope="col"
                    className="py-3 text-[0.6875rem] font-normal uppercase tracking-[0.18em] text-steel"
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((row, index) => (
                  <tr
                    key={row.date + row.item}
                    className={index === 0 ? '' : 'border-t rule-light'}
                  >
                    <td className="tabular py-4 pr-6 text-steel">{row.date}</td>
                    <td className="py-4 pr-6 text-stone">{row.item}</td>
                    <td className="py-4 pr-6 text-steel">{row.athlete}</td>
                    <td className="tabular py-4 pr-6 text-steel">
                      {row.method}
                    </td>
                    <td className="tabular py-4 text-stone">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ------------------------------------------------------ ACCOUNT */}
        <Panel
          label="Account"
          meta={`Member since ${account.memberSince}`}
          className="mt-20 md:mt-28"
          delay="160ms"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-10">
            <dl className="grid grid-cols-1 gap-x-16 gap-y-6 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                  Household
                </dt>
                <dd className="mt-2 text-stone">{account.household}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                  Email
                </dt>
                <dd className="mt-2 text-stone">{account.email}</dd>
              </div>
              <div>
                <dt className="text-[0.6875rem] uppercase tracking-[0.18em] text-steel">
                  Phone
                </dt>
                <dd className="tabular mt-2 text-stone">{account.phone}</dd>
              </div>
            </dl>

            <Link
              to="/train"
              className="portal-submit display flex items-center justify-center border border-gold px-8 py-4 text-sm tracking-[0.18em] text-gold"
            >
              Book More Time
            </Link>
          </div>
        </Panel>
      </main>
    </div>
  );
}
