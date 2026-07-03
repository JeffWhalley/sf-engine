import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import { useCalcStore, buildSelection } from '../store/useCalcStore';
import { getMachine } from '../data';
import { resolveMachine } from '../store/useLibraryStore';
import { buildPerformanceSweep } from '../ui/sweepData';
import { powerToDisplay, powerUnit, lengthUnit } from '../ui/format';
import { ipmToMmmin } from '../engine';

/**
 * Phase 9 T2 — performance sweep chart (milling): feed & motor power across
 * the aggressiveness range, current operating point marked. Invalid sweep
 * points render as gaps (lib/sweep contract).
 */
export function SweepChart() {
  const state = useCalcStore();
  const sys = state.unitSystem;
  const machine = resolveMachine(state.machineId) ?? getMachine('mill-vmc-20hp')!;

  const data = useMemo(() => {
    const sel = buildSelection(state);
    const s = buildPerformanceSweep(sel, machine);
    return s.points.map((p) => ({
      x: p.x,
      feed: p.feed_ipm === undefined ? undefined : sys === 'metric' ? ipmToMmmin(p.feed_ipm) : p.feed_ipm,
      power: p.motorPower_hp === undefined ? undefined : powerToDisplay(p.motorPower_hp, sys),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.materialId, state.toolId, state.machineId, state.overrides, state.ae_in, state.ap_in, sys, machine]);

  const feedUnit = sys === 'metric' ? 'mm/min' : 'in/min';

  return (
    <div className="panel p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="engraved text-[10px]">Feed &amp; power vs. aggressiveness</span>
        <span className="font-mono text-[10px] text-ink-3">
          {feedUnit} · {powerUnit(sys)} {lengthUnit(sys) === 'in' ? '' : ''}
        </span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
            <XAxis dataKey="x" tick={{ fontSize: 10 }} stroke="#5a6668" unit="%" />
            <YAxis yAxisId="feed" tick={{ fontSize: 10 }} stroke="#47c7bd" width={52} />
            <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 10 }} stroke="#d9a441" width={40} />
            <Tooltip
              contentStyle={{ background: '#1c2224', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
              labelFormatter={(x) => `aggressiveness ${x}%`}
            />
            <ReferenceLine yAxisId="feed" x={state.performance} stroke="#8b9598" strokeDasharray="3 3" />
            <Line yAxisId="feed" dataKey="feed" name={`feed (${feedUnit})`} dot={false} stroke="#47c7bd" strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
            <Line yAxisId="power" dataKey="power" name={`motor (${powerUnit(sys)})`} dot={false} stroke="#d9a441" strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 font-mono text-[10px] text-ink-3">
        Dashed line = current setting. Curves include machine clamps (flat feed = a limit is active).
      </p>
    </div>
  );
}
