/**
 * ============================================================================
 * CLIENT LIST — FILTER MODEL
 * ============================================================================
 *
 * Everything on /private/clients that is NOT markup lives here: the derived row
 * shape, URL <-> filter-state serialisation, the per-dimension predicates, the
 * facet counter, the comparators, the saved views and the CSV writer.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE
 * -------------------------------------
 * 1. THE URL IS THE STATE. There is no useState for a filter anywhere on the
 *    page. `parseFilters(searchParams)` is the only reader and
 *    `writeFilters(state)` is the only writer, so any view Jesse is looking at
 *    is a link he can bookmark, text to himself, refresh, or walk back out of
 *    with the browser's back button.
 * 2. FILTERS ARE PER-DIMENSION, NOT ONE BIG PREDICATE. `dimensionPredicates`
 *    returns one test per dimension, which lets us do the two things a real
 *    filtering UI needs and a naive `rows.filter(bigFn)` cannot:
 *      - facet counts ("Youth 17") computed with that facet's own dimension
 *        held out, so the numbers stay useful instead of collapsing to the
 *        current selection;
 *      - an empty state that can name WHICH filter is excluding everything.
 *
 * Pure module. No Date.now(), no Math.random(), no browser globals at import
 * time — every figure is derived from the seed's ANCHOR_DATE so the server and
 * the browser render byte-identical HTML.
 */

import type {
  Client,
  ClientLevel,
  ClientSource,
  ClientStatus,
  IsoDate,
} from '~/lib/ops/types';
import {addDays, ageOn, daysBetween, formatMoney} from '~/lib/ops/types';

/* ==========================================================================
 * 1. DERIVED ROW
 * ======================================================================== */

/** Package/session-bank state, bucketed the way a coach actually thinks. */
export type PackageBucket = 'healthy' | 'low' | 'exhausted' | 'none';

/** A missing piece of registration paperwork. */
export type ComplianceGap = 'usaw' | 'insurance' | 'waiver' | 'emergency';

/**
 * A `Client` plus every value the table sorts, filters or searches on,
 * computed once. The original record rides along on `.client` so the detail
 * sheet and the CSV never have to go looking for it.
 */
export interface ClientRow {
  client: Client;
  id: string;
  name: string;
  accountLabel: string;
  guardian: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  level: ClientLevel;
  status: ClientStatus;
  source: ClientSource;
  tags: string[];
  familyGroup: string | null;
  joinedAt: IsoDate;
  lastSessionAt: IsoDate | null;
  /** Whole days between the last completed session and the anchor. */
  daysSinceSeen: number | null;
  daysSinceJoined: number;
  remaining: number;
  purchased: number;
  packageName: string | null;
  packageBucket: PackageBucket;
  gaps: ComplianceGap[];
  lifetimeValueCents: number;
  balanceCents: number;
  age: number | null;
  /** Lowercased haystack for the free-text box. */
  searchText: string;
}

export const PACKAGE_BUCKET_LABEL: Record<PackageBucket, string> = {
  healthy: 'Healthy (3+)',
  low: 'Running low (1–2)',
  exhausted: 'Exhausted (0)',
  none: 'No package',
};

export const GAP_LABEL: Record<ComplianceGap, string> = {
  usaw: 'Missing USAW card',
  insurance: 'No insurance on file',
  waiver: 'Waiver unsigned',
  emergency: 'No emergency contact',
};

export const GAP_SHORT: Record<ComplianceGap, string> = {
  usaw: 'USAW',
  insurance: 'INS',
  waiver: 'WVR',
  emergency: 'ICE',
};

export const SOURCE_LABEL: Record<ClientSource, string> = {
  site: 'Site booking',
  shopify: 'Shopify',
  manual: 'Added by coach',
  import: 'Imported',
};

export const LEVELS: ClientLevel[] = ['Youth', 'HS', 'College', 'Adult'];
export const STATUSES: ClientStatus[] = [
  'Active',
  'Trial',
  'Paid In Full',
  'Owes Balance',
  'Inactive',
];
export const SOURCES: ClientSource[] = ['site', 'shopify', 'manual', 'import'];
export const PACKAGE_BUCKETS: PackageBucket[] = [
  'healthy',
  'low',
  'exhausted',
  'none',
];
export const GAPS: ComplianceGap[] = ['usaw', 'insurance', 'waiver', 'emergency'];

