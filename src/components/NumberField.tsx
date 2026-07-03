import { useEffect, useRef, useState } from 'react';

/**
 * Numeric input that allows transient empty/invalid text while typing without
 * pushing junk into the store. Commits only valid values > minExclusive; on
 * invalid input it shows a red border and the store keeps the last good value.
 */
export function NumberField({
  value,
  unit,
  onCommit,
  minExclusive = 0,
  step = 0.001,
  digits = 3,
  onUnitClick,
}: {
  value: number;
  unit: string;
  onCommit: (v: number) => void;
  minExclusive?: number;
  step?: number;
  digits?: number;
  /** When set, the unit suffix becomes a click target (per-field unit toggle). */
  onUnitClick?: () => void;
}) {
  const [text, setText] = useState(() => value.toFixed(digits));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  // Sync from external changes (unit toggle, strategy buttons, tool change)
  // unless the user is actively editing this field.
  useEffect(() => {
    if (!focused.current) {
      setText(value.toFixed(digits));
      setInvalid(false);
    }
  }, [value, digits]);

  function handleChange(raw: string) {
    setText(raw);
    const parsed = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(parsed) || parsed <= minExclusive) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onCommit(parsed);
  }

  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        className={`field-input pr-12 ${invalid ? 'invalid' : ''}`}
        value={text}
        step={step}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setText(value.toFixed(digits));
          setInvalid(false);
        }}
        onChange={(e) => handleChange(e.target.value)}
      />
      {onUnitClick ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={onUnitClick}
          title="Switch this field between in and mm"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-0.5 font-mono text-[11px] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          {unit}
        </button>
      ) : (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-3">
          {unit}
        </span>
      )}
    </div>
  );
}
