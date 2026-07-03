import type { Machine, Tool, LimitedResult } from '../data';
import { formatResult, powerToDisplay, powerUnit, type Reading, type UnitSystem } from '../ui/format';
import type { Advisory } from '../ui/warnings';
import { WarningList } from './WarningList';
import { EngagementScope } from './EngagementScope';

export function Dro({ label, reading, sub }: { label: string; reading: Reading; sub?: string }) {
  return (
    <div className="inset flex-1 px-3 py-2.5">
      <div className="engraved mb-1 text-[10px]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-mono text-[32px] leading-none text-accent"
          style={{ textShadow: '0 0 14px rgba(71,199,189,0.35)' }}
        >
          {reading.value}
        </span>
        <span className="font-mono text-[11px] text-ink-3">{reading.unit}</span>
      </div>
      {sub && <div className="mt-1 font-mono text-[10px] text-warn/80">{sub}</div>}
    </div>
  );
}

export function Row({
  label,
  reading,
  tone,
}: {
  label: string;
  reading: Reading;
  tone?: 'warn' | 'danger';
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="flex items-baseline py-[5px]">
      <span className="engraved shrink-0 text-[10px]">{label}</span>
      <span className="mx-2 -translate-y-[2px] flex-1 border-b border-dotted border-hairline" />
      <span className={`shrink-0 font-mono text-[13px] ${color}`}>
        {reading.value}
        <span className="ml-1 text-[11px] text-ink-3">{reading.unit}</span>
      </span>
    </div>
  );
}

function PowerMeter({ motorHp, availHp, sys }: { motorHp: number; availHp: number; sys: UnitSystem }) {
  const frac = availHp > 0 ? motorHp / availHp : 0;
  const pct = Math.min(100, frac * 100);
  const over = motorHp > availHp + 1e-6;
  const near = !over && frac > 0.85;
  const color = over ? 'bg-danger' : near ? 'bg-warn' : 'bg-accent';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="engraved text-[10px]">Spindle load</span>
        <span className={`font-mono text-[11px] ${over ? 'text-danger' : 'text-ink-3'}`}>
          {powerToDisplay(motorHp, sys).toFixed(2)} / {powerToDisplay(availHp, sys).toFixed(1)}{' '}
          {powerUnit(sys)} avail
        </span>
      </div>
      <div className="inset h-2 overflow-hidden p-[2px]">
        <div className={`h-full rounded-sm ${color} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ResultsPanel({
  limited,
  machine,
  tool,
  ae_in,
  sys,
  warnings,
}: {
  limited: LimitedResult;
  machine: Machine;
  tool: Tool;
  ae_in: number;
  sys: UnitSystem;
  warnings: Advisory[];
}) {
  const { result, unclamped, clampedRpm, clampedFeed, availablePower_hp } = limited;
  const f = formatResult(result, sys);
  const req = formatResult(unclamped, sys);

  const powerTone = result.motorPower_hp > availablePower_hp + 1e-6 ? 'danger' : undefined;
  const deflTone = result.deflection_in > 0.001 ? 'warn' : undefined;
  const torqueTone =
    machine.maxTorque_lbft != null && result.cuttingTorque_lbft > machine.maxTorque_lbft
      ? 'warn'
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5">
        <Dro label="Spindle speed" reading={f.rpm} sub={clampedRpm ? `wanted ${req.rpm.value}` : undefined} />
        <Dro
          label="Feed rate"
          reading={f.feed}
          sub={clampedFeed ? `wanted ${req.feed.value} ${req.feed.unit}` : undefined}
        />
      </div>

      <PowerMeter motorHp={result.motorPower_hp} availHp={availablePower_hp} sys={sys} />

      <div className="panel px-3 py-1.5">
        <Row label="Surface speed" reading={f.sfm} />
        <Row label="Chip load · adj" reading={f.chipload} />
        <Row label="Removal rate" reading={f.mrr} />
        <Row label="Power · cutter" reading={f.cuttingPower} />
        <Row label="Power · motor" reading={f.motorPower} tone={powerTone} />
        <Row label="Cutting torque" reading={f.torque} tone={torqueTone} />
        <Row label="Cutting force" reading={f.force} />
        <Row label="Radial force" reading={f.radialForce} />
        <Row label="Deflection" reading={f.deflection} tone={deflTone} />
        <Row label="Effective Ø" reading={f.effectiveDiameter} />
        <Row label="Chip thinning" reading={f.thinningFactor} />
      </div>

      <EngagementScope result={result} tool={tool} ae_in={ae_in} sys={sys} />

      <WarningList items={warnings} />
    </div>
  );
}
