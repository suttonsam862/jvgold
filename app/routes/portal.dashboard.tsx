/**
 * ============================================================================
 * PORTAL — DASHBOARD  (the family view)
 * ============================================================================
 *
 * REBUILT, not restyled.
 *
 *   1. REGISTER. The page no longer declares `bg-onyx-deep text-stone` and then
 *      fights to keep type legible on it — it renders through <Screen> in the
 *      light `.ops` register and names no colour of its own. On the stone
 *      ground gold is 1.87:1 and steel is 4.16:1, so neither is ever type here:
 *      gold survives as a FILL (the package meter) and as bronze
 *      `--ink-accent` when it must be text.
 *
 *   2. DENSITY. It was laid out like a blog article: a `clamp(2rem,5.5vw,3.5rem)`
 *      hero date, `py-6`/`py-7` rows, and a camp registration that consumed
 *      ~250px to say four numbers. A session is now one row of a grid and a
 *      camp is one row of a ledger; the `<dl>` blocks with `gap-y-5` are
 *      compact inline key/value pairs.
 *
 * DATA: still module-scope consts — Supabase is being wired in a parallel wave.
 * Every const is typed against `~/lib/ops/types`, mostly as a `Pick` of the real
 * domain interface, so the loader swap is mechanical. Money is integer CENTS
 * and reaches the DOM only through `formatMoney`.
 *
 * DE-IDENTIFICATION IS LOAD-BEARING. This screen previously carried invented
 * family names, a named guardian, named minors with ages, weight classes and
 * schools, and an invented staff coach. All of it is gone: "Family 03",
 * "Guardian 07", "Athlete 01". An earlier draft of this project shipped
 * fabricated named minors with weights and injury status and it had to be torn
 * out. Never reintroduce a human name, never attach medical or injury status to
 * one, and leave the sample-data banner in place. Compliance flags (USAW card,
 * insurance on file, signed waiver) are administrative, not medical, and are
 * part of the domain model.
 *
 * React 18: no `use()`, no async component, no browser API outside an effect.
 */

import {Form, Link} from 'react-router';
import {Dot, Figure, Meter, Panel, Row} from '~/components/ops/Primitives';
import {Screen} from '~/components/ops/Screen';
import {PortalMark} from '~/components/portal/PortalMark';
import {requireDemoRole} from '~/lib/demoAuth';
import {
  daysFromIso,
  formatClock,
  formatMoney,
  sumCents,
  weekdayOfIso,
  type Client,
  type ClientId,
  type Compliance,
  type IsoDate,
  type PackageState,
  type Payment,
  type PaymentMethod,
  type SessionKind,
  type TrainingSession,
} from '~/lib/ops/types';
import type {Route} from './+types/portal.dashboard';

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

/* ==========================================================================
 * PURE DATE HELPERS — civil strings only, no `Date`, no `Intl`.
 * A `Date`-derived label renders one way on a UTC server and another in a
 * Pacific browser, which is a hydration mismatch waiting to happen.
 * ======================================================================== */

const WEEKDAYS =
  'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' ');

const MONTHS =
  'January February March April May June July August September October November December'.split(
    ' ',
  );

/** `'2026-08-06T16:00:00'` → `'Thu'`. */
function dayAbbr(iso: string): string {
  return WEEKDAYS[weekdayOfIso(iso)].slice(0, 3);
}

