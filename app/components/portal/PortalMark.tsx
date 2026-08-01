/**
 * The JV monogram again — same single gold hairline as the staff mark, but
 * set inside an open doorway. Same family, different door: the staff gate is
 * the back door, this one is the front. Decorative; the accessible name lives
 * on the surrounding heading.
 */
export function PortalMark({className = ''}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 80 60"
      className={`portal-mark ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {/* The doorway */}
      <path d="M9 57 V27 a31 25 0 0 1 62 0 V57" opacity="0.45" />
      {/* The monogram, scaled to sit inside it */}
      <g transform="translate(40 34) scale(0.58) translate(-42 -29)">
        <path d="M32 12 V38 a9 9 0 0 1 -18 0" />
        <path d="M46 12 L58 46 L70 12" />
      </g>
    </svg>
  );
}