/** Build the derived roster. Deterministic — safe to call during render. */
export function buildRows(
  clients: readonly Client[],
  anchorDate: IsoDate,
): ClientRow[] {
  return clients.map((client) => {
    const remaining = client.packages.remaining ?? 0;
    const purchased = client.packages.purchased ?? 0;

    // 'none' means there was never a package to burn down; 'exhausted' means
    // there was one and it is spent. Those are different sales conversations.
    const packageBucket: PackageBucket =
      purchased <= 0 && remaining <= 0
        ? 'none'
        : remaining <= 0
          ? 'exhausted'
          : remaining <= 2
            ? 'low'
            : 'healthy';

    const gaps: ComplianceGap[] = [];
    if (!client.compliance.usawCardNumber) gaps.push('usaw');
    // `null` (never asked) counts as a gap — an unanswered question is a hole.
    if (client.compliance.hasHealthInsurance !== true) gaps.push('insurance');
    if (!client.compliance.waiverSigned) gaps.push('waiver');
    if (!client.compliance.emergencyContactPhone) gaps.push('emergency');

    const searchText = [
      client.name,
      client.accountLabel,
      client.guardian ?? '',
      client.email ?? '',
      client.phone ?? '',
      client.school ?? '',
      client.familyGroup ?? '',
      client.level,
      client.status,
      client.packages.name ?? '',
      client.notes ?? '',
      client.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    return {
      client,
      id: client.id,
      name: client.name,
      accountLabel: client.accountLabel,
      guardian: client.guardian,
      email: client.email,
      phone: client.phone,
      school: client.school,
      level: client.level,
      status: client.status,
      source: client.source,
      tags: client.tags,
      familyGroup: client.familyGroup,
      joinedAt: client.joinedAt,
      lastSessionAt: client.lastSessionAt,
      daysSinceSeen: client.lastSessionAt
        ? daysBetween(client.lastSessionAt, anchorDate)
        : null,
      daysSinceJoined: daysBetween(client.joinedAt, anchorDate),
      remaining,
      purchased,
      packageName: client.packages.name,
      packageBucket,
      gaps,
      lifetimeValueCents: client.lifetimeValueCents,
      balanceCents: client.balanceCents,
      age: client.dateOfBirth ? ageOn(client.dateOfBirth, anchorDate) : null,
      searchText,
    };
  });
}

/** Every family group present in the data, sorted. */
export function familyGroupsOf(rows: readonly ClientRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.familyGroup) set.add(r.familyGroup);
  return Array.from(set).sort();
}

/** Every tag present in the data, sorted. */
export function tagsOf(rows: readonly ClientRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return Array.from(set).sort();
}

/* ==========================================================================
 * 2. FILTER STATE  <->  URL
 * ======================================================================== */

export type SortKey =
  | 'name'
  | 'level'
  | 'status'
  | 'source'
  | 'family'
  | 'remaining'
  | 'last'
  | 'joined'
  | 'ltv'
  | 'balance'
  | 'gaps'
  | 'age';

export type SortDir = 'asc' | 'desc';

/**
 * The whole page in one object. Numeric and date bounds are held as the raw
 * STRING the user typed, not as parsed numbers: an empty box, a half-typed
 * "1" and a deliberate 0 have to stay distinguishable, and the value has to
 * survive a round trip through the URL unchanged.
 */
export interface ClientFilterState {
  q: string;
  level: ClientLevel[];
  status: ClientStatus[];
  source: ClientSource[];
  tags: string[];
  family: string[];
  gaps: ComplianceGap[];
  pkg: PackageBucket[];
  joinedFrom: string;
  joinedTo: string;
  seenFrom: string;
  seenTo: string;
  /** Whole dollars, as typed. */
  ltvMin: string;
  ltvMax: string;
  remMin: string;
  remMax: string;
  sort: SortKey;
  dir: SortDir;
}

export const DEFAULT_SORT: SortKey = 'name';
export const DEFAULT_DIR: SortDir = 'asc';