/** `'2026-08-06'` → `'Aug 6'`. Safe on a datetime too — it slices by index. */
function shortDate(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(
    iso.slice(8, 10),
  )}`;
}

/** `'2026-03-14'` → `'March 2024'`-style label for a join date. */
function monthYear(iso: IsoDate): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/* ==========================================================================
 * SAMPLE DATA — de-identified, cents-based, shaped like the domain model
 * ======================================================================== */

/** Fixed anchor so server and first client paint agree. Never `Date.now()`. */
const ANCHOR_DATE: IsoDate = '2026-08-03';

/** The billing household. `Client.familyGroup` + the guardian contact block. */
const account = {
  familyGroup: 'Family 03',
  guardian: 'Guardian 07',
  email: 'guardian07@example.com',
  phone: '(555) 555-0148',
  memberSince: '2024-03-14' as IsoDate,
};

/**
 * A booked session. `Pick` of the real `TrainingSession` plus the coach label,
 * which the ledger does not model yet (sessions are Jesse's by default).
 */
type PortalSession = Pick<
  TrainingSession,
  'id' | 'start' | 'end' | 'kind' | 'athleteIds' | 'location' | 'focus'
> & {coach: string};

const upcomingSessions: PortalSession[] = [
  {
    id: 'ses-2026-08-03-01',
    start: '2026-08-03T16:00:00',
    end: '2026-08-03T17:30:00',
    kind: 'clinic',
    athleteIds: ['ath-02'],
    location: 'Riverside Mat Room',
    focus: 'Deep Waters — youth technique',
    coach: 'Jesse Vasquez',
  },
  {
    id: 'ses-2026-08-04-01',
    start: '2026-08-04T18:30:00',
    end: '2026-08-04T19:30:00',
    kind: 'private',
    athleteIds: ['ath-01'],
    location: 'Private Studio',
    focus: 'Bottom half and scrambles',
    coach: 'Jesse Vasquez',
  },
  {
    id: 'ses-2026-08-06-01',
    start: '2026-08-06T16:00:00',
    end: '2026-08-06T17:30:00',
    kind: 'clinic',
    athleteIds: ['ath-02'],
    location: 'Riverside Mat Room',
    focus: 'Deep Waters — stance and motion',
    coach: 'Assistant Coach',
  },
  {
    id: 'ses-2026-08-08-01',
    start: '2026-08-08T09:00:00',
    end: '2026-08-08T11:00:00',
    kind: 'group',
    athleteIds: ['ath-01'],
    location: 'Riverside Mat Room',
    focus: 'Open mat — live',
    coach: 'Jesse Vasquez',
  },
];

/** A package the family has bought. `PackageState` + who it belongs to. */
type PortalPackage = Pick<
  PackageState,
  'name' | 'priceCents' | 'purchased' | 'used' | 'remaining' | 'offeringId'
> & {clientId: ClientId; expiresOn: IsoDate};

const packages: PortalPackage[] = [
  {
    clientId: 'ath-01',
    name: '1:1 Private — 12 Pack',
    priceCents: 96000,
    purchased: 12,
    used: 7,
    remaining: 5,
    offeringId: 'private',
    expiresOn: '2026-10-31',
  },
  {
    clientId: 'ath-02',
    name: 'Deep Waters — 20 Session Pack',
    priceCents: 70000,
    purchased: 20,
    used: 16,
    remaining: 4,
    offeringId: 'clinic',
    expiresOn: '2026-09-30',
  },
];

/**
 * A camp booking. The Supabase `registrations` row for a camp product, with
 * the deposit split out. Every figure is integer cents.
 */
interface CampRegistration {
  id: string;
  clientId: ClientId;
  campTitle: string;
  startDate: IsoDate;
  endDate: IsoDate;
  location: string;
  totalCents: number;
  depositPaidCents: number;
  balanceCents: number;
  /** Null once the balance is settled. */
  dueDate: IsoDate | null;
}

const campRegistrations: CampRegistration[] = [
  {
    id: 'reg-camp-summer-grind-01',
    clientId: 'ath-01',
    campTitle: 'Summer Grind Camp',
    startDate: '2026-08-10',
    endDate: '2026-08-14',
    location: 'Riverside, CA',
    totalCents: 45000,
    depositPaidCents: 15000,
    balanceCents: 30000,
    dueDate: '2026-08-03',
  },
  {
    id: 'reg-camp-winter-intensive-01',
    clientId: 'ath-02',
    campTitle: 'Winter Intensive',
    startDate: '2026-12-27',
    endDate: '2026-12-30',
    location: 'Riverside, CA',
    totalCents: 37500,
    depositPaidCents: 37500,
    balanceCents: 0,
    dueDate: null,
  },
];

/** A billing line. `Pick` of the real `Payment` — a live row satisfies it. */
type BillingRow = Pick<
  Payment,
  | 'id'
  | 'date'
  | 'clientId'
  | 'category'
  | 'amountCents'
  | 'method'
  | 'status'
  | 'description'
>;

const billingHistory: BillingRow[] = [
  {
    id: 'pay-2026-07-12-01',
    date: '2026-07-12',
    clientId: 'ath-01',
    category: 'package',
    amountCents: 96000,
    method: 'Card',
    status: 'paid',
    description: '1:1 Private — 12 Pack',
  },
  {
    id: 'pay-2026-07-01-01',
    date: '2026-07-01',
    clientId: 'ath-02',
    category: 'package',
    amountCents: 70000,
    method: 'Card',
    status: 'paid',
    description: 'Deep Waters — 20 Session Pack',
  },
  {
    id: 'pay-2026-06-24-01',
    date: '2026-06-24',
    clientId: 'ath-01',
    category: 'camp',
    amountCents: 15000,
    method: 'Card',
    status: 'paid',
    description: 'Summer Grind Camp — deposit',
  },
  {
    id: 'pay-2026-06-02-01',
    date: '2026-06-02',
    clientId: 'ath-02',
    category: 'clinic',
    amountCents: 18000,
    method: 'Zelle',
    status: 'paid',
    description: 'Deep Waters — monthly',
  },
  {
    id: 'pay-2026-05-05-01',
    date: '2026-05-05',
    clientId: 'ath-02',
    category: 'camp',
    amountCents: 37500,
    method: 'Check',
    status: 'paid',
    description: 'Winter Intensive — paid in full',
  },
];

/**
 * A wrestler on this account. `Pick` of `Client`, so the compliance block IS
 * the domain `Compliance` record.
 *
 * NOTE what is absent: no age, no weight class, no school, no injury or medical
 * status. The domain model has no field for any of it, deliberately.
 */
type PortalAthlete = Pick<
  Client,
  'id' | 'name' | 'level' | 'status' | 'joinedAt' | 'compliance' | 'notes'
> & {
  /** Coach on the athlete's regular block. Not a ledger field yet. */
  coach: string;
  /** USAW expiry — tracked here until `Compliance` carries the date itself. */
  usawExpiresOn: IsoDate | null;
};

const athletes: PortalAthlete[] = [
  {
    id: 'ath-01',
    name: 'Athlete 01',
    level: 'HS',
    status: 'Active',
    joinedAt: '2024-03-14',
    coach: 'Jesse Vasquez',
    notes: 'Bottom half and scrambles',
    usawExpiresOn: '2026-08-31',
    compliance: {
      usawCardNumber: 'USAW-0000001',
      hasHealthInsurance: true,
      insuranceProvider: 'Sample Health Plan',
      insurancePolicyNumber: null,
      emergencyContactName: 'Guardian 07',
      emergencyContactPhone: '(555) 555-0148',
      waiverSigned: true,
    },
  },
  {
    id: 'ath-02',
    name: 'Athlete 02',
    level: 'Youth',
    status: 'Active',
    joinedAt: '2025-09-08',
    coach: 'Assistant Coach',
    notes: 'Stance, motion and first contact',
    usawExpiresOn: '2026-07-01',
    compliance: {
      usawCardNumber: 'USAW-0000002',
      hasHealthInsurance: false,
      insuranceProvider: null,
      insurancePolicyNumber: null,
      emergencyContactName: 'Guardian 07',
      emergencyContactPhone: '(555) 555-0148',
      waiverSigned: true,
    },
  },
];

/* ==========================================================================
 * DERIVED
 * ======================================================================== */

const athleteName = (id: ClientId): string =>
  athletes.find((athlete) => athlete.id === id)?.name ?? id;

const sessionsRemaining = packages.reduce(
  (sum, pack) => sum + (pack.remaining ?? 0),
  0,
);

const balanceDueCents = sumCents(
  campRegistrations.map((camp) => camp.balanceCents),
);

const nextDueDate =
  campRegistrations.find((camp) => camp.dueDate !== null)?.dueDate ?? null;

const nextSession = upcomingSessions[0];

type FlagState = 'ok' | 'attention' | 'missing';

interface ComplianceFlag {
  label: string;
  detail: string;
  state: FlagState;
}

const FLAG_TONE: Record<FlagState, 'mute' | 'accent' | 'warn'> = {
  ok: 'mute',
  attention: 'accent',
  missing: 'warn',
};

/**
 * The three administrative requirements, read straight off the `Compliance`
 * record. Once Supabase is live this function is unchanged — it already reads
 * the production column names.
 */
function complianceFlags(
  compliance: Compliance,
  usawExpiresOn: IsoDate | null,
): ComplianceFlag[] {
  const expired =
    usawExpiresOn !== null &&
    daysFromIso(usawExpiresOn) < daysFromIso(ANCHOR_DATE);

  return [
    {
      label: 'USAW card',
      detail: !compliance.usawCardNumber
        ? 'No card on file'
        : expired
          ? `Expired ${shortDate(usawExpiresOn as IsoDate)} — renew before camp`
          : usawExpiresOn
            ? `Current through ${shortDate(usawExpiresOn)}`
            : 'On file',
      state: !compliance.usawCardNumber
        ? 'missing'
        : expired
          ? 'attention'
          : 'ok',
    },
    {
      label: 'Insurance on file',
      detail:
        compliance.hasHealthInsurance === true
          ? `${compliance.insuranceProvider ?? 'Provider'} on file`
          : compliance.hasHealthInsurance === false
            ? 'Not received'
            : 'Not asked yet',
      state:
        compliance.hasHealthInsurance === true
          ? 'ok'
          : compliance.hasHealthInsurance === false
            ? 'missing'
            : 'attention',
    },
    {
      label: 'Signed waiver',
      detail: compliance.waiverSigned ? 'Signed and on file' : 'Not signed',
      state: compliance.waiverSigned ? 'ok' : 'missing',
    },
  ];
}

/** Everything not yet satisfied, flattened for the attention panel. */
const outstandingItems = athletes.flatMap((athlete) =>
  complianceFlags(athlete.compliance, athlete.usawExpiresOn)
    .filter((flag) => flag.state !== 'ok')
    .map((flag) => ({athlete: athlete.name, ...flag})),
);

const KIND_LABEL: Record<SessionKind, string> = {
  private: 'Private',
  partner: 'Partner',
  clinic: 'Clinic',
  workout: 'Workout',
  camp: 'Camp',
  group: 'Open Mat',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  Zelle: 'Zelle',
  Venmo: 'Venmo',
  Card: 'Card',
  Check: 'Check',
  Shopify: 'Shopify',
  Other: 'Other',
};

/* ==========================================================================
 * PAGE
 * ======================================================================== */

export default function PortalDashboardPage() {
  return (
    <Screen
      mark={<PortalMark className="hidden h-9 w-auto sm:block" />}
      eyebrow="Family Portal"
      title={account.familyGroup}
      subtitle={`${account.guardian} · member since ${monthYear(
        account.memberSince,
      )} · ${athletes.length} athletes on the roster`}
      notice="Sample data — preview only. Live family accounts arrive with the Shopify store connection."
      actions={
        <>
          <Link to="/train" className="ops-btn ops-btn-primary">
            Book a Session
          </Link>
          <Form method="post" action="/portal/logout">
            <button type="submit" className="ops-btn ops-btn-quiet">
              Sign Out
            </button>
          </Form>
        </>
      }
    >
      {/* -------------------------------------------------------- STAT RAIL
          Replaces the 56px hero date. Four figures on two hairlines, exactly
          one of them accented. */}
      <section aria-label="Account snapshot" data-reveal>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y ops-rule py-4 sm:grid-cols-4">
          <Figure
            variant="definition"
            size="sm"
            accent
            value={sessionsRemaining}
            label="Sessions remaining"
          />
          <Figure
            variant="definition"
            size="sm"
            value={`${dayAbbr(nextSession.start)} ${formatClock(
              nextSession.start,
            )}`}
            label="Next on the mat"
          />
          <Figure
            variant="definition"
            size="sm"
            tone={balanceDueCents > 0 ? 'warn' : 'default'}
            value={formatMoney(balanceDueCents)}
            label="Camp balance due"
          />
          <Figure
            variant="definition"
            size="sm"
            value={outstandingItems.length}
            label="Items to bring in"
          />
        </dl>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-10 xl:gap-x-14">
        {/* ============================================ SESSIONS + CAMPS */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Panel
            label="Upcoming Sessions"
            meta={`${upcomingSessions.length} booked`}
            delay="60ms"
          >
            {/* The grid scrolls sideways rather than dropping a column: on a
                390px phone every field is still reachable. */}
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
              <table className="ops-table min-w-[46rem] text-sm">
                <caption className="ops-sr">
                  Sessions booked on {account.familyGroup} — sample data.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-5">
                      Day
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Time
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Kind
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Focus
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Athlete
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Coach
                    </th>
                    <th scope="col" className="py-2">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSessions.map((session) => (
                    <tr key={session.id}>
                      {/* Deliberately <td>: `.ops-table th` is uppercase 10px
                          with its own hairline — right for a column header,
                          wrong for a date. */}
                      <td className="tabular ops-ink whitespace-nowrap py-3 pr-5">
                        {dayAbbr(session.start)} {shortDate(session.start)}
                      </td>
                      <td className="tabular ops-ink whitespace-nowrap py-3 pr-5">
                        {formatClock(session.start)}
                      </td>
                      <td className="ops-mute whitespace-nowrap py-3 pr-5">
                        {KIND_LABEL[session.kind]}
                      </td>
                      <td className="ops-ink py-3 pr-5">{session.focus}</td>
                      <td className="ops-mute whitespace-nowrap py-3 pr-5">
                        {athleteName(session.athleteIds[0])}
                      </td>
                      <td className="ops-mute whitespace-nowrap py-3 pr-5">
                        {session.coach}
                      </td>
                      <td className="ops-mute py-3">{session.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ops-mute mt-3 text-xs leading-relaxed">
              Need to move one? Text the front desk at least 24 hours ahead and
              the session goes back on your package.
            </p>
          </Panel>

          <Panel
            label="Camp Registrations"
            meta={`${campRegistrations.length} registered · ${formatMoney(
              balanceDueCents,
            )} due`}
            className="mt-8"
            delay="100ms"
          >
            {/* Was ~250px of <dl> per camp. Now one ledger row each. */}
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
              <table className="ops-table min-w-[44rem] text-sm">
                <caption className="ops-sr">
                  Camp registrations on {account.familyGroup} — sample data.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-5">
                      Camp
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Dates
                    </th>
                    <th scope="col" className="py-2 pr-5">
                      Athlete
                    </th>
                    <th scope="col" className="ops-th-right py-2 pr-5">
                      Total
                    </th>
                    <th scope="col" className="ops-th-right py-2 pr-5">
                      Deposit
                    </th>
                    <th scope="col" className="ops-th-right py-2 pr-5">
                      Balance
                    </th>
                    <th scope="col" className="py-2">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campRegistrations.map((camp) => {
                    const owing = camp.balanceCents > 0;
                    return (
                      <tr key={camp.id}>
                        <td className="ops-ink py-3 pr-5">
                          {camp.campTitle}
                          <span className="ops-mute ml-2 text-xs">
                            {camp.location}
                          </span>
                        </td>
                        <td className="tabular ops-mute whitespace-nowrap py-3 pr-5">
                          {shortDate(camp.startDate)}&ndash;
                          {Number(camp.endDate.slice(8, 10))}
                        </td>
                        <td className="ops-mute whitespace-nowrap py-3 pr-5">
                          {athleteName(camp.clientId)}
                        </td>
                        <td className="tabular ops-td-right ops-ink py-3 pr-5">
                          {formatMoney(camp.totalCents)}
                        </td>
                        <td className="tabular ops-td-right ops-mute py-3 pr-5">
                          {formatMoney(camp.depositPaidCents)}
                        </td>
                        <td
                          className={`tabular ops-td-right py-3 pr-5 ${
                            owing ? 'ops-warn' : 'ops-mute'
                          }`}
                        >
                          {formatMoney(camp.balanceCents)}
                        </td>
                        <td className="ops-mute whitespace-nowrap py-3">
                          <Dot
                            tone={owing ? 'warn' : 'mute'}
                            className="mr-2"
                          />
                          {owing && camp.dueDate
                            ? `Due ${shortDate(camp.dueDate)}`
                            : 'Paid in full'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* ================================== PACKAGES + ATTENTION + ACCOUNT */}
        <div className="lg:col-span-5 xl:col-span-4">
          <Panel
            label="Packages"
            meta={`${sessionsRemaining} sessions left`}
            delay="140ms"
          >
            <ul>
              {packages.map((pack, index) => (
                <Row
                  key={`${pack.clientId}-${pack.name}`}
                  first={index === 0}
                  className="py-3"
                >
                  <p className="flex items-baseline justify-between gap-4">
                    <span className="ops-ink min-w-0 truncate text-sm">
                      {pack.name}
                    </span>
                    <span className="tabular ops-accent shrink-0 text-sm">
                      {pack.remaining} left
                    </span>
                  </p>
                  <div className="mt-2">
                    <Meter
                      used={pack.used ?? 0}
                      total={pack.purchased ?? 0}
                      label={`${pack.name} for ${athleteName(pack.clientId)}`}
                      valueText={`${pack.used} of ${pack.purchased} sessions used`}
                    />
                  </div>
                  <p className="tabular ops-mute mt-2 flex items-baseline justify-between gap-4 text-xs">
                    <span>
                      {athleteName(pack.clientId)} · {pack.used}/
                      {pack.purchased} used
                    </span>
                    <span>Expires {shortDate(pack.expiresOn)}</span>
                  </p>
                </Row>
              ))}
            </ul>
            <Link
              to="/train"
              className="ops-btn ops-btn-quiet mt-4 w-full sm:w-auto"
            >
              Buy More Sessions
            </Link>
          </Panel>

          {outstandingItems.length > 0 ? (
            <Panel
              label="Needs Your Attention"
              meta={`${outstandingItems.length} items`}
              className="mt-8"
              delay="180ms"
            >
              <ul>
                {outstandingItems.map((item, index) => (
                  <Row
                    key={`${item.athlete}-${item.label}`}
                    first={index === 0}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <span className="ops-ink min-w-0 truncate text-sm">
                      <Dot tone={FLAG_TONE[item.state]} className="mr-2" />
                      {item.athlete} — {item.label}
                    </span>
                    <span className="ops-mute shrink-0 text-right text-xs">
                      {item.detail}
                    </span>
                  </Row>
                ))}
              </ul>
              <p className="ops-mute mt-3 text-xs leading-relaxed">
                Bring these to the front desk before the next camp check-in.
              </p>
            </Panel>
          ) : null}

          <Panel label="Account" className="mt-8" delay="220ms">
            <dl className="text-sm">
              {[
                ['Household', account.familyGroup],
                ['Guardian', account.guardian],
                ['Email', account.email],
                ['Phone', account.phone],
                ['Member since', monthYear(account.memberSince)],
              ].map(([label, value], index) => (
                <Row
                  key={label}
                  as="div"
                  first={index === 0}
                  className="flex items-baseline justify-between gap-4 py-2"
                >
                  <dt className="ops-mute shrink-0 text-[0.6875rem] uppercase tracking-[0.16em]">
                    {label}
                  </dt>
                  <dd className="tabular ops-ink min-w-0 truncate text-right">
                    {value}
                  </dd>
                </Row>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {/* --------------------------------------------------------- ATHLETES */}
      <Panel
        label="Your Athletes"
        meta={`${athletes.length} on the roster`}
        className="mt-8"
        delay="60ms"
      >
        <ul className="ops-grid grid-cols-1 md:grid-cols-2">
          {athletes.map((athlete) => (
            <li key={athlete.id} className="p-4 md:p-5">
              <p className="flex items-baseline justify-between gap-4">
                <span className="display ops-ink text-base">
                  {athlete.name}
                </span>
                <span className="ops-mute text-xs uppercase tracking-[0.16em]">
                  {athlete.level} · {athlete.status}
                </span>
              </p>

              {/* Compact inline pairs. This was a <dl> with gap-y-5. */}
              <dl className="mt-3 border-t ops-rule pt-2 text-sm">
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="ops-mute shrink-0 text-[0.6875rem] uppercase tracking-[0.16em]">
                    Working on
                  </dt>
                  <dd className="ops-ink min-w-0 text-right">
                    {athlete.notes}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="ops-mute shrink-0 text-[0.6875rem] uppercase tracking-[0.16em]">
                    Primary coach
                  </dt>
                  <dd className="ops-ink min-w-0 text-right">
                    {athlete.coach}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <dt className="ops-mute shrink-0 text-[0.6875rem] uppercase tracking-[0.16em]">
                    With the club since
                  </dt>
                  <dd className="tabular ops-ink min-w-0 text-right">
                    {monthYear(athlete.joinedAt)}
                  </dd>
                </div>
              </dl>

              <ul className="mt-2 border-t ops-rule pt-2">
                {complianceFlags(athlete.compliance, athlete.usawExpiresOn).map(
                  (flag) => (
                    <li
                      key={flag.label}
                      className="flex items-baseline justify-between gap-4 py-1"
                    >
                      <span className="ops-ink shrink-0 text-xs">
                        <Dot tone={FLAG_TONE[flag.state]} className="mr-2" />
                        {flag.label}
                      </span>
                      <span
                        className={`min-w-0 text-right text-xs ${
                          flag.state === 'ok' ? 'ops-mute' : 'ops-warn'
                        }`}
                      >
                        {flag.detail}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ---------------------------------------------------------- BILLING */}
      <Panel
        label="Billing History"
        meta={`${billingHistory.length} payments`}
        className="mt-8"
        delay="100ms"
      >
        <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
          <table className="ops-table min-w-[40rem] text-sm">
            <caption className="ops-sr">
              Past payments on {account.familyGroup} — sample data.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-5">
                  Date
                </th>
                <th scope="col" className="py-2 pr-5">
                  Item
                </th>
                <th scope="col" className="py-2 pr-5">
                  Athlete
                </th>
                <th scope="col" className="py-2 pr-5">
                  Method
                </th>
                <th scope="col" className="ops-th-right py-2">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((row) => (
                <tr key={row.id}>
                  <td className="tabular ops-mute whitespace-nowrap py-3 pr-5">
                    {shortDate(row.date)}, {row.date.slice(0, 4)}
                  </td>
                  <td className="ops-ink py-3 pr-5">{row.description}</td>
                  <td className="ops-mute whitespace-nowrap py-3 pr-5">
                    {row.clientId ? athleteName(row.clientId) : '—'}
                  </td>
                  <td className="ops-mute whitespace-nowrap py-3 pr-5">
                    {METHOD_LABEL[row.method]}
                  </td>
                  <td className="tabular ops-td-right ops-ink py-3">
                    {formatMoney(row.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {nextDueDate ? (
        <p className="ops-mute mt-6 text-xs leading-relaxed">
          Camp balances are collected at checkout once the store is connected.
          Until then the front desk takes payment in person — next balance is
          due {shortDate(nextDueDate)}.
        </p>
      ) : null}
    </Screen>
  );
}
