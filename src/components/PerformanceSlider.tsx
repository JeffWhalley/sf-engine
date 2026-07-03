import { useCalcStore } from '../store/useCalcStore';

function labelFor(p: number): string {
  if (p <= 25) return 'Conservative';
  if (p <= 60) return 'Balanced';
  if (p <= 85) return 'Aggressive';
  return 'Maximum';
}

export function PerformanceSlider() {
  const performance = useCalcStore((s) => s.performance);
  const setPerformance = useCalcStore((s) => s.setPerformance);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="engraved text-[10px]">Performance</span>
        <span className="font-display text-[12px] uppercase tracking-wider text-accent">
          {labelFor(performance)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={performance}
        onChange={(e) => setPerformance(Number(e.target.value))}
        className="sf-slider w-full"
        aria-label="Performance: conservative to aggressive"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3">
        <span>safe</span>
        <span>{performance}</span>
        <span>aggressive</span>
      </div>
    </div>
  );
}