export const EMPTY_FILTERS: ClientFilterState = {
  q: '',
  level: [],
  status: [],
  source: [],
  tags: [],
  family: [],
  gaps: [],
  pkg: [],
  joinedFrom: '',
  joinedTo: '',
  seenFrom: '',
  seenTo: '',
  ltvMin: '',
  ltvMax: '',
  remMin: '',
  remMax: '',
  sort: DEFAULT_SORT,
  dir: DEFAULT_DIR,
};

/** Short, stable URL keys. Changing one invalidates every saved bookmark. */
const PARAM = {
  q: 'q',
  level: 'level',
  status: 'status',
  source: 'src',
  tags: 'tag',
  family: 'fam',
  gaps: 'gap',
  pkg: 'pkg',
  joinedFrom: 'jf',
  joinedTo: 'jt',
  seenFrom: 'sf',
  seenTo: 'st',
  ltvMin: 'ltvmin',
  ltvMax: 'ltvmax',
  remMin: 'remmin',
  remMax: 'remmax',
  sort: 'sort',
  dir: 'dir',
} as const;

/** The selected client's id — kept in the URL so a detail sheet is linkable. */
export const CLIENT_PARAM = 'client';

/** Multi-values ride as one comma-joined param; no value contains a comma. */
function readList(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Drop anything the current data model does not recognise. */
function keepKnown<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC = /^\d{1,9}$/;

export function parseFilters(sp: URLSearchParams): ClientFilterState {
  const sortRaw = sp.get(PARAM.sort) ?? '';
  const dirRaw = sp.get(PARAM.dir) ?? '';
  const date = (key: string) => {
    const v = sp.get(key) ?? '';
    return ISO_DATE.test(v) ? v : '';
  };
  const num = (key: string) => {
    const v = sp.get(key) ?? '';
    return NUMERIC.test(v) ? v : '';
  };

  return {
    q: (sp.get(PARAM.q) ?? '').slice(0, 120),
    level: keepKnown(readList(sp, PARAM.level), LEVELS),
    status: keepKnown(readList(sp, PARAM.status), STATUSES),
    source: keepKnown(readList(sp, PARAM.source), SOURCES),
    tags: readList(sp, PARAM.tags),
    family: readList(sp, PARAM.family),
    gaps: keepKnown(readList(sp, PARAM.gaps), GAPS),
    pkg: keepKnown(readList(sp, PARAM.pkg), PACKAGE_BUCKETS),
    joinedFrom: date(PARAM.joinedFrom),
    joinedTo: date(PARAM.joinedTo),
    seenFrom: date(PARAM.seenFrom),
    seenTo: date(PARAM.seenTo),
    ltvMin: num(PARAM.ltvMin),
    ltvMax: num(PARAM.ltvMax),
    remMin: num(PARAM.remMin),
    remMax: num(PARAM.remMax),
    sort: (SORT_KEYS as readonly string[]).includes(sortRaw)
      ? (sortRaw as SortKey)
      : DEFAULT_SORT,
    dir: dirRaw === 'desc' ? 'desc' : DEFAULT_DIR,
  };
}

/**
 * State -> URLSearchParams. Defaults are omitted entirely, so a cleared page is
 * a bare `/private/clients` and a shared link carries only what matters.
 * `keep` preserves params this page does not own (e.g. the open client sheet).
 */
export function writeFilters(
  state: ClientFilterState,
  keep?: URLSearchParams,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (keep) {
    const client = keep.get(CLIENT_PARAM);
    if (client) sp.set(CLIENT_PARAM, client);
  }
  const put = (key: string, value: string) => {
    if (value) sp.set(key, value);
  };
  const putList = (key: string, values: string[]) => {
    if (values.length) sp.set(key, values.join(','));
  };

  put(PARAM.q, state.q.trim());
  putList(PARAM.level, state.level);
  putList(PARAM.status, state.status);
  putList(PARAM.source, state.source);
  putList(PARAM.tags, state.tags);
  putList(PARAM.family, state.family);
  putList(PARAM.gaps, state.gaps);
  putList(PARAM.pkg, state.pkg);
  put(PARAM.joinedFrom, state.joinedFrom);
  put(PARAM.joinedTo, state.joinedTo);
  put(PARAM.seenFrom, state.seenFrom);
  put(PARAM.seenTo, state.seenTo);
  put(PARAM.ltvMin, state.ltvMin);
  put(PARAM.ltvMax, state.ltvMax);
  put(PARAM.remMin, state.remMin);
  put(PARAM.remMax, state.remMax);
  if (state.sort !== DEFAULT_SORT) sp.set(PARAM.sort, state.sort);
  if (state.dir !== DEFAULT_DIR) sp.set(PARAM.dir, state.dir);
  return sp;
}

/** True when nothing is narrowing the roster (sort order does not count). */
export function isPristine(state: ClientFilterState): boolean {
  return activeDimensions(state).length === 0;
}

/* ==========================================================================
 * 3. PREDICATES, ONE PER DIMENSION
 * ======================================================================== */

export type DimensionKey =
  | 'q'
  | 'level'
  | 'status'
  | 'source'
  | 'tags'
  | 'family'
  | 'gaps'
  | 'pkg'
  | 'joined'
  | 'seen'
  | 'ltv'
  | 'rem';

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  q: 'Search',
  level: 'Level',
  status: 'Status',
  source: 'Source',
  tags: 'Tags',
  family: 'Family group',
  gaps: 'Compliance gaps',
  pkg: 'Package state',
  joined: 'Joined range',
  seen: 'Last seen range',
  ltv: 'Lifetime value range',
  rem: 'Sessions remaining range',
};

