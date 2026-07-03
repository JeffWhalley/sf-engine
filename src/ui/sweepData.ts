/**
 * Phase 9 T2 — chart-ready sweep data (UI boundary, no React).
 * Built on lib/sweep so invalid points become gaps, not crashes.
 */

import { sweep, linspace } from '../lib/sweep';
import { calculateWithLimits } from '../data';
import type { MillingSelection } from '../data';
import type { Machine } from '../data';

export interface PerfSweepPoint {
  /** Aggressiveness 0..100. */
  x: number;
  feed_ipm?: number;
  motorPower_hp?: number;
  rpm?: number;
}

export interface PerfSweepData {
  points: PerfSweepPoint[];
  errorCount: number;
}

/** Sweep the performance slider 0→100 for the current milling selection. */
export function buildPerformanceSweep(
  sel: MillingSelection,
  machine: Machine,
  steps = 41,
): PerfSweepData {
  const xs = linspace(0, 100, steps);
  const s = sweep(
    sel,
    xs,
    (base, x) => ({ ...base, performance: x }),
    (input) => calculateWithLimits(input, machine).result,
  );
  return {
    points: s.points.map((p) => ({
      x: p.x,
      feed_ipm: p.result?.feed_ipm,
      motorPower_hp: p.result?.motorPower_hp,
      rpm: p.result?.rpm,
    })),
    errorCount: s.errorCount,
  };
}

// ---------------------------------------------------------------------------
// PLAN §8.4 — machine power/torque curve
// ---------------------------------------------------------------------------

import { availablePower } from '../data';

export interface MachineCurvePoint {
  rpm: number;
  /** Power available at this rpm, hp. */
  power_hp: number;
  /** Torque available at this rpm, lb·ft (5252 · hp / rpm). */
  torque_lbft: number;
}

/** Sample the machine's available power & torque across its RPM range. */
export function buildMachineCurve(machine: Machine, steps = 61): MachineCurvePoint[] {
  const xs = linspace(machine.minRpm, machine.maxRpm, steps);
  return xs.map((rpm) => {
    const power_hp = availablePower(machine, rpm);
    return { rpm, power_hp, torque_lbft: (5252 * power_hp) / rpm };
  });
}
