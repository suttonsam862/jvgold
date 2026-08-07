/**
 * ============================================================================
 * SETTLEMENT SELECTOR — "how did this lesson get paid for?"
 * ============================================================================
 *
 * Five chips, each carrying its CONSEQUENCE on the line beneath it, because the
 * name of a settlement is not the same as what choosing it does. "Send a
 * payable invoice" is a chip; "creates a Shopify draft order and emails them a
 * link" is the thing he needs to know before he taps it.
 *
 * ---------------------------------------------------------------------------
 * TWO OF THE FIVE CANNOT ALWAYS BE CHOSEN, AND THEY SAY WHY
 * ---------------------------------------------------------------------------
 * `Charge a saved card` is PERMANENTLY disabled today. No customer on this
 * store has a stored payment method and the recurring-billing app is not
 * installed, so there is literally nothing to charge. It is rendered visibly,
 * as a disabled control with the reason printed under it, rather than removed —
 * a missing option looks like a feature nobody built, and an enabled option
 * that fails on tap is worse than both.
 *
 * `Use a prepaid session` is disabled per athlete: it comes back the moment
 * they buy a block, and the balance before and after the draw is printed so the
 * arithmetic is on screen rather than in his head.
 *
 * ---------------------------------------------------------------------------
 * A11Y
 * ---------------------------------------------------------------------------
 * A radiogroup of real `<button>`s with a roving tabindex, exactly like
 * `ChipGroup` — arrows move the selection, one tab stop for the group. The
 * disabled chips stay in the DOM and stay announced: `aria-disabled` rather
 * than the `disabled` attribute, so a screen-reader user hears the option AND
 * the reason instead of hearing nothing at all. The reason is tied to the chip
 * with `aria-describedby`, so it is read out as part of the option.
 */

import {memo, useCallback, useId, useRef} from 'react';
import {SETTLEMENTS, settlementBlockedReason} from './sessionModel';
import type {SettlementId} from './sessionModel';

export interface SettlementGroupProps {
  value: SettlementId;
  onChange: (id: SettlementId) => void;
  /** Sessions in this athlete's bank right now. Gates the prepaid chip. */
  prepaidRemaining: number;
  /** The bank after this draft commits. Printed beside the balance. */
  prepaidAfter: number;
  /** False before an athlete has been chosen — prepaid has no owner yet. */
  hasClient: boolean;
}

/**
 * NOTE ON WHAT DOES NOT LIVE IN HERE. Every chip is a `<button>`, so nothing
 * interactive may be nested inside one — a link or a second button inside a
 * button is invalid markup and unreachable by keyboard. The controls a
 * settlement needs (the invoice's send button, the link to the client screen)
 * are rendered by the FORM, underneath this group, against the selected id.
 */
export const SettlementGroup = memo(function SettlementGroup({
  value,
  onChange,
  prepaidRemaining,
  prepaidAfter,
  hasClient,
}: SettlementGroupProps) {
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const blocked = useCallback(
    (id: SettlementId) =>
      settlementBlockedReason(id, prepaidRemaining, hasClient),
    [hasClient, prepaidRemaining],
  );

  /**
   * Arrows move FOCUS across every option, including the blocked ones, and move
   * SELECTION only onto the ones that can be chosen.
   *
   * Skipping the blocked options would be the easy implementation and it would
   * be the wrong one: the reason a settlement is unavailable is attached to its
   * chip through `aria-describedby`, so an option a keyboard user can never
   * land on is an option whose reason they can never hear. "Charge a saved
   * card" would simply not exist for them — which is the disappearing-control
   * problem this screen renders it visibly to avoid. Landing on it announces
   * the option, that it is unavailable, and why.
   *
   * This is the ARIA authoring-practices accommodation for `aria-disabled`
   * members of a radiogroup: focusable, not selectable.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const count = SETTLEMENTS.length;

      let next: number;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (index + 1) % count;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (index - 1 + count) % count;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const target = SETTLEMENTS[next];

      // Focus always moves. Selection only follows onto a selectable option.
      if (!blocked(target.id)) onChange(target.id);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-settle="${target.id}"]`)
        ?.focus();
    },
    [blocked, onChange],
  );

  /**
   * The single tab stop. It is the CHECKED option — and `checked` means
   * selected AND selectable, so a value that has just become unreachable (he
   * switched to an athlete with an empty prepaid bank) does not take the whole
   * group out of the tab order with it. Falling back to the first chip keeps
   * the group reachable in every state.
   */
  const checkedIndex = SETTLEMENTS.findIndex(
    (option) => option.id === value && !blocked(option.id),
  );

  return (
    <div className="cal-group">
      <span className="cal-label" id={`${groupId}-label`}>
        How it was settled
      </span>

      <div
        ref={listRef}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="cal-settle"
      >
        {SETTLEMENTS.map((option, index) => {
          const reason = blocked(option.id);
          const selected = option.id === value && !reason;
          const detailId = `${groupId}-${option.id}-detail`;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              // `aria-disabled`, never the `disabled` attribute: the option and
              // the reason both have to reach a screen reader.
              aria-disabled={reason ? true : undefined}
              aria-describedby={detailId}
              data-settle={option.id}
              data-blocked={reason ? 'true' : undefined}
              tabIndex={
                (checkedIndex === -1 ? index === 0 : selected) ? 0 : -1
              }
              className="cal-settle-btn"
              onClick={() => {
                if (reason) return;
                onChange(option.id);
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="cal-settle-label">{option.label}</span>
              <span className="cal-settle-why" id={detailId}>
                {reason ?? option.consequence}
              </span>
              {option.id === 'prepaid' && !reason ? (
                <span className="cal-tabular cal-settle-balance">
                  Balance {prepaidRemaining} → {prepaidAfter}
                  {prepaidAfter < 0 ? ' · more than they have' : ''}
                </span>
              ) : null}
              {reason ? (
                <span className="sr-only"> — unavailable</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