const ALL_DIMENSIONS: DimensionKey[] = [
  'q',
  'level',
  'status',
  'source',
  'tags',
  'family',
  'gaps',
  'pkg',
  'joined',
  'seen',
  'ltv',
  'rem',
];

/** Which dimensions are currently doing work. Drives chips and diagnostics. */
export function activeDimensions(state: ClientFilterState): DimensionKey[] {
  const active: DimensionKey[] = [];
  if (state.q.trim()) active.push('q');
  if (state.level.length) active.push('level');
  if (state.status.length) active.push('status');
  if (state.source.length) active.push('source');
  if (state.tags.length) active.push('tags');
  if (state.family.length) active.push('family');
  if (state.gaps.length) active.push('gaps');
  if (state.pkg.length) active.push('pkg');
  if (state.joinedFrom || state.joinedTo) active.push('joined');
  if (state.seenFrom || state.seenTo) active.push('seen');
  if (state.ltvMin || state.ltvMax) active.push('ltv');
  if (state.remMin || state.remMax) active.push('rem');
  return active;
}

/** Multi-word search: every token must appear somewhere in the haystack. */
function matchesQuery(row: ClientRow, q: string): boolean {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  for (const t of tokens) if (!row.searchText.includes(t)) return false;
  return true;
}

/**
 * One test per dimension. Within a dimension the semantics are OR (any of the
 * selected levels); across dimensions they are AND. Compliance gaps are OR too
 * — "show me anyone missing anything I ticked" is the useful reading.
 */
function dimensionPredicates(
  state: ClientFilterState,
): Record<DimensionKey, (row: ClientRow) => boolean> {
  const ltvMin = state.ltvMin ? Number(state.ltvMin) * 100 : null;
  const ltvMax = state.ltvMax ? Number(state.ltvMax) * 100 : null;
  const remMin = state.remMin ? Number(state.remMin) : null;
  const remMax = state.remMax ? Number(state.remMax) : null;

  return {
    q: (r) => matchesQuery(r, state.q),
    level: (r) => !state.level.length || state.level.includes(r.level),
    status: (r) => !state.status.length || state.status.includes(r.status),
    source: (r) => !state.source.length || state.source.includes(r.source),
    tags: (r) => !state.tags.length || state.tags.some((t) => r.tags.includes(t)),
    family: (r) =>
      !state.family.length ||
      (r.familyGroup !== null && state.family.includes(r.familyGroup)),
    gaps: (r) => !state.gaps.length || state.gaps.some((g) => r.gaps.includes(g)),
    pkg: (r) => !state.pkg.length || state.pkg.includes(r.packageBucket),
    // ISO dates sort lexicographically, so string compare is date compare.
    joined: (r) =>
      (!state.joinedFrom || r.joinedAt >= state.joinedFrom) &&
      (!state.joinedTo || r.joinedAt <= state.joinedTo),
    /**
     * NULL SEMANTICS, DELIBERATE: an athlete who has never trained reads as
     * infinitely stale. They fail a "seen on or after" bound and pass a "seen
     * on or before" bound — which is what makes the Dormant view include the
     * people who never made it onto the mat at all.
     */
    seen: (r) => {
      if (state.seenFrom && (!r.lastSessionAt || r.lastSessionAt < state.seenFrom)) {
        return false;
      }
      if (state.seenTo && r.lastSessionAt && r.lastSessionAt > state.seenTo) {
        return false;
      }
      return true;
    },
    ltv: (r) =>
      (ltvMin === null || r.lifetimeValueCents >= ltvMin) &&
      (ltvMax === null || r.lifetimeValueCents <= ltvMax),
    rem: (r) =>
      (remMin === null || r.remaining >= remMin) &&
      (remMax === null || r.remaining <= remMax),
  };
}

