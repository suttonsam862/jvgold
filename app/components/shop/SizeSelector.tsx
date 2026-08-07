import {useRef} from 'react';

/**
 * Size selector — a real ARIA radiogroup built from real <button>s.
 *
 * Availability is deliberately three-state. `true` and `null` both render the
 * same neutral, selectable button: we do not know the counts yet and we will
 * not invent them, and a size that is simply available gets no badge, no
 * number and no urgency. Only an explicit `false` is called out, as "Sold out".
 *
 * Keyboard: arrows move and select, Home/End jump to the ends, Space/Enter
 * selects the focused size. Sold-out sizes are aria-disabled rather than
 * `disabled`, so they stay reachable and announced instead of vanishing from
 * the tab order.
 */

export interface SizeOption {
  /** Stable value, e.g. "youth-m". */
  value: string;
  /** Short label rendered in the button, e.g. "YM". */
  label: string;
  /** Full label for screen readers, e.g. "Youth Medium". */
  name: string;
  /** true = in stock, false = sold out, null = inventory not confirmed yet. */
  available: boolean | null;
}

interface SizeSelectorProps {
  sizes: SizeOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** id of the element labelling the group. */
  labelledBy: string;
  /** id of a hint element describing the group. */
  describedBy?: string;
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  labelledBy,
  describedBy,
}: SizeSelectorProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectable = (size: SizeOption) => size.available !== false;

  /** Next index in `dir` that can actually be chosen, wrapping around. */
  function step(from: number, dir: 1 | -1): number {
    for (let i = 1; i <= sizes.length; i += 1) {
      const next = (from + dir * i + sizes.length * i) % sizes.length;
      if (selectable(sizes[next])) return next;
    }
    return from;
  }

  function edge(dir: 1 | -1): number {
    const order =
      dir === 1
        ? sizes.map((_, i) => i)
        : sizes.map((_, i) => sizes.length - 1 - i);
    const found = order.find((i) => selectable(sizes[i]));
    return found ?? 0;
  }

  function move(to: number) {
    onChange(sizes[to].value);
    refs.current[to]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(step(index, 1));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(step(index, -1));
        break;
      case 'Home':
        event.preventDefault();
        move(edge(1));
        break;
      case 'End':
        event.preventDefault();
        move(edge(-1));
        break;
      default:
        break;
    }
  }

  // Roving tabindex: the checked size holds the tab stop, otherwise the first
  // size anyone is allowed to choose.
  const activeIndex = (() => {
    const checked = sizes.findIndex((s) => s.value === value);
    if (checked !== -1) return checked;
    return edge(1);
  })();

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="grid grid-cols-4 gap-2 sm:grid-cols-7"
    >
      {sizes.map((size, index) => {
        const soldOut = size.available === false;
        const checked = size.value === value;
        return (
          <button
            key={size.value}
            type="button"
            role="radio"
            ref={(node) => {
              refs.current[index] = node;
            }}
            aria-checked={checked}
            aria-disabled={soldOut || undefined}
            tabIndex={index === activeIndex ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => {
              if (!soldOut) onChange(size.value);
            }}
            className="sh-size display text-[0.7rem] tracking-[0.14em]"
          >
            <span aria-hidden="true">{size.label}</span>
            <span className="sr-only">
              {size.name}
              {soldOut ? ' — sold out' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
