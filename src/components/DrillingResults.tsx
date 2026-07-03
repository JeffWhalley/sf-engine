import type { DrillingResult } from '../engine';
import { formatDrillingResult, type UnitSystem } from '../ui/format';
import type { Advisory } from '../ui/warnings';
import { Dro, Row } from './ResultsPanel';
import { WarningList } from './WarningList';

/** Phase 7 T4 — drilling results in the DRO instrument style. */
export function DrillingResults({ result, sys }: { result: DrillingResult; sys: UnitSystem }) {
  const f = formatDrillingResult(result, sys);
  const advisories: Advisory[] = [
    ...result.warnings.map((message) => ({ severity: 'warn' as const, message })),
    { severity: 'info' as const, message: result.peck.note },
  ];
  return (
    <div className="panel space-y-3 p-3.5">
      <div className="flex gap-2">
        <Dro label="Spindle" reading={f.rpm} sub={result.rpmClamped ? 'clamped to machine max' : undefined} />
        <Dro label="Feed" reading={f.feed} />
      </div>
      <div>
        <Row label="MRR" reading={f.mrr} />
        <Row label="Power (motor)" reading={f.powerAtMotor} />
        <Row label="Torque" reading={f.torque} />
        {f.thrust && <Row label="Thrust (est. ±50%)" reading={f.thrust} />}
        {f.peckDepth && <Row label="Peck depth" reading={f.peckDepth} />}
      </div>
      <WarningList items={advisories} />
    </div>
  );
}