/**
 * Apply every dimension except `except`. Holding one out is what powers both
 * the facet counts and the "which filter is hiding everything" diagnosis.
 */
export function filterRows(
  rows: readonly ClientRow[],
  state: ClientFilterState,
  except?: DimensionKey,
): ClientRow[] {
  const tests = dimensionPredicates(state);
  const keys = ALL_DIMENSIONS.filter((k) => k !== except);
  return rows.filter((row) => {
    for (const k of keys) if (!tests[k](row)) return false;
    return true;
  });
}

/* ==========================================================================
 * 4. FACET COUNTS
 * ======================================================================== */

/**
 * How many rows each option of `dimension` would yield, with that dimension's
 * own selection held out. Ticking "Youth" therefore does not knock "HS" to
 * zero — the counts stay a map of what else is available, which is the whole
 * reason to print them.
 */
export function facetCounts(
  rows: readonly ClientRow[],
  state: ClientFilterState,
  dimension: DimensionKey,
  valuesOf: (row: ClientRow) => readonly string[],
): Record<string, number> {
  const base = filterRows(rows, state, dimension);
  const counts: Record<string, number> = {};
  for (const row of base) {
    for (const v of valuesOf(row)) counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

export const VALUES = {
  level: (r: ClientRow) => [r.level],
  status: (r: ClientRow) => [r.status],
  source: (r: ClientRow) => [r.source],
  tags: (r: ClientRow) => r.tags,
  family: (r: ClientRow) => (r.familyGroup ? [r.familyGroup] : []),
  gaps: (r: ClientRow) => r.gaps,
  pkg: (r: ClientRow) => [r.packageBucket],
};

/* ==========================================================================
 * 5. SORTING
 * ======================================================================== */

export const SORT_KEYS = [
  'name',
  'level',
  'status',
  'source',
  'family',
  'remaining',
  'last',
  'joined',
  'ltv',
  'balance',
  'gaps',
  'age',
] as const;

export const SORT_LABEL: Record<SortKey, string> = {
  name: 'Athlete',
  level: 'Level',
  status: 'Status',
  source: 'Source',
  family: 'Family',
  remaining: 'Sessions left',
  last: 'Last session',
  joined: 'Joined',
  ltv: 'Lifetime value',
  balance: 'Balance',
  gaps: 'Compliance',
  age: 'Age',
};

const LEVEL_ORDER: Record<ClientLevel, number> = {
  Youth: 0,
  HS: 1,
  College: 2,
  Adult: 3,
};

/** Ordered by how much attention the status demands, not alphabetically. */
const STATUS_ORDER: Record<ClientStatus, number> = {
  'Owes Balance': 0,
  Trial: 1,
  Active: 2,
  'Paid In Full': 3,
  Inactive: 4,
};

/** `null` sorts last in ascending order, whichever column it is in. */
function nullsLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

export function sortRows(
  rows: readonly ClientRow[],
  sort: SortKey,
  dir: SortDir,
): ClientRow[] {
  const sign = dir === 'desc' ? -1 : 1;
  // Index tiebreak keeps the order total and therefore stable across renders.
  const indexed = rows.map((row, i) => ({row, i}));

  indexed.sort((x, y) => {
    const a = x.row;
    const b = y.row;
    let d = 0;
    switch (sort) {
      case 'name':
        d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        break;
      case 'level':
        d = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
        break;
      case 'status':
        d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        break;
      case 'source':
        d = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
        break;
      case 'family':
        d = nullsLast(a.familyGroup, b.familyGroup);
        break;
      case 'remaining':
        d = a.remaining - b.remaining;
        break;
      case 'last':
        d = nullsLast(a.lastSessionAt, b.lastSessionAt);
        break;
      case 'joined':
        d = a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0;
        break;
      case 'ltv':
        d = a.lifetimeValueCents - b.lifetimeValueCents;
        break;
      case 'balance':
        d = a.balanceCents - b.balanceCents;
        break;
      case 'gaps':
        d = a.gaps.length - b.gaps.length;
        break;
      case 'age':
        d = (a.age ?? -1) - (b.age ?? -1);
        break;
      default:
        d = 0;
    }
    if (d !== 0) return d * sign;
    // Secondary key is always the name, so equal ranks read alphabetically.
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return x.i - y.i;
  });

  return indexed.map((entry) => entry.row);
}

/** Which direction a column should open in when it is first clicked. */
export function defaultDirFor(sort: SortKey): SortDir {
  return sort === 'name' || sort === 'level' || sort === 'family' ? 'asc' : 'desc';
}

/* ==========================================================================
 * 6. SAVED VIEWS
 * ======================================================================== */

export interface SavedView {
  id: string;
  label: string;
  /** One line explaining what the view answers. Rendered as the chip title. */
  hint: string;
  build: (anchor: IsoDate) => Partial<ClientFilterState>;
}

/**
 * Presets are expressed as a PATCH over `EMPTY_FILTERS`, never as a merge over
 * whatever is already selected — one tap should land Jesse on exactly the view
 * he expects, not on a mystery intersection with yesterday's filters.
 */
export const SAVED_VIEWS: SavedView[] = [
  {
    id: 'owes',
    label: 'Owes balance',
    hint: 'Anyone carrying an unpaid balance, biggest first',
    build: () => ({status: ['Owes Balance'], sort: 'balance', dir: 'desc'}),
  },
  {
    id: 'compliance',
    label: 'Compliance gaps',
    hint: 'Missing USAW card, insurance or a signed waiver',
    build: () => ({gaps: ['usaw', 'insurance', 'waiver'], sort: 'gaps', dir: 'desc'}),
  },
  {
    id: 'low',
    label: 'Package running low',
    hint: 'Two or fewer sessions left in the bank',
    build: () => ({pkg: ['low', 'exhausted'], sort: 'remaining', dir: 'asc'}),
  },
  {
    id: 'new',
    label: 'New this month',
    /**
     * A rolling 30 days, not `YYYY-MM-01`. Anchored on the 1st, a
     * calendar-month view would be empty on the day Jesse most wants to check
     * it — a preset that shows nothing is a preset he stops tapping.
     */
    hint: 'Joined in the last 30 days',
    build: (anchor) => ({
      joinedFrom: addDays(anchor, -30),
      sort: 'joined',
      dir: 'desc',
    }),
  },
  {
    id: 'dormant',
    label: 'Dormant 30+ days',
    hint: 'No completed session in the last 30 days',
    build: (anchor) => ({
      seenTo: addDays(anchor, -30),
      sort: 'last',
      dir: 'asc',
    }),
  },
  {
    id: 'vip',
    label: 'Top lifetime value',
    hint: 'Families who have spent $2,000 or more',
    build: () => ({ltvMin: '2000', sort: 'ltv', dir: 'desc'}),
  },
];

/** True when `state` is exactly this preset — used to light the chip up. */
export function viewIsActive(
  view: SavedView,
  state: ClientFilterState,
  anchor: IsoDate,
): boolean {
  const target = {...EMPTY_FILTERS, ...view.build(anchor)};
  const keys = Object.keys(EMPTY_FILTERS) as (keyof ClientFilterState)[];
  for (const key of keys) {
    const a = target[key];
    const b = state[key];
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (const v of a) if (!(b as string[]).includes(v)) return false;
    } else if (a !== b) {
      return false;
    }
  }
  return true;
}

/* ==========================================================================
 * 7. ACTIVE-FILTER CHIPS
 * ======================================================================== */

export interface FilterChip {
  /** Stable key for React and for the remove handler. */
  key: string;
  dimension: DimensionKey;
  /** Present for multi-select dimensions; absent for ranges and search. */
  value?: string;
  label: string;
  prefix: string;
}

export function chipsFor(state: ClientFilterState): FilterChip[] {
  const chips: FilterChip[] = [];
  const push = (
    dimension: DimensionKey,
    prefix: string,
    label: string,
    value?: string,
  ) => {
    chips.push({key: `${dimension}:${value ?? ''}`, dimension, value, label, prefix});
  };

  if (state.q.trim()) push('q', 'Search', `“${state.q.trim()}”`);
  for (const v of state.level) push('level', 'Level', v, v);
  for (const v of state.status) push('status', 'Status', v, v);
  for (const v of state.source) push('source', 'Source', SOURCE_LABEL[v], v);
  for (const v of state.tags) push('tags', 'Tag', v, v);
  for (const v of state.family) push('family', 'Family', v, v);
  for (const v of state.gaps) push('gaps', 'Gap', GAP_LABEL[v], v);
  for (const v of state.pkg) push('pkg', 'Package', PACKAGE_BUCKET_LABEL[v], v);
  if (state.joinedFrom || state.joinedTo) {
    push('joined', 'Joined', rangeLabel(state.joinedFrom, state.joinedTo));
  }
  if (state.seenFrom || state.seenTo) {
    push('seen', 'Last seen', rangeLabel(state.seenFrom, state.seenTo));
  }
  if (state.ltvMin || state.ltvMax) {
    push(
      'ltv',
      'Lifetime',
      rangeLabel(
        state.ltvMin ? `$${state.ltvMin}` : '',
        state.ltvMax ? `$${state.ltvMax}` : '',
      ),
    );
  }
  if (state.remMin || state.remMax) {
    push('rem', 'Sessions left', rangeLabel(state.remMin, state.remMax));
  }
  return chips;
}

function rangeLabel(from: string, to: string): string {
  if (from && to) return `${from} → ${to}`;
  if (from) return `from ${from}`;
  return `up to ${to}`;
}

/** Clear one chip. Multi-selects lose one value; ranges lose both bounds. */
export function clearChip(
  state: ClientFilterState,
  chip: FilterChip,
): ClientFilterState {
  const next = {...state};
  switch (chip.dimension) {
    case 'q':
      next.q = '';
      break;
    case 'level':
      next.level = next.level.filter((v) => v !== chip.value);
      break;
    case 'status':
      next.status = next.status.filter((v) => v !== chip.value);
      break;
    case 'source':
      next.source = next.source.filter((v) => v !== chip.value);
      break;
    case 'tags':
      next.tags = next.tags.filter((v) => v !== chip.value);
      break;
    case 'family':
      next.family = next.family.filter((v) => v !== chip.value);
      break;
    case 'gaps':
      next.gaps = next.gaps.filter((v) => v !== chip.value);
      break;
    case 'pkg':
      next.pkg = next.pkg.filter((v) => v !== chip.value);
      break;
    case 'joined':
      next.joinedFrom = '';
      next.joinedTo = '';
      break;
    case 'seen':
      next.seenFrom = '';
      next.seenTo = '';
      break;
    case 'ltv':
      next.ltvMin = '';
      next.ltvMax = '';
      break;
    case 'rem':
      next.remMin = '';
      next.remMax = '';
      break;
    default:
      break;
  }
  return next;
}

/* ==========================================================================
 * 8. EMPTY-STATE DIAGNOSIS
 *
 * "0 of 40" with no explanation is a dead end. When the result set is empty we
 * re-run the filter once per active dimension with that dimension held out; any
 * dimension whose removal brings rows back is, on its own, sufficient to
 * explain the emptiness, and we can name it.
 * ======================================================================== */

export interface EmptyCulprit {
  dimension: DimensionKey;
  label: string;
  /** How many rows come back if this one dimension is dropped. */
  wouldShow: number;
}

export function diagnoseEmpty(
  rows: readonly ClientRow[],
  state: ClientFilterState,
): EmptyCulprit[] {
  const out: EmptyCulprit[] = [];
  for (const dimension of activeDimensions(state)) {
    const wouldShow = filterRows(rows, state, dimension).length;
    if (wouldShow > 0) {
      out.push({dimension, label: DIMENSION_LABEL[dimension], wouldShow});
    }
  }
  return out.sort((a, b) => b.wouldShow - a.wouldShow);
}

/* ==========================================================================
 * 9. SUMMARY OF THE FILTERED SET
 * ======================================================================== */

export interface RosterSummary {
  count: number;
  lifetimeCents: number;
  balanceCents: number;
  owing: number;
  sessionsRemaining: number;
  gapCount: number;
  /** Status composition, in STATUS_ORDER, for the hairline stacked bar. */
  statusBars: {status: ClientStatus; count: number; share: number}[];
}

export function summarise(rows: readonly ClientRow[]): RosterSummary {
  let lifetimeCents = 0;
  let balanceCents = 0;
  let owing = 0;
  let sessionsRemaining = 0;
  let gapCount = 0;
  const byStatus = new Map<ClientStatus, number>();

  for (const r of rows) {
    lifetimeCents += r.lifetimeValueCents;
    balanceCents += r.balanceCents;
    if (r.balanceCents > 0) owing += 1;
    sessionsRemaining += r.remaining;
    if (r.gaps.length) gapCount += 1;
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }

  const total = rows.length || 1;
  const statusBars = STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
    share: ((byStatus.get(status) ?? 0) / total) * 100,
  })).filter((bar) => bar.count > 0);

  return {
    count: rows.length,
    lifetimeCents,
    balanceCents,
    owing,
    sessionsRemaining,
    gapCount,
    statusBars,
  };
}

