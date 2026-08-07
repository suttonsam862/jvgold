#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI: its report IS stdout. */
/**
 * ============================================================================
 * JV GOLD — SESSION BOOK IMPORTER
 * ============================================================================
 *
 * Reads the rows extracted from Jesse's live workbook
 * (`SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm`) and emits
 * `app/lib/ops/history.ts`: his real clients, sessions and payments as typed,
 * sorted, deterministic constants.
 *
 * Run:
 *   node scripts/import-sessions.mjs
 *   node scripts/import-sessions.mjs --in <sessions.json> --out <history.ts>
 *   node scripts/import-sessions.mjs --check      # fail if output would change
 *
 * ---------------------------------------------------------------------------
 * THE RULES THIS IMPORTER OBEYS
 * ---------------------------------------------------------------------------
 *
 * 1. RE-RUNNABLE AND DETERMINISTIC.
 *    No network, no `Date.now()`, no `Math.random()`, no locale-dependent
 *    formatting, no filesystem ordering. Same input bytes → same output bytes.
 *    The anchor date is the LAST session in his book, not today.
 *
 * 2. BLANK IS NOT ZERO.
 *    `-`, `` and `null` mean "he did not record this". They import as `null`.
 *    An unrecorded amount is not a free session, and an unrecorded training
 *    type is not a 1-on-1. Zero is only ever zero when he typed a zero.
 *
 * 3. HIS HISTORY IS NEVER REWRITTEN.
 *    Every drifted string ('STRENGTH', 'CASH', 'DRILL') is resolved through
 *    `app/lib/ops/vocabulary.ts` AND kept verbatim in `HISTORY_SESSION_META`.
 *    Anything the vocabulary cannot map is reported, never dropped.
 *
 * 4. THE VOCABULARY IS NOT DUPLICATED.
 *    This script imports `vocabulary.ts` and `types.ts` directly (Node 22
 *    strips the types), so the importer and the app can never drift apart.
 *
 * 5. PRIVACY.
 *    The output holds REAL client names, several of them minors. It is for the
 *    authenticated hub only. It must never be imported by a public route, a
 *    meta tag, an OG image or an analytics payload.
 */

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {addDays, centsFromDollars} from '../app/lib/ops/types.ts';
import {
  PACKAGE_TYPES,
  TRAINING_TYPES,
  PAYMENT_METHODS,
  INVENTED_VOCABULARY,
  getPackageType,
  getTrainingType,
  getPaymentMethod,
  resolvePackageType,
  resolveTrainingType,
  resolvePaymentMethod,
} from '../app/lib/ops/vocabulary.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, '..');

const DEFAULT_IN =
  '/private/tmp/claude-501/-Users-samsutton-JVGold/c505b620-5b95-4323-bd89-fab22fa6b07d/scratchpad/sessions.json';
const DEFAULT_OUT = resolve(PROJECT, 'app/lib/ops/history.ts');

/**
 * Tabs that are template leftovers, not people. They carry a fake "1st
 * session" row each. Matched on the exact sheet name.
 */
const TEMPLATE_SHEETS = new Set(['Sheet1', 'Sheet2', 'Sheet3', 'Sheet4']);

/**
 * Jesse's own May 2026 Dashboard figures, transcribed. NOT derived from the
 * session rows — they are what his spreadsheet asserts, carried through so the
 * hub can show his number and the imported number side by side.
 */
const MAY_DASHBOARD = {
  month: '2026-05',
  incomeCents: 1107500,
  expensesCents: 317000,
  netCents: 790500,
  outstandingCents: 0,
  activeClients: 5,
  coachPayCents: 100000,
  byStream: [
    {incomeStreamId: 'personal-training', cents: 420000},
    {incomeStreamId: 'deep-waters', cents: 700000},
    {incomeStreamId: 'future-champions', cents: 50000},
    {incomeStreamId: 'cbu-scholarship-stipend', cents: 217450},
    {incomeStreamId: 'merch-deep-waters-singlets', cents: 200000},
  ],
};

/**
 * Location keywords. Every value on the right is a normalisation of a literal
 * substring of Jesse's own notes — nothing here is invented, and every match is
 * recorded as `locationSource: 'note-keyword'` so it can be undone.
 * Order matters: named venues before generic rooms.
 */
const LOCATION_KEYWORDS = [
  ['great oak', 'Great Oak HS'],
  ['jw north', 'JW North HS'],
  ['riverside submission', 'Riverside Submission'],
  ['riv sub', 'Riverside Submission'],
  ['beach', 'Beach'],
  ['garage', 'Home Garage'],
  ['home', 'Home Garage'],
];

/** `SessionKind` → `PaymentCategory`, for rows sold as a single session. */
const KIND_TO_CATEGORY = {
  private: 'private',
  partner: 'partner',
  workout: 'workout',
  clinic: 'clinic',
  camp: 'camp',
  group: 'other',
};

/* ==========================================================================
 * Small pure helpers
 * ======================================================================== */

const pad2 = (n) => String(n).padStart(2, '0');

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 'PAULIE VARELA' → 'Paulie Varela'. The raw string is kept as `sourceName`. */
function titleCaseName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part,
        )
        .join('-'),
    )
    .join(' ');
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/** Dollars → integer cents, preserving `null` as `null`. Never coerces to 0. */
function centsOrNull(dollars) {
  if (dollars === null || dollars === undefined) return null;
  if (typeof dollars !== 'number' || !Number.isFinite(dollars)) return null;
  return centsFromDollars(dollars);
}

