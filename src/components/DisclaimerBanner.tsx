import { useCalcStore } from '../store/useCalcStore';

export function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/[0.07] px-3 py-2">
      <span className="mt-[1px] select-none text-warn" aria-hidden>
        ⚠
      </span>
      <p className="text-[12px] leading-snug text-ink-2">
        <span className="font-semibold text-ink">Starting points, not guarantees.</span> Begin
        conservatively, verify against your tool manufacturer's data, and use judgment. Wear eye
        protection.
      </p>
    </div>
  );
}

export function UnitToggle() {
  const sys = useCalcStore((s) => s.unitSystem);
  const setSys = useCalcStore((s) => s.setUnitSystem);
  return (
    <div className="inset flex p-0.5 text-[12px]">
      {(['imperial', 'metric'] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => setSys(opt)}
          className={`rounded px-3 py-1 font-display uppercase tracking-wider transition-colors ${
            sys === opt ? 'bg-machined-hi text-ink' : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          {opt === 'imperial' ? 'in' : 'mm'}
        </button>
      ))}
    </div>
  );
}
