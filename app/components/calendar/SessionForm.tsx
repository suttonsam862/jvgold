/**
 * ============================================================================
 * SESSION FORM — log a session with taps, not typing
 * ============================================================================
 *
 * This is his spreadsheet row, rebuilt as a phone form. The target is explicit
 * and testable: A NORMAL SESSION IS LOGGABLE WITHOUT THE KEYBOARD EVER
 * APPEARING. Client, training type, package, method, stream, sessions used,
 * date, time, duration and amount are all taps. `Notes` is the single free-text
 * control, it sits last, and it has a chip row in front of it.
 *
 * ORDER OF THE FORM = ORDER OF THE DECISION
 * -----------------------------------------
 *   1. Who    — the picker, because it prefills everything below it
 *   2. What   — training type, then package
 *   3. When   — date chips, time-slot chips, length
 *   4. Money  — paid, method, owed, stream
 *   5. Notes  — chips first, keyboard last
 *
 * Choosing a client in step 1 pulls their usual package, rate, method and
 * training type out of their own history, so the common case is: tap the name,
 * tap the day, submit. Nothing is autofocused on open — an autofocused text
 * field would raise the keyboard over the whole form, which is the exact thing
 * this screen is built to avoid.
 */

import {memo, useCallback, useId, useMemo, useRef, useState} from 'react';
import {Link, useFetcher} from 'react-router';
import type {IsoDate} from '~/lib/ops/types';
import {addDays} from '~/lib/ops/types';
import {
  INCOME_STREAMS,
  PACKAGE_TYPES,
  PAYMENT_METHODS,
  TRAINING_TYPES,
  getPackageType,
  getTrainingType,
} from '~/lib/ops/vocabulary';
import type {
  IncomeStreamId,
  PackageTypeId,
  PaymentMethodId,
  TrainingTypeId,
} from '~/lib/ops/vocabulary';
import {ChipGroup, MoneyField, Stepper, ToggleChips} from './Controls';
import type {ChipOption} from './Controls';
import {SettlementGroup} from './Settlement';
import {formatMinutes} from './layout';
import type {
  CalendarFormData,
  RosterClient,
  SessionDraft,
  SettlementId,
} from './sessionModel';
import {
  applyPackageType,
  applyPrefill,
  applySettlement,
  applyTrainingType,
  centsLabel,
  checkDraftSlot,
  chipDate,
  durationLabel,
  noteHasChip,
  normaliseSettlement,
  prepaidAfter,
  slotBlocksSave,
  slotWording,
  summaryOfDraft,
  toggleNoteChip,
} from './sessionModel';

/**
 * Above this many clients the picker grows a filter box. Below it, showing the
 * whole roster is faster AND keyboard-free — which is the point of the screen.
 * Jesse currently has six athletes in the book; the filter is here for the day
 * he has sixty.
 */
const FILTER_THRESHOLD = 8;

/** Sentinel chip id for "he never wrote a time down". */
const NO_TIME = 'no-time';

/* ==========================================================================
 * CLIENT PICKER
 *
 * A picker over the roster, never a text field. Typing FILTERS; it can never
 * create a name. That is the difference between a roster and a list of
 * spellings — his book already holds 'GAGE KOTARO' next to 'Kade Kean' because
 * the name column was free text.
 * ======================================================================== */

interface ClientPickerProps {
  clients: RosterClient[];
  value: string | null;
  onChange: (id: string) => void;
  summaryFor: (id: string) => string | undefined;
  describedBy?: string;
  invalid?: boolean;
}