/** `'2026-06-17'` + `'06:15'` → `'2026-06-17T06:15:00'`. */
function isoDateTime(date, hhmm) {
  return `${date}T${hhmm}:00`;
}

/** Wall-clock add. Rolls the civil date with `addDays` — never a `Date`. */
function addMinutesToWallClock(at, minutes) {
  const date = at.slice(0, 10);
  const h = Number(at.slice(11, 13));
  const m = Number(at.slice(14, 16));
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  const outDate = dayShift === 0 ? date : addDays(date, dayShift);
  return `${outDate}T${pad2(Math.floor(rest / 60))}:${pad2(rest % 60)}:00`;
}

/* --------------------------------------------------------------------------
 * Clock extraction from his free-text notes.
 *
 * His notes carry the only time information in the book: '5:15:00 AM - Garage',
 * '6PM - DEEP WATERS RTC', 'Garage 8:31am', 'Tuesday garage 9am-12',
 * 'wed. 8-10am'. Both regexes REQUIRE an am/pm somewhere, so bare ordinals
 * ('1st session', '1ST AT RIV SUB SIDE') never match.
 * ------------------------------------------------------------------------ */

const RANGE_RE =
  /\b(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?\b/i;
const SINGLE_RE = /\b(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)\b/i;

/** 12-hour parts → minutes past midnight, or `null` when out of range. */
function toMinutes(hour, minute, meridiem) {
  if (hour < 1 || hour > 12) return null;
  if (minute < 0 || minute > 59) return null;
  let h = hour % 12;
  if (meridiem === 'pm') h += 12;
  return h * 60 + minute;
}

const asClock = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;

/**
 * → `{start, minutes, source}`. `source` is `'note-range'` when he wrote both
 * ends of the block, `'note-time'` when he wrote only a start, `null` when the
 * note holds no clock at all.
 */
function clockFromNote(note) {
  if (!note) return {start: null, minutes: null, source: null};

  const range = RANGE_RE.exec(note);
  if (range) {
    const [, h1, m1, ap1, h2, m2, ap2] = range;
    const mer1 = (ap1 || ap2 || '').toLowerCase();
    const mer2 = (ap2 || ap1 || '').toLowerCase();
    if (mer1 && mer2) {
      const start = toMinutes(Number(h1), Number(m1 || 0), mer1);
      let end = toMinutes(Number(h2), Number(m2 || 0), mer2);
      if (start !== null && end !== null) {
        // '9am-12' — the end inherited 'am', which puts it before the start.
        if (end <= start) end += 720;
        if (end > start && end - start <= 720) {
          return {start: asClock(start), minutes: end - start, source: 'note-range'};
        }
        return {start: asClock(start), minutes: null, source: 'note-time'};
      }
    }
  }

  const single = SINGLE_RE.exec(note);
  if (single) {
    const [, h, m, ap] = single;
    const start = toMinutes(Number(h), Number(m || 0), ap.toLowerCase());
    if (start !== null) {
      return {start: asClock(start), minutes: null, source: 'note-time'};
    }
  }

  return {start: null, minutes: null, source: null};
}

function locationFromNote(note) {
  if (!note) return null;
  const haystack = note.toLowerCase();
  for (const [needle, label] of LOCATION_KEYWORDS) {
    if (haystack.includes(needle)) return label;
  }
  return null;
}

/* ==========================================================================
 * TypeScript literal serialiser — stable, single-quoted, no dependencies.
 * ======================================================================== */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quote(str) {
  return `'${String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
}

function lit(value, depth = 0) {
  const pad = '  '.repeat(depth);
  const padIn = '  '.repeat(depth + 1);

  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') return quote(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inline = value.every(
      (v) => v === null || typeof v === 'number' || typeof v === 'string',
    );
    if (inline) {
      const parts = value.map((v) => lit(v, 0));
      const oneLine = `[${parts.join(', ')}]`;
      if (oneLine.length + pad.length <= 76) return oneLine;
    }
    const body = value.map((v) => `${padIn}${lit(v, depth + 1)},`).join('\n');
    return `[\n${body}\n${pad}]`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const body = entries
    .map(([k, v]) => {
      const key = IDENT_RE.test(k) ? k : quote(k);
      return `${padIn}${key}: ${lit(v, depth + 1)},`;
    })
    .join('\n');
  return `{\n${body}\n${pad}}`;
}

/** `export const NAME: TYPE = <literal>;` */
function decl(name, type, value, doc) {
  const head = doc ? `${doc}\n` : '';
  return `${head}export const ${name}: ${type} = ${lit(value, 0)};\n`;
}

/* ==========================================================================
 * The import
 * ======================================================================== */

function importRows(rawRows) {
  const report = {
    sourceRowCount: rawRows.length,
    skipped: [],
    aliased: [],
    unmapped: [],
    flags: [],
  };

  const seen = new Set();
  const rows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const sheet = String(raw.sheet ?? '').trim();

    if (TEMPLATE_SHEETS.has(sheet)) {
      report.skipped.push({
        sourceRow: i,
        sheet,
        reason: 'Empty workbook template tab, not a client.',
      });
      continue;
    }
    if (!sheet) {
      report.skipped.push({
        sourceRow: i,
        sheet: '',
        reason: 'Row has no sheet/client name.',
      });
      continue;
    }
    if (isBlank(raw.date)) {
      report.skipped.push({
        sourceRow: i,
        sheet,
        reason: 'Row has no date; a session with no date cannot be placed.',
      });
      continue;
    }

    const clientId = slugify(sheet);
    if (!clientId) {
      report.skipped.push({
        sourceRow: i,
        sheet,
        reason: 'Sheet name does not slugify to a usable id.',
      });
      continue;
    }

    /* --- vocabulary ---------------------------------------------------- */
    const pkg = resolvePackageType(raw.package ?? '');
    const training = resolveTrainingType(raw.trainingType ?? '');
    const method = resolvePaymentMethod(raw.method ?? '');

    for (const [vocab, res, entries] of [
      ['packageType', pkg, PACKAGE_TYPES],
      ['trainingType', training, TRAINING_TYPES],
      ['paymentMethod', method, PAYMENT_METHODS],
    ]) {
      if (res.match === 'unknown') {
        report.unmapped.push({sourceRow: i, sheet, vocabulary: vocab, raw: res.raw});
        continue;
      }
      if (!res.id) continue;
      const canonical = entries.find((e) => e.id === res.id);
      if (canonical && res.raw !== canonical.label) {
        const key = `${vocab}::${res.raw}`;
        if (!seen.has(key)) {
          seen.add(key);
          report.aliased.push({
            vocabulary: vocab,
            raw: res.raw,
            canonicalId: res.id,
            canonicalLabel: canonical.label,
            match: res.match,
          });
        }
      }
    }

    const packageType = getPackageType(pkg.id);
    const trainingType = getTrainingType(training.id);
    const methodOption = getPaymentMethod(method.id);

    /* --- money --------------------------------------------------------- */
    const paidCents = centsOrNull(raw.paid);
    const owedCents = centsOrNull(raw.owed);

    /* --- clock and place ----------------------------------------------- */
    const note = typeof raw.notes === 'string' ? raw.notes : '';
    const clock = clockFromNote(note);

    let minutes = clock.minutes;
    let durationSource = 'note-range';
    if (minutes === null) {
      if (trainingType) {
        minutes = trainingType.defaultDurationMins;
        durationSource = 'training-type-default';
      } else {
        minutes = 60;
        durationSource = 'fallback-60';
      }
    }

    const start = isoDateTime(raw.date, clock.start ?? '00:00');
    const location = locationFromNote(note);

    /* --- what the row actually evidences -------------------------------- */
    const used = typeof raw.used === 'number' ? raw.used : null;
    const logged =
      note.trim() !== '' ||
      paidCents !== null ||
      training.match !== 'blank' ||
      (used !== null && used > 0);

    rows.push({
      sourceRow: i,
      sheet,
      clientId,
      sourceName: String(raw.client ?? sheet),
      clubRaw: String(raw.family ?? '').trim(),
      guardian: isBlank(raw.contact) ? null : String(raw.contact).trim(),
      phone: isBlank(raw.phone) ? null : String(raw.phone).trim(),
      date: String(raw.date),
      start,
      minutes,
      durationSource,
      startTimeRecorded: clock.start !== null,
      location,
      note,
      used,
      paidCents,
      owedCents,
      logged,
      pkg,
      training,
      method,
      packageType,
      trainingType,
      methodOption,
    });
  }

  /* --- deterministic ids ------------------------------------------------ */
  rows.sort((a, b) =>
    a.clientId !== b.clientId
      ? a.clientId < b.clientId
        ? -1
        : 1
      : a.date !== b.date
        ? a.date < b.date
          ? -1
          : 1
        : a.sourceRow - b.sourceRow,
  );

  const perDay = new Map();
  for (const row of rows) {
    const key = `${row.clientId}|${row.date}`;
    const n = (perDay.get(key) ?? 0) + 1;
    perDay.set(key, n);
    row.id = `s-${row.clientId}-${row.date}-${pad2(n)}`;
    row.paymentId = `pay-${row.clientId}-${row.date}-${pad2(n)}`;
  }

  return {rows, report};
}

/* --------------------------------------------------------------------------
 * Row → domain records
 * ------------------------------------------------------------------------ */

function buildSessions(rows) {
  return rows
    .map((row) => ({
      id: row.id,
      start: row.start,
      end: addMinutesToWallClock(row.start, row.minutes),
      minutes: row.minutes,
      kind: row.trainingType ? row.trainingType.sessionKind : null,
      offeringId: row.trainingType ? row.trainingType.offeringId : null,
      athleteIds: [row.clientId],
      location: row.location ?? '',
      focus: '',
      amountCents: row.paidCents,
      paid: row.paidCents !== null,
      paidDate: row.paidCents !== null ? row.date : null,
      method: row.methodOption ? row.methodOption.domainMethod : null,
      notes: row.note,
      status: row.logged ? 'completed' : 'scheduled',
      sessionsUsed: row.used ?? 0,
    }))
    .sort((a, b) => (a.start === b.start ? (a.id < b.id ? -1 : 1) : a.start < b.start ? -1 : 1));
}

function buildSessionMeta(rows) {
  const out = {};
  for (const row of rows) {
    out[row.id] = {
      sourceSheet: row.sheet,
      sourceRow: row.sourceRow,
      clientId: row.clientId,
      packageTypeId: row.pkg.id,
      rawPackageType: row.pkg.raw,
      packageMatch: row.pkg.match,
      trainingTypeId: row.training.id,
      rawTrainingType: row.training.raw,
      trainingMatch: row.training.match,
      paymentMethodId: row.method.id,
      rawPaymentMethod: row.method.raw,
      paymentMatch: row.method.match,
      paidCents: row.paidCents,
      owedCents: row.owedCents,
      sessionsUsedRaw: row.used,
      startTimeRecorded: row.startTimeRecorded,
      durationSource: row.durationSource,
      locationSource: row.location === null ? null : 'note-keyword',
      logged: row.logged,
      clubAffiliationRaw: row.clubRaw,
    };
  }
  return out;
}

function buildPayments(rows) {
  return rows
    .filter((row) => row.paidCents !== null)
    .map((row) => {
      const kindCategory = row.trainingType
        ? KIND_TO_CATEGORY[row.trainingType.sessionKind]
        : null;
      const packageCategory = row.packageType
        ? row.packageType.paymentCategory
        : 'other';
      const category =
        packageCategory === 'package'
          ? 'package'
          : (kindCategory ?? packageCategory);

      const trainingLabel = row.trainingType
        ? row.trainingType.label
        : row.training.raw.trim() || 'Training type not recorded';
      const packageLabel = row.packageType
        ? row.packageType.label
        : row.pkg.raw.trim() || 'Package not recorded';

      return {
        id: row.paymentId,
        date: row.date,
        clientId: row.clientId,
        sessionId: row.id,
        offeringId:
          (row.trainingType && row.trainingType.offeringId) ||
          (row.packageType && row.packageType.offeringId) ||
          null,
        category,
        amountCents: row.paidCents,
        refundedCents: 0,
        feeCents: 0,
        netCents: row.paidCents,
        currency: 'USD',
        method: row.methodOption ? row.methodOption.domainMethod : 'Other',
        source: row.methodOption ? row.methodOption.revenueSource : 'other',
        status: 'paid',
        description: `${packageLabel} · ${trainingLabel}`,
        shopifyOrderId: null,
        shopifyOrderName: null,
      };
    })
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
}

function buildClients(rows, report) {
  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.clientId)) byClient.set(row.clientId, []);
    byClient.get(row.clientId).push(row);
  }

  const ids = [...byClient.keys()].sort();

  return ids.map((clientId, index) => {
    const own = byClient.get(clientId);
    const dates = own.map((r) => r.date).sort();
    const lifetimeValueCents = own.reduce((sum, r) => sum + (r.paidCents ?? 0), 0);
    const balanceCents = own.reduce((sum, r) => sum + (r.owedCents ?? 0), 0);

    const packageIds = [...new Set(own.map((r) => r.pkg.id).filter(Boolean))];
    if (packageIds.length > 1) {
      report.flags.push({
        code: 'multiple-package-types',
        severity: 'info',
        message: `${clientId} has more than one package type in his book (${packageIds.join(', ')}); the most recent is on the client record and every row keeps its own in HISTORY_SESSION_META.`,
      });
    }
    const latestPackage = [...own].reverse().find((r) => r.pkg.id) ?? null;
    const packageType = latestPackage ? latestPackage.packageType : null;
    const counted =
      packageType &&
      (packageType.id === '12-session-package' ||
        packageType.id === '20-session-package');
    const usedTotal = own.reduce((sum, r) => sum + (r.used ?? 0), 0);
    const purchased = counted ? packageType.defaultSessions : null;

    const clubRaw =
      [...new Set(own.map((r) => r.clubRaw).filter((c) => c !== ''))].join(' / ') ||
      null;
    const guardian = own.map((r) => r.guardian).find((g) => g) ?? null;
    const phone = own.map((r) => r.phone).find((p) => p) ?? null;

    return {
      id: clientId,
      name: titleCaseName(own[0].sourceName),
      accountLabel: titleCaseName(own[0].sourceName),
      guardian,
      email: null,
      phone,
      level: null,
      school: null,
      dateOfBirth: null,
      status: balanceCents > 0 ? 'Owes Balance' : 'Active',
      familyGroup: null,
      packages: {
        name: packageType ? packageType.label : null,
        priceCents: null,
        purchased,
        used: usedTotal,
        remaining: purchased === null ? null : purchased - usedTotal,
        offeringId: packageType ? packageType.offeringId : null,
      },
      compliance: {
        usawCardNumber: null,
        hasHealthInsurance: null,
        insuranceProvider: null,
        insurancePolicyNumber: null,
        emergencyContactName: guardian,
        emergencyContactPhone: phone,
        waiverSigned: false,
      },
      tags: [],
      joinedAt: dates[0],
      lastSessionAt: dates[dates.length - 1],
      lifetimeValueCents,
      balanceCents,
      source: 'import',
      rateCents: null,
      colorIndex: index % 8,
      notes: null,
      shopifyCustomerId: null,
      sourceSheet: own[0].sheet,
      sourceName: own[0].sourceName,
      packageTypeId: packageType ? packageType.id : null,
      clubAffiliationRaw: clubRaw,
      sessionCount: own.length,
      loggedSessionCount: own.filter((r) => r.logged).length,
      paymentCount: own.filter((r) => r.paidCents !== null).length,
    };
  });
}

/* ==========================================================================
 * Reconciliation
 * ======================================================================== */

function reconcile(clients, payments, report) {
  const totalCents = payments.reduce((s, p) => s + p.amountCents, 0);
  const byMonth = {};
  for (const p of payments) {
    const key = p.date.slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + p.amountCents;
  }
  const mayCents = byMonth[MAY_DASHBOARD.month] ?? 0;
  const dashboardStreamSum = MAY_DASHBOARD.byStream.reduce(
    (s, r) => s + r.cents,
    0,
  );
  const outstandingCents = clients.reduce((s, c) => s + c.balanceCents, 0);
  const personalTraining = MAY_DASHBOARD.byStream.find(
    (s) => s.incomeStreamId === 'personal-training',
  ).cents;

  const lines = [
    {
      id: 'may-vs-personal-training',
      label: 'May session log vs Dashboard "Personal Training"',
      importedCents: mayCents,
      dashboardCents: personalTraining,
      deltaCents: mayCents - personalTraining,
      note: 'The session log is the only source for personal-training revenue, so these should agree. They do not.',
      resolved: mayCents === personalTraining,
    },
    {
      id: 'may-vs-total-income',
      label: 'May session log vs Dashboard total income',
      importedCents: mayCents,
      dashboardCents: MAY_DASHBOARD.incomeCents,
      deltaCents: mayCents - MAY_DASHBOARD.incomeCents,
      note: 'Expected to differ: club dues, camps, the CBU stipend and merch are never entered as session rows. The gap is not evidence of an error.',
      resolved: false,
    },
    {
      id: 'dashboard-internal',
      label: 'Dashboard income vs Dashboard income-by-stream',
      importedCents: dashboardStreamSum,
      dashboardCents: MAY_DASHBOARD.incomeCents,
      deltaCents: dashboardStreamSum - MAY_DASHBOARD.incomeCents,
      note: 'His own sheet disagrees with itself. Both figures are carried; neither has been picked as the truth.',
      resolved: false,
    },
    {
      id: 'outstanding',
      label: 'Owed column vs Dashboard outstanding',
      importedCents: outstandingCents,
      dashboardCents: MAY_DASHBOARD.outstandingCents,
      deltaCents: outstandingCents - MAY_DASHBOARD.outstandingCents,
      note: 'His Owed column carries a balance the Dashboard reports as zero.',
      resolved: outstandingCents === MAY_DASHBOARD.outstandingCents,
    },
    {
      id: 'active-clients',
      label: 'Client tabs vs Dashboard active clients',
      importedCents: null,
      dashboardCents: null,
      deltaCents: null,
      note: `${clients.length} real client tabs in the book; the Dashboard says ${MAY_DASHBOARD.activeClients} active. ${clients.filter((c) => c.status === 'Active').length} import as Active and ${clients.filter((c) => c.status === 'Owes Balance').length} as Owes Balance, which may be the whole explanation — confirm with Jesse.`,
      resolved: false,
    },
  ];

  for (const line of lines) {
    if (!line.resolved && line.id !== 'may-vs-total-income') {
      report.flags.push({
        code: line.id,
        severity: line.id === 'active-clients' ? 'info' : 'warning',
        message: line.note,
      });
    }
  }

  return {totalCents, byMonth, mayCents, dashboardStreamSum, outstandingCents, lines};
}

/* ==========================================================================
 * Emit
 * ======================================================================== */

function emit({clients, sessions, sessionMeta, payments, recon, report, range}) {
  const header = `/**
 * ============================================================================
 * JV GOLD — JESSE'S REAL BOOK, IMPORTED
 * ============================================================================
 *
 * GENERATED FILE. Do not hand-edit.
 *   Regenerate:  node scripts/import-sessions.mjs
 *   Source:      SESSION TRACK JVGOLD PRIVATE TRAINING.xlsm (one tab per client)
 *   Importer:    scripts/import-sessions.mjs
 *   Vocabulary:  ~/lib/ops/vocabulary
 *
 * ---------------------------------------------------------------------------
 * PRIVACY — READ BEFORE IMPORTING THIS MODULE
 * ---------------------------------------------------------------------------
 * These are REAL clients of Jesse's, and several of them are MINORS. This file
 * is for authenticated hub routes only, behind row-level security. Nothing in
 * it may reach a public route, a <meta> tag, an OG image, a sitemap, a log line
 * or an analytics payload. It is the opposite of \`~/lib/ops/seed\`, which is
 * de-identified precisely so it can be shown to anyone.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE BOOK DOES NOT CONTAIN
 * ---------------------------------------------------------------------------
 * His workbook has no column for competitive level, date of birth, email,
 * school, waiver status, session focus, or the value of an unpaid session.
 * Those import as \`null\` / \`''\` / \`false\`, never as a guess. Two domain
 * fields had to be widened to say so honestly, which is why this file exports
 * \`HistoryClient\` and \`HistorySession\` rather than \`Client\` and
 * \`TrainingSession\`:
 *
 *   - \`HistoryClient.level\`        \`ClientLevel | null\`  (never recorded)
 *   - \`HistorySession.kind\`        \`SessionKind | null\`  (blank Training Type)
 *   - \`HistorySession.amountCents\` \`number | null\`       (unpriced ≠ free)
 *
 * Use \`toTrainingSession()\` at the point where a component genuinely needs the
 * strict type; it makes you name the fallback out loud.
 *
 * ---------------------------------------------------------------------------
 * BLANK IS NOT ZERO
 * ---------------------------------------------------------------------------
 * \`-\` and empty cells import as \`null\`. A session with \`amountCents: null\`
 * is one he never priced. A session with \`amountCents: 0\` would be one he
 * comped. Do not \`?? 0\` these on the way into a total without saying so in the
 * caption.
 *
 * ---------------------------------------------------------------------------
 * HIS NUMBERS DO NOT ALL AGREE
 * ---------------------------------------------------------------------------
 * See \`HISTORY_RECONCILIATION\`. His May Dashboard, his income-by-stream rows
 * and his session log disagree with each other. Nothing here picks a winner —
 * every figure is carried with its source so a screen can show both and label
 * the gap.
 */

import type {
  ClientLevel,
  Client,
  IsoDate,
  Payment,
  PaymentCategory,
  SessionKind,
  SessionId,
  TrainingSession,
} from './types';
import type {
  IncomeStreamId,
  PackageTypeId,
  PaymentMethodId,
  ResolutionMatch,
  TrainingTypeId,
} from './vocabulary';

/* ==========================================================================
 * TYPES
 * ======================================================================== */

/**
 * A \`Client\` as his book can actually support it, plus the provenance needed
 * to trace any figure back to a tab.
 */
export interface HistoryClient extends Omit<Client, 'level'> {
  /** \`null\` — his book has no competitive-level column. Never guessed. */
  level: ClientLevel | null;
  /** The workbook tab this came from, verbatim. */
  sourceSheet: string;
  /** His exact spelling/casing of the name, before display title-casing. */
  sourceName: string;
  packageTypeId: PackageTypeId | null;
  /**
   * His "Family" column, verbatim — which records CLUB affiliation
   * ("Deep Waters RTC", 'Norco / Future Champions "CHAMP CLUB"'), not a billing
   * household. \`familyGroup\` is therefore \`null\` for everyone: nothing in the
   * book says which athletes share a bill. Do not infer it from surnames.
   */
  clubAffiliationRaw: string | null;
  /** Rows on this tab, including unlogged ones. */
  sessionCount: number;
  /** Rows carrying real evidence (a note, a payment, a type, or a used count). */
  loggedSessionCount: number;
  paymentCount: number;
}

/** A \`TrainingSession\` with the two fields his book leaves unknowable. */
export interface HistorySession
  extends Omit<TrainingSession, 'kind' | 'amountCents'> {
  /** \`null\` when the Training Type cell was blank. Not a default. */
  kind: SessionKind | null;
  /** What he COLLECTED on this row, in cents. \`null\` = never priced. */
  amountCents: number | null;
}

/** Where a session's duration came from. */
export type DurationSource =
  | 'note-range'
  | 'training-type-default'
  | 'fallback-60';

/** Everything the domain types have no room for. Keyed by session id. */
export interface HistorySessionMeta {
  sourceSheet: string;
  /** 0-based index in the extracted row list. Stable across re-imports. */
  sourceRow: number;
  clientId: string;
  packageTypeId: PackageTypeId | null;
  /** His cell contents, verbatim. */
  rawPackageType: string;
  packageMatch: ResolutionMatch;
  trainingTypeId: TrainingTypeId | null;
  rawTrainingType: string;
  trainingMatch: ResolutionMatch;
  paymentMethodId: PaymentMethodId | null;
  rawPaymentMethod: string;
  paymentMatch: ResolutionMatch;
  paidCents: number | null;
  /** His Owed column. \`null\` = blank, \`0\` = he typed a zero. */
  owedCents: number | null;
  /** His "Sessions Used" cell: \`1\`, \`0\`, or \`null\` for blank. */
  sessionsUsedRaw: number | null;
  /**
   * \`false\` when no clock could be read out of his note. The session's
   * \`start\` is then \`T00:00:00\` — render "time not recorded", NOT "12:00 AM".
   */
  startTimeRecorded: boolean;
  durationSource: DurationSource;
  /** \`'note-keyword'\` when the location was recognised in his note. */
  locationSource: 'note-keyword' | null;
  /** \`false\` for a pre-filled date row with nothing on it. */
  logged: boolean;
  clubAffiliationRaw: string;
}

export interface HistoryDateRange {
  first: IsoDate;
  last: IsoDate;
}

/** One row of his Dashboard's income-by-stream table. */
export interface DashboardStreamFigure {
  incomeStreamId: IncomeStreamId;
  cents: number;
}

/** His May Dashboard, transcribed. NOT derived from the session rows. */
export interface DashboardMonth {
  month: string;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
  outstandingCents: number;
  activeClients: number;
  coachPayCents: number;
  byStream: DashboardStreamFigure[];
}

/** One disagreement between the imported book and his own reporting. */
export interface ReconciliationLine {
  id: string;
  label: string;
  /** Cents derived from the imported rows. \`null\` when not a money line. */
  importedCents: number | null;
  /** Cents as his Dashboard states them. \`null\` when not a money line. */
  dashboardCents: number | null;
  deltaCents: number | null;
  note: string;
  /** \`true\` only when the two sides actually agree. */
  resolved: boolean;
}

export interface VocabularyAlias {
  vocabulary: string;
  /** His string, verbatim. */
  raw: string;
  canonicalId: string;
  canonicalLabel: string;
  match: ResolutionMatch;
}

export interface SkippedRow {
  sourceRow: number;
  sheet: string;
  reason: string;
}

export interface UnmappedValue {
  sourceRow: number;
  sheet: string;
  vocabulary: string;
  raw: string;
}

export interface ImportFlag {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface ImportReport {
  sourceRowCount: number;
  importedRowCount: number;
  clientCount: number;
  paymentCount: number;
  paymentTotalCents: number;
  paymentTotalByMonth: Record<string, number>;
  outstandingCents: number;
  dateRange: HistoryDateRange;
  perClient: {
    clientId: string;
    name: string;
    sessions: number;
    logged: number;
    payments: number;
    paidCents: number;
    owedCents: number;
  }[];
  /** Template tabs and unusable rows. Nothing real is in here. */
  skipped: SkippedRow[];
  /** Every drifted string that was folded onto a canonical id. */
  aliased: VocabularyAlias[];
  /** Canonical entries added because his Lists sheet had no home for a value. */
  invented: {vocabulary: string; id: string; label: string; reason: string}[];
  /** Real values nobody has mapped. Empty is the goal; non-empty needs a human. */
  unmapped: UnmappedValue[];
  flags: ImportFlag[];
}
`;

  const perClient = clients.map((c) => ({
    clientId: c.id,
    name: c.name,
    sessions: c.sessionCount,
    logged: c.loggedSessionCount,
    payments: c.paymentCount,
    paidCents: c.lifetimeValueCents,
    owedCents: c.balanceCents,
  }));

  const fullReport = {
    sourceRowCount: report.sourceRowCount,
    importedRowCount: sessions.length,
    clientCount: clients.length,
    paymentCount: payments.length,
    paymentTotalCents: recon.totalCents,
    paymentTotalByMonth: recon.byMonth,
    outstandingCents: recon.outstandingCents,
    dateRange: range,
    perClient,
    skipped: report.skipped,
    aliased: [...report.aliased].sort((a, b) =>
      `${a.vocabulary}${a.raw}` < `${b.vocabulary}${b.raw}` ? -1 : 1,
    ),
    invented: INVENTED_VOCABULARY.map((v) => ({
      vocabulary: v.vocabulary,
      id: v.id,
      label: v.label,
      reason: v.reason,
    })),
    unmapped: report.unmapped,
    flags: report.flags,
  };

  const body = [
    header,
    `/* ==========================================================================
 * DATA
 * ======================================================================== */
`,
    decl(
      'HISTORY_ANCHOR_DATE',
      'IsoDate',
      range.last,
      `/**
 * The date this dataset is anchored to: the LAST session in his book, not
 * today. Any "days since" figure must be computed against this, so the hub
 * renders identically on the server and in the browser.
 */`,
    ),
    '',
    decl(
      'HISTORY_DATE_RANGE',
      'HistoryDateRange',
      range,
      '/** First and last dated row in the book. */',
    ),
    '',
    decl(
      'HISTORY_CLIENTS',
      'readonly HistoryClient[]',
      clients,
      `/**
 * His six real clients, sorted by id. \`status\` is DERIVED, not recorded: a
 * client with a positive Owed balance is 'Owes Balance', everyone else is
 * 'Active'. Nobody is marked 'Inactive' or 'Trial' — his book does not say so
 * and a lapsed athlete is not something to infer.
 */`,
    ),
    '',
    decl(
      'HISTORY_SESSIONS',
      'readonly HistorySession[]',
      sessions,
      `/**
 * Every dated row, sorted by start then id. \`status\` is 'completed' when the
 * row carries evidence (a note, a payment, a training type, or a used count)
 * and 'scheduled' when he pre-filled a date and nothing else. \`focus\` is
 * always \`''\` — his book has one free-text Notes column and it is preserved
 * verbatim in \`notes\`.
 */`,
    ),
    '',
    decl(
      'HISTORY_SESSION_META',
      'Readonly<Record<SessionId, HistorySessionMeta>>',
      sessionMeta,
      `/**
 * Provenance for every session: his verbatim cell contents, how each one
 * resolved, and which values were inferred. Read this before trusting a start
 * time or a duration.
 */`,
    ),
    '',
    decl(
      'HISTORY_PAYMENTS',
      'readonly Payment[]',
      payments,
      `/**
 * One payment per row where he recorded money, sorted by date then id. Rows
 * with \`-\` or a blank Paid cell produce NO payment — they are unrecorded, not
 * zero.
 */`,
    ),
    '',
    decl(
      'HISTORY_MAY_DASHBOARD',
      'DashboardMonth',
      MAY_DASHBOARD,
      `/**
 * His own May 2026 Dashboard, transcribed verbatim into cents. NOTHING here is
 * derived from the session rows — this is what his spreadsheet claims, carried
 * so a screen can show his number next to the imported one. Note that
 * \`byStream\` sums to $15,874.50 while \`incomeCents\` says $11,075.
 */`,
    ),
    '',
    decl(
      'HISTORY_RECONCILIATION',
      'readonly ReconciliationLine[]',
      recon.lines,
      `/**
 * Where the imported book and his own reporting disagree. Render these; do not
 * resolve them. Only a line with \`resolved: true\` actually ties out.
 */`,
    ),
    '',
    decl(
      'HISTORY_IMPORT_REPORT',
      'ImportReport',
      fullReport,
      '/** What the importer did, in full. Drives the data-provenance panel. */',
    ),
    `
/* ==========================================================================
 * HELPERS
 * ======================================================================== */

/**
 * Narrow a \`HistorySession\` to the strict \`TrainingSession\` some components
 * require. You must name the fallbacks, because the book does not know them —
 * that is the point. \`fallbackKind\` fills a blank Training Type;
 * \`fallbackAmountCents\` fills a session he never priced.
 */
export function toTrainingSession(
  session: HistorySession,
  fallbackKind: SessionKind,
  fallbackAmountCents: number,
): TrainingSession {
  return {
    ...session,
    kind: session.kind ?? fallbackKind,
    amountCents: session.amountCents ?? fallbackAmountCents,
  };
}

/** All sessions for one client, already in start order. */
export function historySessionsFor(clientId: string): readonly HistorySession[] {
  return HISTORY_SESSIONS.filter((s) => s.athleteIds.includes(clientId));
}

/** All payments for one client, already in date order. */
export function historyPaymentsFor(clientId: string): readonly Payment[] {
  return HISTORY_PAYMENTS.filter((p) => p.clientId === clientId);
}

/** The provenance record behind a session, or \`null\` if the id is unknown. */
export function historyMetaFor(
  sessionId: SessionId,
): HistorySessionMeta | null {
  return HISTORY_SESSION_META[sessionId] ?? null;
}

/**
 * Payment gross for a month key (\`'2026-05'\`), in cents. Returns 0 for a month
 * with no recorded payments — which is not the same as a month he did not work.
 */
export function historyGrossForMonth(month: string): number {
  return HISTORY_PAYMENTS.filter((p) => p.date.slice(0, 7) === month).reduce(
    (sum, p) => sum + p.amountCents,
    0,
  );
}

/** Payment categories present in the book, in a stable order. */
export const HISTORY_PAYMENT_CATEGORIES: readonly PaymentCategory[] = [
  ...new Set(HISTORY_PAYMENTS.map((p) => p.category)),
].sort();
`,
  ].join('\n');

  return body;
}

/* ==========================================================================
 * main
 * ======================================================================== */

function parseArgs(argv) {
  const args = {in: DEFAULT_IN, out: DEFAULT_OUT, check: false};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = resolve(argv[++i]);
    else if (argv[i] === '--out') args.out = resolve(argv[++i]);
    else if (argv[i] === '--check') args.check = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.in)) {
    console.error(`import-sessions: input not found: ${args.in}`);
    process.exit(1);
  }

  const rawRows = JSON.parse(readFileSync(args.in, 'utf8'));
  if (!Array.isArray(rawRows)) {
    console.error('import-sessions: expected a JSON array of session rows.');
    process.exit(1);
  }

  const {rows, report} = importRows(rawRows);
  if (rows.length === 0) {
    console.error('import-sessions: no importable rows. Refusing to write.');
    process.exit(1);
  }

  const clients = buildClients(rows, report);
  const sessions = buildSessions(rows);
  const sessionMeta = buildSessionMeta(rows);
  const payments = buildPayments(rows);

  const dates = rows.map((r) => r.date).sort();
  const range = {first: dates[0], last: dates[dates.length - 1]};

  const recon = reconcile(clients, payments, report);

  if (report.unmapped.length > 0) {
    report.flags.push({
      code: 'unmapped-vocabulary',
      severity: 'error',
      message: `${report.unmapped.length} cell(s) hold a value the vocabulary cannot map. They were kept verbatim on the row and nothing was guessed. Add them to app/lib/ops/vocabulary.ts.`,
    });
  }

  const out = emit({
    clients,
    sessions,
    sessionMeta,
    payments,
    recon,
    report,
    range,
  });

  const previous = existsSync(args.out) ? readFileSync(args.out, 'utf8') : null;
  const changed = previous !== out;

  if (args.check) {
    console.log(changed ? 'CHANGED' : 'UP TO DATE');
    process.exit(changed ? 1 : 0);
  }

  writeFileSync(args.out, out, 'utf8');

  /* --- console report ------------------------------------------------- */
  const usd = (c) => `$${(c / 100).toFixed(2)}`;
  const L = [];
  L.push('');
  L.push('  JV GOLD — SESSION IMPORT');
  L.push('  ' + '-'.repeat(66));
  L.push(`  source rows        ${report.sourceRowCount}`);
  L.push(`  imported sessions  ${sessions.length}`);
  L.push(`  skipped rows       ${report.skipped.length}`);
  L.push(`  clients            ${clients.length}`);
  L.push(`  date range         ${range.first} → ${range.last}`);
  L.push(
    `  payments           ${payments.length} · ${usd(recon.totalCents)} (${recon.totalCents} cents)`,
  );
  L.push(`  outstanding        ${usd(recon.outstandingCents)}`);
  L.push('');
  L.push('  PER CLIENT');
  for (const c of clients) {
    L.push(
      `    ${c.name.padEnd(22)} ${String(c.sessionCount).padStart(3)} rows ` +
        `(${c.loggedSessionCount} logged) · ${usd(c.lifetimeValueCents).padStart(10)} paid` +
        (c.balanceCents ? ` · ${usd(c.balanceCents)} owed` : ''),
    );
  }
  L.push('');
  L.push('  BY MONTH');
  for (const key of Object.keys(recon.byMonth).sort()) {
    L.push(`    ${key}  ${usd(recon.byMonth[key])}`);
  }
  L.push('');
  L.push('  VOCABULARY DRIFT FOLDED IN');
  if (report.aliased.length === 0) L.push('    (none)');
  for (const a of report.aliased) {
    L.push(`    ${a.vocabulary}: ${quote(a.raw)} → ${a.canonicalId} (${a.canonicalLabel})`);
  }
  L.push('');
  L.push('  CANONICAL ENTRIES INVENTED (not on his Lists sheet)');
  for (const v of INVENTED_VOCABULARY) {
    L.push(`    ${v.vocabulary}: ${v.id} — ${v.label}`);
  }
  L.push('');
  L.push('  UNMAPPED VALUES');
  if (report.unmapped.length === 0) L.push('    (none — every real value found a home)');
  for (const u of report.unmapped) {
    L.push(`    row ${u.sourceRow} ${u.sheet} · ${u.vocabulary} = ${quote(u.raw)}`);
  }
  L.push('');
  L.push('  SKIPPED');
  for (const s of report.skipped) {
    L.push(`    row ${s.sourceRow} ${s.sheet} — ${s.reason}`);
  }
  L.push('');
  L.push('  RECONCILIATION vs HIS MAY DASHBOARD');
  for (const line of recon.lines) {
    const money =
      line.importedCents === null
        ? ''
        : `imported ${usd(line.importedCents)} vs dashboard ${usd(line.dashboardCents)} · delta ${usd(line.deltaCents)}`;
    L.push(`    [${line.resolved ? ' ties out ' : 'DOES NOT '}] ${line.label}`);
    if (money) L.push(`               ${money}`);
  }
  L.push('');
  L.push(`  wrote ${args.out}${changed ? '' : ' (unchanged)'}`);
  L.push('');
  console.log(L.join('\n'));
}

main();
/* eslint-enable no-console */