/* ==========================================================================
 * 10. CSV
 * ======================================================================== */

const CSV_HEADERS = [
  'Athlete',
  'Account',
  'Guardian',
  'Email',
  'Phone',
  'Level',
  'Age',
  'School',
  'Status',
  'Source',
  'Family group',
  'Tags',
  'Joined',
  'Last session',
  'Days since seen',
  'Package',
  'Sessions remaining',
  'Lifetime value',
  'Balance',
  'USAW card',
  'Insurance',
  'Waiver',
  'Emergency contact',
];

/** RFC 4180: quote everything that could contain a comma, quote or newline. */
function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(rows: readonly ClientRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.accountLabel,
        r.guardian,
        r.email,
        r.phone,
        r.level,
        r.age,
        r.school,
        r.status,
        SOURCE_LABEL[r.source],
        r.familyGroup,
        r.tags.join(' | '),
        r.joinedAt,
        r.lastSessionAt,
        r.daysSinceSeen,
        r.packageName,
        r.remaining,
        formatMoney(r.lifetimeValueCents, {cents: true}),
        formatMoney(r.balanceCents, {cents: true}),
        r.client.compliance.usawCardNumber ? 'Yes' : 'MISSING',
        r.client.compliance.hasHealthInsurance === true ? 'Yes' : 'MISSING',
        r.client.compliance.waiverSigned ? 'Signed' : 'MISSING',
        r.client.compliance.emergencyContactPhone ? 'Yes' : 'MISSING',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

/* ==========================================================================
 * 11. SMALL FORMATTERS
 * ======================================================================== */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `'2026-08-01'` → `'Aug 1, 2026'`. No Intl, no Date — SSR-stable. */
export function formatDate(iso: IsoDate | null): string {
  if (!iso) return '—';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${MONTHS[m - 1]} ${d}, ${iso.slice(0, 4)}`;
}

/** `'2026-07-28'` → `'Jul 28'`. The dense-table variant. */
export function formatDateShort(iso: IsoDate | null): string {
  if (!iso) return '—';
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${MONTHS[m - 1]} ${d}`;
}

/** Relative staleness, in the words a coach uses. */
export function formatSince(days: number | null): string {
  if (days === null) return 'Never trained';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
