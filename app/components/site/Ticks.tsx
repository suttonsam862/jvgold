/** The gold /// brand motif. */
export default function Ticks({className = ''}: {className?: string}) {
  return (
    <span className={`inline-flex gap-[5px] ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="block h-[14px] w-[7px] -skew-x-[30deg] bg-gold" />
      ))}
    </span>
  );
}
