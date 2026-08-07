/**
 * ============================================================================
 * TAP-FIRST FORM CONTROLS
 * ============================================================================
 *
 * The governing constraint on this screen is "as few text inputs as possible;
 * the more selectable, the better". These are the controls that make that
 * achievable: a chip group instead of a `<select>`, a stepper instead of a
 * number field, and a money field that leads with one-tap amounts and keeps
 * the keypad as the fallback.
 *
 * WHY CHIPS AND NOT A DROPDOWN
 * ----------------------------
 * A dropdown HIDES the vocabulary. Jesse's training types fractured into
 * 'STRENGTH', 'DRILL', 'TOURNAMENT' and a typed-out partner name precisely
 * because nothing on screen showed him the eleven options he already had. A
 * chip row teaches the list every time he logs a session.
 *
 * A11Y
 * ----
 * Each group is a real ARIA radiogroup made of real `<button>`s: arrow keys
 * move the selection, Home/End jump to the ends, and a roving tabindex means
 * the whole group is a single tab stop. Every control is 44px minimum, which
 * is also the reason none of these are native `<select>`/`<input type=number>`
 * with their platform-sized hit areas.
 */

import {memo, useCallback, useId, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {centsFromInput, centsLabel, inputFromCents} from './sessionModel';

/* ==========================================================================
 * CHIP GROUP
 * ======================================================================== */

export interface ChipOption {
  id: string;
  label: string;
  /** One short line under the label. Keep it to a few words. */
  meta?: string;
  /**
   * `true` for a vocabulary entry JV Gold added because his Lists sheet had no
   * home for a value that is really in his book. Marked, never hidden.
   */
  invented?: boolean;
}

interface ChipGroupProps {
  label: string;
  options: readonly ChipOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** Rendered under the chips — where a preserved raw cell is surfaced. */
  footnote?: ReactNode;
  /** Ids of elements describing the group, e.g. an error message. */
  describedBy?: string;
  invalid?: boolean;
  /** Chips sized to their content rather than stretched into a grid. */
  compact?: boolean;
}

export const ChipGroup = memo(function ChipGroup({
  label,
  options,
  value,
  onChange,
  footnote,
  describedBy,
  invalid,
  compact,
}: ChipGroupProps) {
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Radiogroup keyboard contract: arrows move the selection AND the focus, so
   * a keyboard user never has to tab through eleven training types. The
   * handler lives on the radios — the container is deliberately not focusable,
   * which is both the ARIA pattern and what the roving tabindex depends on.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const keys = [
        'ArrowRight',
        'ArrowDown',
        'ArrowLeft',
        'ArrowUp',
        'Home',
        'End',
      ];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const count = options.length;
      if (count === 0) return;
      let next: number;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (index + 1) % count;
      } else {
        next = (index - 1 + count) % count;
      }
      const target = options[next];
      if (!target) return;
      onChange(target.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-chip="${cssEscape(target.id)}"]`)
        ?.focus();
    },
    [onChange, options],
  );

  const activeIndex = options.findIndex((o) => o.id === value);

  return (
    <div className="cal-group">
      <span className="cal-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div
        ref={listRef}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="cal-chips"
        data-compact={compact || undefined}
        data-invalid={invalid || undefined}
      >
        {options.map((option, i) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-chip={option.id}
              // Roving tabindex: one tab stop for the whole vocabulary.
              tabIndex={selected || (activeIndex === -1 && i === 0) ? 0 : -1}
              className="cal-chipbtn"
              onClick={() => onChange(option.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="cal-chipbtn-label">
                {option.label}
                {option.invented ? (
                  <span className="cal-chipbtn-mark" aria-hidden="true">
                    °
                  </span>
                ) : null}
              </span>
              {option.meta ? (
                <span className="cal-chipbtn-meta">{option.meta}</span>
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
      {footnote ? <p className="cal-foot">{footnote}</p> : null}
    </div>
  );
});

/** Attribute selectors have to survive ids like `12-session-package`. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/* ==========================================================================
 * TOGGLE CHIPS — multi-select, used for the note contexts
 * ======================================================================== */

interface ToggleChipsProps {
  label: string;
  options: readonly string[];
  isOn: (option: string) => boolean;
  onToggle: (option: string) => void;
  hint?: string;
}

export const ToggleChips = memo(function ToggleChips({
  label,
  options,
  isOn,
  onToggle,
  hint,
}: ToggleChipsProps) {
  const groupId = useId();
  if (options.length === 0) return null;
  return (
    <div className="cal-group">
      <span className="cal-label" id={`${groupId}-label`}>
        {label}
      </span>
      <div
        className="cal-chips"
        data-compact="true"
        role="group"
        aria-labelledby={`${groupId}-label`}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="cal-chipbtn"
            aria-pressed={isOn(option)}
            onClick={() => onToggle(option)}
          >
            <span className="cal-chipbtn-label">{option}</span>
          </button>
        ))}
      </div>
      {hint ? <p className="cal-foot">{hint}</p> : null}
    </div>
  );
});

/* ==========================================================================
 * STEPPER — "Sessions used", his one counting column
 * ======================================================================== */

interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  hint?: string;
}

export const Stepper = memo(function Stepper({
  label,
  value,
  min = 0,
  max = 12,
  onChange,
  hint,
}: StepperProps) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="cal-group">
      <label className="cal-label" htmlFor={`${id}-value`}>
        {label}
      </label>
      <div className="cal-stepper">
        <button
          type="button"
          className="cal-step-btn"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`One fewer ${label.toLowerCase()}`}
        >
          <svg width="14" height="2" viewBox="0 0 14 2" aria-hidden="true">
            <path d="M0 1h14" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <input
          id={`${id}-value`}
          className="cal-step-value cal-tabular"
          type="text"
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const parsed = Number(e.target.value.replace(/[^0-9]/g, ''));
            onChange(clamp(Number.isFinite(parsed) ? parsed : min));
          }}
        />
        <button
          type="button"
          className="cal-step-btn"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`One more ${label.toLowerCase()}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
      {hint ? <p className="cal-foot">{hint}</p> : null}
    </div>
  );
});

