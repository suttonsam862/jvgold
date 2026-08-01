/**
 * The JV monogram, drawn in a single gold hairline. Used as the mark on the
 * private login screen and, at a smaller size, in the dashboard header.
 * Decorative — the accessible name lives on the surrounding heading.
 */
export function PrivateMark({className = ''}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 80 60"
      className={`private-mark ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M32 12 V38 a9 9 0 0 1 -18 0" />
      <path d="M46 12 L58 46 L70 12" />
      <line x1="14" y1="54" x2="70" y2="54" opacity="0.45" />
    </svg>
  );
}
