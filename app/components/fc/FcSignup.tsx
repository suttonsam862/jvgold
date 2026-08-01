import {useEffect, useId, useRef, useState} from 'react';

/**
 * "Be first in the room" capture.
 *
 * There is no backend yet, so this validates and confirms entirely on the
 * client. Wiring it to a real list is a follow-up — see the route notes.
 *
 * Type sizes and vertical rhythm use the `.t-*` / `.stack-*` scales from
 * fc.css rather than Tailwind utilities: reset.css is unlayered and
 * out-ranks utilities on <p>, <form> and <input>. See the note at the top
 * of app/styles/fc.css.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Long enough to read as a considered answer, short enough to feel instant. */
const SETTLE_MS = 520;

export function FcSignup() {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // Never leave a timer running behind an unmounted component.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Land the reader on the confirmation rather than on whatever the form
  // was replaced by. The live region alone is not reliable on a swap.
  useEffect(() => {
    if (confirmed) confirmRef.current?.focus();
  }, [confirmed]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const value = email.trim();

    if (!value) {
      setError('Add an email so we know where to send the opening date.');
      inputRef.current?.focus();
      return;
    }
    if (!EMAIL.test(value)) {
      setError('That address does not look right. Check it and try again.');
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setPending(true);
    // A short, deliberate beat before the confirmation lands.
    timerRef.current = setTimeout(() => {
      setPending(false);
      setConfirmed(value);
    }, SETTLE_MS);
  }

  function reset() {
    setConfirmed(null);
    setEmail('');
    // Hand focus back to the field the confirmation replaced.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (confirmed) {
    return (
      <div
        ref={confirmRef}
        tabIndex={-1}
        className="fc-confirm max-w-xl outline-none"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="fc-confirm-mark inline-block h-[9px] w-[9px] bg-fc-green"
          />
          <p className="fc-label text-fc-green" role="status">
            Not open yet
          </p>
        </div>

        <span className="fc-confirm-rule stack-md block h-px bg-fc-green/45" />

        <p className="fc-display t-lead stack-lg text-fc-chalk">
          Thanks — the list opens with the site. Check back soon.
        </p>

        <button
          type="button"
          onClick={reset}
          className="fc-label mt-8 inline-block border-b border-fc-chalk/40 pb-1 text-fc-chalk/70 transition-colors hover:border-fc-green hover:text-fc-green"
        >
          Back to the form
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor={fieldId} className="fc-label block text-fc-green">
          Your email
        </label>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end">
          <input
            ref={inputRef}
            id={fieldId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            className="fc-field flex-1"
          />
          <button
            type="submit"
            data-pending={pending || undefined}
            aria-disabled={pending || undefined}
            className="fc-btn fc-label shrink-0 px-8 py-4"
          >
            <span>{pending ? 'One moment…' : 'Be first in the room'}</span>
          </button>
        </div>

        <p id={hintId} className="fc-body t-copy-sm stack-md text-fc-chalk/60">
          The list is not live yet — nothing is stored when you submit.
        </p>

        <p
          id={errorId}
          role="alert"
          className={`fc-body t-copy-sm stack-xs text-fc-red ${
            error ? '' : 'sr-only'
          }`}
        >
          {error}
        </p>
      </form>
    </div>
  );
}