const ClientPicker = memo(function ClientPicker({
  clients,
  value,
  onChange,
  summaryFor,
  describedBy,
  invalid,
}: ClientPickerProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(needle));
  }, [clients, query]);

  /** Arrows move selection and focus together. Handler on the radios, not the
      group — the group must stay unfocusable for the roving tabindex to work. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const step =
        e.key === 'ArrowDown' || e.key === 'ArrowRight'
          ? 1
          : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
            ? -1
            : 0;
      if (step === 0 || filtered.length === 0) return;
      e.preventDefault();
      const next = filtered[(index + step + filtered.length) % filtered.length];
      if (!next) return;
      onChange(next.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-person="${next.id}"]`)
        ?.focus();
    },
    [filtered, onChange],
  );

  return (
    <div className="cal-group">
      <span className="cal-label" id={`${id}-label`}>
        Client
      </span>

      {clients.length > FILTER_THRESHOLD ? (
        <div className="cal-money">
          <label className="cal-money-prefix" htmlFor={`${id}-filter`}>
            <span className="sr-only">Filter the roster by name</span>
            <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
              <circle
                cx="5.5"
                cy="5.5"
                r="4.2"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <path d="M8.7 8.7L12 12" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </label>
          <input
            id={`${id}-filter`}
            className="cal-money-input"
            type="search"
            autoComplete="off"
            placeholder="Filter names"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      ) : null}

      <div
        ref={listRef}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="cal-roster"
        data-invalid={invalid || undefined}
      >
        {filtered.map((client, i) => {
          const selected = client.id === value;
          return (
            <button
              key={client.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-person={client.id}
              // The sheet focuses this on open: the first decision on the
              // form, and a button rather than a text field, so the keyboard
              // stays down.
              data-autofocus={selected || (!value && i === 0) ? '' : undefined}
              tabIndex={selected || (!value && i === 0) ? 0 : -1}
              className="cal-person"
              onClick={() => onChange(client.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="cal-person-mark" aria-hidden="true">
                {client.initials}
              </span>
              <span className="cal-person-body">
                <span className="cal-person-name">{client.name}</span>
                <span className="cal-person-meta">
                  {summaryFor(client.id) ?? client.status}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="cal-foot">
          Nobody on the roster matches that. Names come from the roster only —
          this form cannot create one.
        </p>
      ) : null}
    </div>
  );
});

/* ==========================================================================
 * WHEN — date, start time, length
 * ======================================================================== */

interface WhenProps {
  draft: SessionDraft;
  todayDate: IsoDate;
  /** The day currently selected on the grid behind the sheet. */
  focusedDate: IsoDate;
  data: CalendarFormData;
  onDate: (date: IsoDate) => void;
  onStart: (minutes: number | null) => void;
  onDuration: (minutes: number) => void;
}

