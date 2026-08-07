/**
 * ============================================================================
 * CLIENT INTAKE FORM — adding an athlete to the roster
 * ============================================================================
 *
 * Selectable-first, the same discipline the session form runs on: level,
 * status, package and income stream are chip groups over the controlled
 * vocabulary, and the keyboard only comes up for the handful of values that
 * genuinely cannot come from a list.
 *
 * ORDER OF THE FORM = ORDER OF THE CONVERSATION
 *   1. Who      — athlete, guardian, and how to reach them
 *   2. Where they sit — level, status
 *   3. What they bought — package, income stream
 *   4. Paperwork — the things insurance and event registration will ask for
 *
 * The paperwork block carries a live checklist of what is still missing,
 * because chasing those five items is a real part of the admin and a blank
 * input does not look like a task. Nothing in it blocks the save: an athlete
 * standing in the room has to be addable before his USAW card turns up.
 *
 * PROGRESSIVE ENHANCEMENT. This is a real `<Form method="post">` over real
 * named inputs, so it submits and validates server-side with JavaScript off.
 * The React state on top exists to drive the chips, the live checklist and the
 * inline errors — never to become the only way the form can be sent.
 *
 * A11Y. Every chip group is an ARIA radiogroup of real buttons with a roving
 * tabindex (one tab stop per group, arrows move the selection). Every text
 * input has a real `<label>`, and every error is tied to its own control with
 * `aria-describedby` + `aria-invalid` rather than being left to colour.
 */

import {memo, useCallback, useId, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Form, Link} from 'react-router';
import type {ClientLevel, ClientStatus} from '~/lib/ops/types';
import {INCOME_STREAMS, PACKAGE_TYPES} from '~/lib/ops/vocabulary';
import type {IncomeStreamId, PackageTypeId} from '~/lib/ops/vocabulary';
import {LEVELS, STATUSES} from './filterModel';
import {
  EMPTY_INTAKE,
  hasErrors,
  isMinorLevel,
  paperworkChecklist,
  validateIntake,
} from './intakeModel';
import type {
  IntakeDraft,
  IntakeErrors,
  IntakeResult,
  WaiverState,
} from './intakeModel';

/* ==========================================================================
 * CHIP GROUP
 *
 * A local copy rather than an import from the calendar's Controls: that one is
 * bound to the `--cal-*` token block and this screen runs on `--cl-*`. Same
 * ARIA contract, same roving tabindex, different register.
 * ======================================================================== */

export interface IntakeChoice {
  id: string;
  label: string;
  /** One short line under the label. */
  meta?: string;
  /** Marks a vocabulary entry JV Gold added to hold a real value of his. */
  invented?: boolean;
}

interface ChipsProps {
  label: string;
  options: readonly IntakeChoice[];
  value: string | null;
  onChange: (id: string) => void;
  /** Rendered under the chips. */
  hint?: ReactNode;
  /** Posted with the form, so the choice survives a no-JavaScript submit. */
  name: string;
}

