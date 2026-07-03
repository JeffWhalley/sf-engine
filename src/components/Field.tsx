import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="engraved text-[10px]">{label}</span>
        {hint && <span className="font-mono text-[10px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export interface Option {
  value: string;
  label: string;
}

export interface OptionGroup {
  label: string;
  options: Option[];
}

export function Select({
  value,
  onChange,
  options,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: Option[];
  groups?: OptionGroup[];
}) {
  return (
    <div className="relative">
      <select
        className="field-input cursor-pointer appearance-none pr-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3">
        ▾
      </span>
    </div>
  );
}