const WhenFields = memo(function WhenFields({
  draft,
  todayDate,
  focusedDate,
  data,
  onDate,
  onStart,
  onDuration,
}: WhenProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [band, setBand] = useState<string>(() =>
    bandForMinutes(draft.startMinutes, data),
  );

  /**
   * Choosing a client can set the start time from their history, so the band
   * has to follow a start time that moved from OUTSIDE this component — while
   * still letting him browse bands by hand. Adjust-during-render rather than an
   * effect, which would paint the wrong band first.
   */
  const [lastStart, setLastStart] = useState(draft.startMinutes);
  if (draft.startMinutes !== lastStart) {
    setLastStart(draft.startMinutes);
    const next = bandForMinutes(draft.startMinutes, data);
    if (draft.startMinutes != null && next !== band) setBand(next);
  }

  /** Today / Yesterday / the day he tapped on the grid — deduplicated. */
  const dateOptions = useMemo<ChipOption[]>(() => {
    const yesterday = addDays(todayDate, -1);
    const seen = new Set<string>();
    const out: ChipOption[] = [];
    const push = (date: IsoDate, label: string) => {
      if (seen.has(date)) return;
      seen.add(date);
      out.push({id: date, label, meta: date.slice(5)});
    };
    push(todayDate, 'Today');
    push(yesterday, 'Yesterday');
    push(focusedDate, chipDate(focusedDate));
    push(draft.date, chipDate(draft.date));
    return out;
  }, [draft.date, focusedDate, todayDate]);

  const bandOptions = useMemo<ChipOption[]>(
    () => data.bands.map((entry) => ({id: entry.id, label: entry.label})),
    [data.bands],
  );

  const slotOptions = useMemo<ChipOption[]>(() => {
    const out: ChipOption[] = data.slots
      .filter((slot) => slot.band === band)
      .map((slot) => ({id: `m${slot.minutes}`, label: slot.label}));
    // 27 of the 45 rows in his book carry no clock at all. That is a real
    // state, not a missing one, so it is one tap away and never a default
    // midnight.
    out.push({id: NO_TIME, label: 'No time recorded'});
    return out;
  }, [band, data.slots]);

  const durationOptions = useMemo<ChipOption[]>(
    () =>
      data.durationChips.map((minutes) => ({
        id: String(minutes),
        label: durationLabel(minutes),
      })),
    [data.durationChips],
  );

  const offSlot =
    draft.startMinutes != null &&
    !data.slots.some((slot) => slot.minutes === draft.startMinutes);

  return (
    <>
      <ChipGroup
        label="Date"
        options={dateOptions}
        value={draft.date}
        onChange={onDate}
        compact
        footnote={
          <button
            type="button"
            className="cal-textlink"
            aria-expanded={showPicker}
            onClick={() => setShowPicker((v) => !v)}
          >
            {showPicker ? 'Hide the date picker' : 'Pick another date'}
          </button>
        }
      />

      {showPicker ? (
        <label className="cal-field">
          <span className="cal-label">Any date</span>
          <input
            type="date"
            className="cal-input"
            value={draft.date}
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value);
            }}
          />
        </label>
      ) : null}

      {/* Band first, slots second: twelve slot chips at once is a wall; three
          bands and then four slots is two taps and half the screen. */}
      <ChipGroup
        label="Time of day"
        options={bandOptions}
        value={band}
        onChange={setBand}
        compact
      />

      <ChipGroup
        label="Start time"
        options={slotOptions}
        value={
          draft.startMinutes == null ? NO_TIME : `m${draft.startMinutes}`
        }
        onChange={(id) =>
          onStart(id === NO_TIME ? null : Number(id.slice(1)))
        }
        compact
        footnote={
          <>
            {offSlot ? (
              <span className="cal-tabular">
                Starting {formatMinutes(draft.startMinutes ?? 0)} — not one of
                the published slots, kept as recorded.{' '}
              </span>
            ) : null}
            <button
              type="button"
              className="cal-textlink"
              aria-expanded={showClock}
              onClick={() => setShowClock((v) => !v)}
            >
              {showClock ? 'Hide the clock' : 'Another time'}
            </button>
          </>
        }
      />

      {/* His 5:00 AM garage lifts are not on the published rate card, so an
          arbitrary clock stays reachable — behind a tap, never in the way. */}
      {showClock ? (
        <label className="cal-field">
          <span className="cal-label">Exact start</span>
          <input
            type="time"
            className="cal-input"
            value={
              draft.startMinutes == null
                ? ''
                : `${String(Math.floor(draft.startMinutes / 60)).padStart(
                    2,
                    '0',
                  )}:${String(draft.startMinutes % 60).padStart(2, '0')}`
            }
            onChange={(e) => {
              const [h, m] = e.target.value.split(':');
              if (h === undefined || m === undefined) return;
              onStart(Number(h) * 60 + Number(m));
            }}
          />
        </label>
      ) : null}

      {/* Shown even when no clock was recorded: a 90-minute garage lift with no
          start time still counts toward mat hours, and his book is full of
          exactly that. */}
      <ChipGroup
        label="Length"
        options={durationOptions}
        value={String(draft.durationMinutes)}
        onChange={(id) => onDuration(Number(id))}
        compact
      />
    </>
  );
});

/** Which band a start time falls in, so the slot row opens on the right one. */
function bandForMinutes(minutes: number | null, data: CalendarFormData): string {
  const fallback = data.bands[0]?.id ?? 'evening';
  if (minutes == null) return fallback;
  const hit = data.slots.find((slot) => slot.minutes === minutes);
  if (hit) return hit.band;
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 17 * 60) return 'afternoon';
  return 'evening';
}

/* ==========================================================================
 * INVOICE PANEL
 *
 * The only settlement on this form that reaches outside the browser. It posts
 * to the route's action, which creates a real Shopify draft order and emails
 * it. Everything that could stop that from working is stated BEFORE the button,
 * and the button is not rendered enabled when one of them is true — the two
 * failure modes are "the store is not wired up" and "this athlete's payer has
 * no Shopify customer record", and the second one is a link, not a dead end.
 * ======================================================================== */

interface InvoicePanelProps {
  draft: SessionDraft;
  client: RosterClient | null;
  chips: number[];
  configured: boolean;
  detail: string;
  fetcher: ReturnType<typeof useFetcher<{ok?: boolean; message?: string}>>;
  onAmount: (cents: number) => void;
}