const Chips = memo(function Chips({
  label,
  options,
  value,
  onChange,
  hint,
  name,
}: ChipsProps) {
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const count = options.length;
      if (count === 0) return;

      let next: number;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = count - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (index + 1) % count;
      } else {
        next = (index - 1 + count) % count;
      }

      const target = options[next];
      if (!target) return;
      onChange(target.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-chip="${target.id}"]`)
        ?.focus();
    },
    [onChange, options],
  );

  const activeIndex = options.findIndex((option) => option.id === value);

  return (
    <div className="clients-intake-group">
      {/* The value the server reads. The buttons drive it; without JS the
          default selection still posts, which is why it is a hidden input
          rather than state that only exists in React. */}
      <input type="hidden" name={name} value={value ?? ''} />

      <span className="clients-intake-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div
        ref={listRef}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="clients-intake-chips"
      >
        {options.map((option, index) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-chip={option.id}
              tabIndex={
                selected || (activeIndex === -1 && index === 0) ? 0 : -1
              }
              className="clients-intake-chip"
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="clients-intake-chip-label">
                {option.label}
                {option.invented ? (
                  <span className="clients-intake-chip-mark" aria-hidden="true">
                    °
                  </span>
                ) : null}
              </span>
              {option.meta ? (
                <span className="clients-intake-chip-meta">{option.meta}</span>
              ) : null}
              {option.invented ? (
                <span className="sr-only">
                  {' '}
                  — added by JV Gold, not on your Lists sheet
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hint ? <p className="clients-intake-hint">{hint}</p> : null}
    </div>
  );
});

/* ==========================================================================
 * TEXT FIELD
 * ======================================================================== */

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: 'text' | 'email' | 'tel' | 'date';
  autoComplete?: string;
  required?: boolean;
  /** Prints the "Supabase only, never Shopify" marker under the control. */
  supabaseOnly?: boolean;
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  autoComplete = 'off',
  required = false,
  supabaseOnly = false,
}: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="clients-intake-field">
      <label className="clients-intake-label" htmlFor={`${id}-input`}>
        {label}
        {required ? (
          <span className="clients-intake-req" aria-hidden="true">
            required
          </span>
        ) : null}
      </label>
      <input
        id={`${id}-input`}
        name={name}
        type={type}
        className="clients-input clients-intake-input"
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        aria-required={required || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p id={`${id}-hint`} className="clients-intake-hint">
          {hint}
          {supabaseOnly ? (
            <span className="clients-intake-guard"> Supabase only.</span>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="clients-intake-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * THE FORM
 * ======================================================================== */

export interface IntakeFormProps {
  /** Server result from the last submit, or null before one. */
  result: IntakeResult | null;
  /** True while the action is running. */
  busy: boolean;
  /** Where "cancel" goes — the roster, with his filters still on it. */
  backTo: string;
  /** One line about the Shopify connection, from the loader. */
  shopifyDetail: string;
  shopifyReady: boolean;
  /** One line about the Supabase connection, from the loader. */
  supabaseDetail: string;
  supabaseReady: boolean;
}

export function IntakeForm({
  result,
  busy,
  backTo,
  shopifyDetail,
  shopifyReady,
  supabaseDetail,
  supabaseReady,
}: IntakeFormProps) {
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY_INTAKE);
  /** Errors only appear after a submit attempt — not while he is still typing. */
  const [showErrors, setShowErrors] = useState(false);

  const localErrors = useMemo(() => validateIntake(draft), [draft]);
  /** The server's answer wins: it saw the real state of Shopify and Supabase. */
  const errors: IntakeErrors = result?.errors ?? (showErrors ? localErrors : {});

  const checklist = useMemo(() => paperworkChecklist(draft), [draft]);
  const missing = checklist.filter((item) => !item.ok);

  const set = useCallback(
    <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => {
      setDraft((previous) => ({...previous, [key]: value}));
    },
    [],
  );

  const levelOptions = useMemo<IntakeChoice[]>(
    () =>
      LEVELS.map((level) => ({
        id: level,
        label: level,
        meta: isMinorLevel(level) ? 'guardian required' : undefined,
      })),
    [],
  );

  const statusOptions = useMemo<IntakeChoice[]>(
    () => STATUSES.map((status) => ({id: status, label: status})),
    [],
  );

  const packageOptions = useMemo<IntakeChoice[]>(
    () =>
      PACKAGE_TYPES.map((pkg) => ({
        id: pkg.id,
        label: pkg.label,
        meta:
          pkg.defaultSessions != null ? `${pkg.defaultSessions} sessions` : undefined,
        invented: pkg.invented,
      })),
    [],
  );

  const streamOptions = useMemo<IntakeChoice[]>(
    () =>
      INCOME_STREAMS.map((stream) => ({
        id: stream.id,
        label: stream.label,
        invented: stream.invented,
      })),
    [],
  );

  return (
    <Form
      method="post"
      className="clients-intake"
      onSubmit={(event) => {
        setShowErrors(true);
        // Client-side validation is a courtesy that saves a round trip. The
        // action runs the same `validateIntake` regardless, so a form sent with
        // JavaScript off is checked just as hard.
        if (hasErrors(localErrors)) event.preventDefault();
      }}
    >
      {/* ------------------------------------------------------------ WHO */}
      <section className="clients-intake-section" aria-labelledby="intake-who">
        <h2 id="intake-who" className="tag text-gold-deep">
          Athlete
        </h2>

        <div className="clients-intake-grid">
          <Field
            label="Athlete name"
            name="name"
            value={draft.name}
            onChange={(value) => set('name', value)}
            error={errors.name}
            required
            autoComplete="off"
          />
          <Field
            label="Guardian"
            name="guardian"
            value={draft.guardian}
            onChange={(value) => set('guardian', value)}
            error={errors.guardian}
            required={isMinorLevel(draft.level)}
            hint="The parent who gets invoiced and gets called."
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={draft.email}
            onChange={(value) => set('email', value)}
            error={errors.email}
            required
            hint="Matched against Shopify first, so a returning family is never duplicated."
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            value={draft.phone}
            onChange={(value) => set('phone', value)}
            error={errors.phone}
            required
          />
        </div>
      </section>

      {/* -------------------------------------------------------- STANDING */}
      <section
        className="clients-intake-section"
        aria-labelledby="intake-standing"
      >
        <h2 id="intake-standing" className="tag text-gold-deep">
          Standing
        </h2>

        <Chips
          name="level"
          label="Level"
          options={levelOptions}
          value={draft.level}
          onChange={(id) => set('level', id as ClientLevel)}
        />

        <Chips
          name="status"
          label="Status"
          options={statusOptions}
          value={draft.status}
          onChange={(id) => set('status', id as ClientStatus)}
          hint="Trial until they commit to a package. Owes Balance puts them on the money-chasing list."
        />
      </section>

      {/* ---------------------------------------------------------- MONEY */}
      <section
        className="clients-intake-section"
        aria-labelledby="intake-package"
      >
        <h2 id="intake-package" className="tag text-gold-deep">
          Package and stream
        </h2>

        <Chips
          name="packageTypeId"
          label="Package"
          options={packageOptions}
          value={draft.packageTypeId}
          onChange={(id) => set('packageTypeId', id as PackageTypeId)}
          hint="Leave it unset until they buy one — a package nobody bought is not a package."
        />

        <Chips
          name="incomeStreamId"
          label="Income stream"
          options={streamOptions}
          value={draft.incomeStreamId}
          onChange={(id) => set('incomeStreamId', id as IncomeStreamId)}
          hint="° Added by JV Gold to hold a value that is really in your book but never made it onto your Lists sheet."
        />
      </section>

      {/* ------------------------------------------------------ PAPERWORK */}
      <section
        className="clients-intake-section"
        aria-labelledby="intake-paperwork"
      >
        <h2 id="intake-paperwork" className="tag text-gold-deep">
          Paperwork
        </h2>

        <p className="clients-intake-note">
          What insurance and event registration will ask you for. None of it
          blocks this save — add the athlete now and chase the rest. Date of
          birth, the insurance policy number and the waiver are stored in
          Supabase behind row-level security and are never written to a Shopify
          metafield: a metafield marked <code>PUBLIC_READ</code> is readable with
          the storefront token that ships in this site’s browser bundle, and
          these are children.
        </p>

        <div className="clients-intake-grid">
          <Field
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            value={draft.dateOfBirth}
            onChange={(value) => set('dateOfBirth', value)}
            error={errors.dateOfBirth}
            hint="Drives age brackets."
            supabaseOnly
          />
          <Field
            label="USAW membership card"
            name="usawCardNumber"
            value={draft.usawCardNumber}
            onChange={(value) => set('usawCardNumber', value)}
            hint="Card number from USA Wrestling."
            supabaseOnly
          />
          <Field
            label="Insurance provider"
            name="insuranceProvider"
            value={draft.insuranceProvider}
            onChange={(value) => set('insuranceProvider', value)}
            supabaseOnly
            hint="The company name as it appears on the card."
          />
          <Field
            label="Policy number"
            name="insurancePolicyNumber"
            value={draft.insurancePolicyNumber}
            onChange={(value) => set('insurancePolicyNumber', value)}
            supabaseOnly
            hint="Never leaves Supabase."
          />
          <Field
            label="Emergency contact"
            name="emergencyContactName"
            value={draft.emergencyContactName}
            onChange={(value) => set('emergencyContactName', value)}
            hint="Who to call from the mat."
            supabaseOnly
          />
          <Field
            label="Emergency phone"
            name="emergencyContactPhone"
            type="tel"
            value={draft.emergencyContactPhone}
            onChange={(value) => set('emergencyContactPhone', value)}
            error={errors.emergencyContactPhone}
            supabaseOnly
            hint="Reachable during training hours."
          />
        </div>

        <Chips
          name="waiver"
          label="Liability waiver"
          options={[
            {id: 'signed', label: 'Signed', meta: 'On file'},
            {id: 'unsigned', label: 'Not signed', meta: 'Blocks mat time'},
          ]}
          value={draft.waiver}
          onChange={(id) => set('waiver', id as WaiverState)}
        />

        {/* THE RUNNING GAP LIST. Missing paperwork is a task, and a task has
            to look like one rather than like an empty box. */}
        <div className="clients-intake-gaps" aria-live="polite">
          <p className="clients-intake-gaps-head">
            {missing.length === 0
              ? 'Nothing missing — every piece of paperwork is on this record.'
              : `${missing.length} of ${checklist.length} still missing`}
          </p>
          <ul className="clients-check">
            {checklist.map((item) => (
              <li key={item.key} data-ok={item.ok ? 'true' : 'false'}>
                <span className="clients-check-mark" aria-hidden="true">
                  {item.ok ? '✓' : '!'}
                </span>
                <span className="clients-check-text">
                  <span className="clients-check-label">{item.label}</span>
                  <span className="clients-check-detail">{item.detail}</span>
                </span>
                <span className="sr-only">{item.ok ? 'On file' : 'Missing'}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------- WHERE IT GOES */}
      <section className="clients-intake-section" aria-labelledby="intake-where">
        <h2 id="intake-where" className="tag text-gold-deep">
          Where this record goes
        </h2>

        <ul className="clients-intake-routes">
          <li data-ready={shopifyReady ? 'true' : 'false'}>
            <span className="clients-intake-route-name">Shopify customer</span>
            <span className="clients-intake-route-detail">
              Name, email and phone only. Searched by email first so a returning
              family is matched rather than duplicated. {shopifyDetail}
            </span>
          </li>
          <li data-ready={supabaseReady ? 'true' : 'false'}>
            <span className="clients-intake-route-name">
              Supabase · row-level security
            </span>
            <span className="clients-intake-route-detail">
              The whole record, including date of birth, insurance policy number
              and waiver status. {supabaseDetail}
            </span>
          </li>
        </ul>
      </section>

      {/* ---------------------------------------------------------- RESULT */}
      {result?.message ? (
        <p
          className={
            result.ok ? 'clients-intake-result' : 'clients-intake-error'
          }
          role={result.ok ? 'status' : 'alert'}
        >
          {result.message}
        </p>
      ) : null}

      {result && !result.ok && hasErrors(result.errors) ? (
        <p className="clients-intake-error" role="alert">
          Nothing was saved. Fix the fields marked above and try again.
        </p>
      ) : null}

      <div className="clients-intake-foot">
        <button type="submit" className="clients-intake-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Add to roster'}
        </button>
        <Link to={backTo} className="clients-intake-cancel">
          Cancel
        </Link>
      </div>
    </Form>
  );
}
