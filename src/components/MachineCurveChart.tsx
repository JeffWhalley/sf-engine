import { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceDot, CartesianGrid,
} from 'recharts';
import { useCalcStore } from '../store/useCalcStore';
import { getMachine, availablePower } from '../data';
import { resolveMachine } from '../store/useLibraryStore';
import { buildMachineCurve } from '../ui/sweepData';
import { powerToDisplay, powerUnit } from '../ui/format';
import { lbftToNm } from '../engine';

/**
 * PLAN §8.4 — the selected machine's available power & torque vs RPM, with
 * the current operating point marked.
 */
export function MachineCurveChart({ rpm, motorHp }: { rpm?: number; motorHp?: number }) {
  const machineId = useCalcStore((s) => s.machineId);
  const sys = useCalcStore((s) => s.unitSystem);
  const machine = resolveMachine(machineId) ?? getMachine('mill-vmc-20hp')!;

  const data = useMemo(
    () =>
      buildMachineCurve(machine).map((p) => ({
        rpm: Math.round(p.rpm),
        power: powerToDisplay(p.power_hp, sys),
        torque: sys === 'metric' ? lbftToNm(p.torque_lbft) : p.torque_lbft,
      })),
    [machine, sys],
  );
  const torqueUnit = sys === 'metric' ? 'N·m' : 'lb·ft';
  const opPower =
    rpm !== undefined && motorHp !== undefined ? powerToDisplay(motorHp, sys) : undefined;
  const availAtOp = rpm !== undefined ? powerToDisplay(availablePower(machine, rpm), sys) : undefined;

  return (
    <div className="panel p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="engraved text-[10px]">Machine envelope — {machine.name}</span>
        <span className="font-mono text-[10px] text-ink-3">{powerUnit(sys)} · {torqueUnit}</span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
            <XAxis dataKey="rpm" tick={{ fontSize: 10 }} stroke="#5a6668" type="number"
              domain={[machine.minRpm, machine.maxRpm]} allowDataOverflow />
            <YAxis yAxisId="power" tick={{ fontSize: 10 }} stroke="#47c7bd" width={46} />
            <YAxis yAxisId="torque" orientation="right" tick={{ fontSize: 10 }} stroke="#d9a441" width={44} />
            <Tooltip
              contentStyle={{ background: '#1c2224', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
              labelFormatter={(x) => `${Number(x).toLocaleString()} rpm`}
            />
            <Line yAxisId="power" dataKey="power" name={`avail. power (${powerUnit(sys)})`}
              dot={false} stroke="#47c7bd" strokeWidth={1.5} isAnimationActive={false} />
            <Line yAxisId="torque" dataKey="torque" name={`avail. torque (${torqueUnit})`}
              dot={false} stroke="#d9a441" strokeWidth={1.5} isAnimationActive={false} />
            {rpm !== undefined && opPower !== undefined && (
              <ReferenceDot yAxisId="power" x={Math.round(rpm)} y={opPower} r={4}
                fill="#47c7bd" stroke="#0f1415" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {rpm !== undefined && opPower !== undefined && availAtOp !== undefined && (
        <p className="mt-1 font-mono text-[10px] text-ink-3">
          Operating point: {Math.round(rpm).toLocaleString()} rpm — drawing {opPower.toFixed(2)} of{' '}
          {availAtOp.toFixed(2)} {powerUnit(sys)} available.
        </p>
      )}
    </div>
  );
}