function InvoicePanel({
  draft,
  client,
  chips,
  configured,
  detail,
  fetcher,
  onAmount,
}: InvoicePanelProps) {
  const ids = useId();
  const linked = Boolean(client?.shopifyCustomerId);
  const sending = fetcher.state !== 'idle';
  const result = fetcher.data ?? null;

  const problems: string[] = [];
  if (!client) problems.push('Choose the athlete first.');
  if (!configured) problems.push(detail);
  if (draft.owedCents <= 0) problems.push('Set the amount to invoice.');

  return (
    <>
      <MoneyField
        label="Invoice amount"
        cents={draft.owedCents}
        chips={chips}
        zeroLabel="None"
        onChange={onAmount}
        hint="Sits in the owed column until the invoice is settled."
      />

      {/* THE LINK STATE, stated plainly. Invoicing depends on it and a coach
          should not have to discover that by tapping a button that fails. */}
      <p className="cal-linkstate" data-linked={linked ? 'true' : 'false'}>
        {client ? (
          linked ? (
            <>
              Connected to Shopify ·{' '}
              <span className="cal-tabular cal-raw">
                {client.shopifyCustomerId}
              </span>
            </>
          ) : (
            <>
              {client.name} has no Shopify customer record yet, so there is
              nobody to send an invoice to. Connect them on their client record
              first —{' '}
              <Link
                className="cal-textlink"
                to={`/private/clients?client=${encodeURIComponent(client.id)}`}
              >
                open {client.name}’s record
              </Link>
              .
            </>
          )
        ) : (
          'Choose the athlete and this will say whether they are connected to Shopify.'
        )}
      </p>

      {problems.length > 0 ? (
        <p id={`${ids}-block`} className="cal-foot">
          {problems.join(' ')}
        </p>
      ) : null}

      <div className="cal-invoice-actions">
        <button
          type="button"
          className="cal-ghost"
          disabled={!linked || !configured || sending || draft.owedCents <= 0}
          aria-describedby={problems.length > 0 ? `${ids}-block` : undefined}
          onClick={() => {
            if (!client) return;
            // `void`: the fetcher owns the lifecycle and reports through
            // `fetcher.state` / `fetcher.data`, so there is nothing here to
            // await and nothing a rejection handler could add.
            void fetcher.submit(
              {
                intent: 'send-invoice',
                clientId: client.id,
                amountCents: String(draft.owedCents),
                date: draft.date,
                title: draft.trainingTypeId ?? 'Coaching session',
              },
              {method: 'post'},
            );
          }}
        >
          {sending ? 'Sending…' : 'Create and email the invoice'}
        </button>
      </div>

      {result?.message ? (
        <p
          className={result.ok ? 'cal-foot' : 'cal-error'}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.message}
        </p>
      ) : null}
    </>
  );
}

/* ==========================================================================
 * THE FORM
 * ======================================================================== */

export interface SessionFormProps {
  initial: SessionDraft;
  data: CalendarFormData;
  /** The browser's real date, read in an effect by the shell. */
  todayDate: IsoDate;
  focusedDate: IsoDate;
  isCreate: boolean;
  /** True when this row only exists in this browser. */
  isLocal: boolean;
  onSave: (draft: SessionDraft) => void;
  onCancel: () => void;
}

