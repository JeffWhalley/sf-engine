import type { TurningResult } from '../engine';
import { formatTurningResult, type UnitSystem } from '../ui/format';
import type { Advisory } from '../ui/warnings';
import { Dro, Row } from './ResultsPanel';
import { WarningList } from './WarningList';

/** Phase 7 T4 — turning results in the DRO instrument style. */
export function TurningResults({ result, sys }: { result: TurningResult; sys: UnitSystem }) {
  const f = formatTurningResult(result, sys);
  const advisories: Advisory[] = result.warnings.map((message) => ({
    severity: 'warn' as const,
    message,
  }));
  return (
    <div className="panel space-y-3 p-3.5">
      <div className="flex gap-2">
        <Dro label="Spindle" reading={f.rpm} sub={result.rpmClamped ? 'clamped to machine max' : undefined} />
        <Dro label="Feed" reading={f.feed} />
      </div>
      <div>
        <Row label="Surface speed (achieved)" reading={f.achievedSfm} />
        <Row label="MRR" reading={f.mrr} />
        <Row label="Power (motor)" reading={f.powerAtMotor} />
        <Row label="Torque" reading={f.torque} />
        {f.ra && <Row label="Theoretical finish" reading={f.ra} />}
        {f.cssMinDiameter && (
          <Row label="CSS full-speed above Ø" reading={f.cssMinDiameter} />
        )}
      </div>
      {advisories.length > 0 && <WarningList items={advisories} />}
    </div>
  );
}