/* ==========================================================================
 * MONEY FIELD
 *
 * The only genuinely numeric input on the form, and even here the chips come
 * first: his book is mostly $200, $150, $100 and $0. Cents in, cents out — the
 * typed text is parsed with string maths so no float ever touches the amount.
 * ======================================================================== */

interface MoneyFieldProps {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
  /** One-tap amounts, in cents. Rendered before the keypad. */
  chips: readonly number[];
  /** Label for the zero chip: 'Unpaid', 'Settled'. */
  zeroLabel?: string;
  hint?: string;
}

export const MoneyField = memo(function MoneyField({
  label,
  cents,
  onChange,
  chips,
  zeroLabel = 'None',
  hint,
}: MoneyFieldProps) {
  const id = useId();

  /**
   * The keypad holds its own text so a half-typed "20." survives the round
   * trip through cents. When the amount changes from OUTSIDE — a chip tap, a
   * client prefill — the text is re-derived. This is React's documented
   * adjust-state-during-render pattern, not an effect: an effect would paint
   * the stale number first.
   */
  const [text, setText] = useState(() => inputFromCents(cents));
  const [lastCents, setLastCents] = useState(cents);
  if (cents !== lastCents) {
    setLastCents(cents);
    if (centsFromInput(text) !== cents) setText(inputFromCents(cents));
  }

  return (
    <div className="cal-group">
      <span className="cal-label" id={`${id}-label`}>
        {label}
      </span>
      <div
        className="cal-chips"
        data-compact="true"
        role="radiogroup"
        aria-labelledby={`${id}-label`}
      >
        {chips.map((amount, i) => (
          <button
            key={amount}
            type="button"
            role="radio"
            aria-checked={amount === cents}
            tabIndex={amount === cents || (i === 0 && !chips.includes(cents)) ? 0 : -1}
            className="cal-chipbtn"
            onClick={() => onChange(amount)}
          >
            <span className="cal-chipbtn-label cal-tabular">
              {amount === 0 ? zeroLabel : centsLabel(amount)}
            </span>
          </button>
        ))}
      </div>
      <div className="cal-money">
        <label className="cal-money-prefix" htmlFor={`${id}-input`}>
          <span className="sr-only">{label} in dollars</span>
          <span aria-hidden="true">$</span>
        </label>
        <input
          id={`${id}-input`}
          className="cal-money-input cal-tabular"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            const parsed = centsFromInput(next);
            setLastCents(parsed);
            onChange(parsed);
          }}
        />
      </div>
      {hint ? <p className="cal-foot">{hint}</p> : null}
    </div>
  );
});