export function SessionForm({
  initial,
  data,
  todayDate,
  focusedDate,
  isCreate,
  isLocal,
  onSave,
  onCancel,
}: SessionFormProps) {
  const [draft, setDraft] = useState<SessionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();
  const clientRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  /** Posts to this route's action. A nested <Form> would be invalid markup. */
  const invoice = useFetcher<{ok?: boolean; message?: string}>();

  const client = useMemo(
    () => data.clients.find((c) => c.id === draft.clientId) ?? null,
    [data.clients, draft.clientId],
  );

  /** What this lesson is worth, before anything is collected against it. */
  const rateCents = useMemo(
    () =>
      getTrainingType(draft.trainingTypeId)?.defaultAmountCents ??
      getPackageType(draft.packageTypeId)?.defaultAmountCents ??
      null,
    [draft.packageTypeId, draft.trainingTypeId],
  );

  const pickClient = useCallback(
    (id: string) => {
      setError(null);
      const next = data.clients.find((c) => c.id === id);
      setDraft((d) =>
        // Prefill first, then check the settlement still makes sense for the
        // athlete who was just chosen — switching to someone with an empty bank
        // must not leave "use a prepaid session" selected.
        normaliseSettlement(
          applyPrefill(d, id, data.prefills[id]),
          next?.prepaidRemaining ?? 0,
          rateCents,
        ),
      );
    },
    [data.clients, data.prefills, rateCents],
  );

  /* --- the availability ruling ------------------------------------------ */

  /**
   * ONE engine decides whether a time is loggable, and it is the same one the
   * public booking flow asks. Staff logging relaxes the customer-only rules —
   * he may log an hour he already taught, outside his published windows — so
   * what is left blocking is real: a bad range, an hour already sold, an hour
   * his own calendar has spoken for.
   */
  const slot = useMemo(
    () => checkDraftSlot(draft, data.availability),
    [data.availability, draft],
  );
  const slotBlocked = slotBlocksSave(slot);

  /* --- the money chips his book actually contains ----------------------- */

  const paidChips = useMemo(() => {
    const set = new Set<number>(data.amountChips);
    if (rateCents != null) set.add(rateCents);
    return [...set].sort((a, b) => a - b);
  }, [data.amountChips, rateCents]);

  /** Settling in full is the common case, so $0 leads and the balance follows. */
  const owedChips = useMemo(() => {
    const remainder = rateCents != null ? rateCents - draft.paidCents : 0;
    const set = new Set<number>([0]);
    if (remainder > 0) set.add(remainder);
    for (const amount of data.amountChips) {
      if (amount > 0 && set.size < 5) set.add(amount);
    }
    return [...set].sort((a, b) => a - b);
  }, [data.amountChips, draft.paidCents, rateCents]);

  /** The invoice's one-tap amounts: his rates, never a $0 invoice. */
  const invoiceChips = useMemo(
    () => paidChips.filter((amount) => amount > 0),
    [paidChips],
  );

  /* --- vocabulary → chips ---------------------------------------------- */

  const trainingOptions = useMemo<ChipOption[]>(
    () =>
      TRAINING_TYPES.map((type) => ({
        id: type.id,
        label: type.label,
        meta:
          type.defaultAmountCents != null
            ? `${centsLabel(type.defaultAmountCents)} · ${durationLabel(
                type.defaultDurationMins,
              )}`
            : durationLabel(type.defaultDurationMins),
        invented: type.invented,
      })),
    [],
  );

  const packageOptions = useMemo<ChipOption[]>(
    () =>
      PACKAGE_TYPES.map((pkg) => ({
        id: pkg.id,
        label: pkg.label,
        meta:
          pkg.defaultSessions != null
            ? `${pkg.defaultSessions} sessions`
            : undefined,
        invented: pkg.invented,
      })),
    [],
  );

  const methodOptions = useMemo<ChipOption[]>(
    () =>
      PAYMENT_METHODS.map((method) => ({
        id: method.id,
        label: method.label,
        invented: method.invented,
      })),
    [],
  );

  const streamOptions = useMemo<ChipOption[]>(
    () =>
      INCOME_STREAMS.map((stream) => ({
        id: stream.id,
        label: stream.label,
        invented: stream.invented,
      })),
    [],
  );

  const usesInvented =
    getTrainingType(draft.trainingTypeId)?.invented === true ||
    INCOME_STREAMS.some(
      (s) => s.id === draft.incomeStreamId && s.invented === true,
    );

  /**
   * TWO VALIDATIONS, and both of them are about not recording a fiction.
   *
   * 1. THE ATHLETE MUST BE A ROSTER RECORD. The picker cannot produce anything
   *    else — it is a radiogroup over the roster, and its filter box filters,
   *    it never creates — so this check is the backstop for "nothing chosen".
   *    His book already carries 'GAGE KOTARO' beside 'Kade Kean' because that
   *    column was free text; this form will not add a third spelling.
   * 2. THE TIME MUST PASS `checkSlot`. What survives the staff relaxations is
   *    a genuine conflict, and logging one would mean two lessons claiming the
   *    same hour of his life.
   */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!draft.clientId) {
      setError(
        'Choose who this lesson was with. Names come from the roster only — this form cannot create one.',
      );
      clientRef.current?.querySelector<HTMLElement>('button')?.focus();
      return;
    }

    if (slot && !slot.open) {
      // The ruling is already on screen beside the time, with role="alert".
      // Copying it into `error` too would also mark the CLIENT picker invalid,
      // which points him at the wrong control. Move him to the right one.
      setError(null);
      timeRef.current?.scrollIntoView({block: 'nearest'});
      timeRef.current?.querySelector<HTMLElement>('button')?.focus();
      return;
    }

    setError(null);
    onSave(draft);
  };

  return (
    <form onSubmit={submit} className="contents">
      <div className="cal-sheet-body">
        {/* THE RECEIPT. If this line reads right he can submit without
            checking a single control below it. */}
        <p className="cal-receipt" aria-live="polite">
          {summaryOfDraft(draft, client?.name ?? null)}
        </p>

        <div ref={clientRef}>
          <ClientPicker
            clients={data.clients}
            value={draft.clientId}
            onChange={pickClient}
            summaryFor={(id) => data.prefills[id]?.summary}
            describedBy={error ? `${ids}-err` : undefined}
            invalid={Boolean(error)}
          />
        </div>
        {error ? (
          <p id={`${ids}-err`} className="cal-error" role="alert">
            {error}
          </p>
        ) : null}

        <ChipGroup
          label="Training type"
          options={trainingOptions}
          value={draft.trainingTypeId}
          onChange={(id) =>
            setDraft((d) => applyTrainingType(d, id as TrainingTypeId))
          }
          footnote={
            draft.rawTrainingType ? (
              <>
                Logged in your book as{' '}
                <span className="cal-raw">“{draft.rawTrainingType}”</span> —
                kept exactly as written.
              </>
            ) : null
          }
        />

        <ChipGroup
          label="Package type"
          options={packageOptions}
          value={draft.packageTypeId}
          onChange={(id) =>
            setDraft((d) => applyPackageType(d, id as PackageTypeId))
          }
          footnote={
            draft.rawPackageType ? (
              <>
                Logged as{' '}
                <span className="cal-raw">“{draft.rawPackageType}”</span>.
              </>
            ) : null
          }
        />

        <div ref={timeRef}>
          <WhenFields
            draft={draft}
            todayDate={todayDate}
            focusedDate={focusedDate}
            data={data}
            onDate={(date) => setDraft((d) => ({...d, date}))}
            onStart={(startMinutes) => setDraft((d) => ({...d, startMinutes}))}
            onDuration={(durationMinutes) =>
              setDraft((d) => ({...d, durationMinutes}))
            }
          />

          {/* THE RULING ON THE TIME. Printed whether it passes or fails, so
              "open" is a statement the screen made rather than a silence he
              has to interpret. `aria-live` because it changes as he taps. */}
          <p
            id={`${ids}-slot`}
            className={slotBlocked ? 'cal-error' : 'cal-foot'}
            role={slotBlocked ? 'alert' : undefined}
            aria-live={slotBlocked ? undefined : 'polite'}
          >
            {slot === null
              ? 'No clock recorded, so there is no hour to check for a clash. The lesson is logged against the day.'
              : slotWording(slot)}
            {slot?.open && !data.availability.googleConnected ? (
              <>
                {' '}
                Google Calendar is not connected, so this reflects JV Gold
                bookings only.
              </>
            ) : null}
          </p>
        </div>

        <SettlementGroup
          value={draft.settlement}
          onChange={(id: SettlementId) =>
            setDraft((d) => applySettlement(d, id, rateCents))
          }
          prepaidRemaining={client?.prepaidRemaining ?? 0}
          prepaidAfter={prepaidAfter(draft, client?.prepaidRemaining ?? 0)}
          hasClient={Boolean(client)}
        />

        {/* ----------------------------------------------------------------
            THE PANEL FOR THE CHOSEN SETTLEMENT. Only the controls that
            settlement actually needs are on screen: a comp has no amount and
            no method, and rendering them greyed out would still invite the
            question of what they mean.
            ---------------------------------------------------------------- */}

        {draft.settlement === 'outside' ? (
          <>
            <MoneyField
              label="Amount collected"
              cents={draft.paidCents}
              chips={paidChips}
              zeroLabel="Unpaid"
              onChange={(paidCents) => setDraft((d) => ({...d, paidCents}))}
              hint="What actually landed in your hand or your bank."
            />

            <ChipGroup
              label="Payment method"
              options={methodOptions}
              value={draft.paymentMethodId}
              onChange={(id) =>
                setDraft((d) => ({
                  ...d,
                  paymentMethodId: id as PaymentMethodId,
                  rawPaymentMethod: '',
                }))
              }
              footnote={
                draft.rawPaymentMethod ? (
                  <>
                    Logged as{' '}
                    <span className="cal-raw">“{draft.rawPaymentMethod}”</span>.
                  </>
                ) : null
              }
            />

            <MoneyField
              label="Amount owed"
              cents={draft.owedCents}
              chips={owedChips}
              zeroLabel="Settled"
              onChange={(owedCents) => setDraft((d) => ({...d, owedCents}))}
            />
          </>
        ) : null}

        {draft.settlement === 'invoice' ? (
          <InvoicePanel
            draft={draft}
            client={client}
            chips={invoiceChips}
            configured={data.invoicingConfigured}
            detail={data.invoicingDetail}
            fetcher={invoice}
            onAmount={(owedCents) => setDraft((d) => ({...d, owedCents}))}
          />
        ) : null}

        {draft.settlement === 'comped' ? (
          <p className="cal-comped">
            This lesson records at <span className="cal-tabular">$0</span> and is
            marked <strong>COMPED</strong>. It will read as comped — not as
            unpaid — on the session, in the ledger and in every total, so it
            never joins the money you are still chasing.
          </p>
        ) : null}

        <Stepper
          label={
            draft.settlement === 'prepaid'
              ? 'Prepaid sessions used'
              : 'Sessions used'
          }
          value={draft.sessionsUsed}
          min={0}
          max={12}
          onChange={(sessionsUsed) => setDraft((d) => ({...d, sessionsUsed}))}
          hint={
            draft.settlement === 'comped'
              ? 'A comp burns nothing — they did not buy this hour.'
              : draft.settlement === 'prepaid'
                ? 'Drawn straight off their balance.'
                : '0 when the session was made up rather than sold.'
          }
        />

        <ChipGroup
          label="Income stream"
          options={streamOptions}
          value={draft.incomeStreamId}
          onChange={(id) =>
            setDraft((d) => ({...d, incomeStreamId: id as IncomeStreamId}))
          }
        />

        {usesInvented ? (
          <p className="cal-foot">
            ° Added by JV Gold to hold a value that is really in your book but
            never made it onto your Lists sheet.
          </p>
        ) : null}

        {/* THE ONLY FREE TEXT ON THIS FORM, and it is last on purpose. The
            chips are the contexts that recur in his own notes, so the usual
            note is still a tap. */}
        <ToggleChips
          label="Notes"
          options={data.noteChips}
          isOn={(option) => noteHasChip(draft.notes, option)}
          onToggle={(option) =>
            setDraft((d) => ({...d, notes: toggleNoteChip(d.notes, option)}))
          }
          hint="Tap what applies. Type only if none of these fit."
        />

        <label className="cal-field">
          <span className="sr-only">Session note</span>
          <textarea
            className="cal-textarea"
            rows={2}
            placeholder="Anything the chips do not cover"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({...d, notes: e.target.value}))}
          />
        </label>

        <p className="cal-local">
          {isCreate || isLocal ? 'Saves on this device' : 'From your book'}
        </p>
        <p className="cal-foot">
          There is no session backend wired up yet. Saving keeps the row in this
          browser so the flow is real — nothing is written to Supabase or
          Google, and a reload clears it. The invoice above is the one exception:
          it creates a real Shopify draft order and really emails it.
        </p>
      </div>

      <div className="cal-sheet-foot">
        <button
          type="submit"
          className="cal-primary"
          // Disabled rather than hidden, with the reason already on screen
          // beside the time. A submit that silently does nothing is worse.
          disabled={slotBlocked}
          aria-describedby={slotBlocked ? `${ids}-slot` : undefined}
        >
          {isCreate ? 'Log lesson' : 'Save changes'}
        </button>
        <button type="button" className="cal-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
