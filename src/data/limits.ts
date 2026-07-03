/**
 * Phase 5 — machine limits, clamping, and DOC/WOC balancing. PLAN §5.
 *
 * Decisions (which rpm/feed/engagement) live here; the actual milling formulas
 * stay in the engine (called via computeMilling with overrides). This keeps the
 * engine the single source of truth for the physics.
 */

import { computeMilling, assessLongTool } from '../engine';
import type { LongToolAssessment } from '../engine';
import type { MillingResult } from '../engine';
import type { Machine } from './types';
import { resolveMillingInput, type MillingSelection } from './resolve';

/**
 * Available spindle power at a given rpm. Below baseRpm the spindle is
 * torque-limited, so available power falls off linearly. PLAN §3.3.
 */
export function availablePower(machine: Machine, rpm: number): number {
  if (machine.baseRpm == null || rpm >= machine.baseRpm) return machine.maxPower_hp;
  return machine.maxPower_hp * (rpm / machine.baseRpm);
}

/**
 * Cap the performance position by machine rigidity so light machines can't be
 * pushed to the aggressive end. PLAN §5.2.
 */
export function capPerformance(performance: number, rigidity?: Machine['rigidity']): number {
  if (rigidity === 'light') return Math.min(performance, 70);
  if (rigidity === 'medium') return Math.min(performance, 90);
  return performance; // 'rigid' or unspecified: no cap
}

/**
 * Chip-load derating by machine rigidity — light frames chatter long before
 * they run out of power, so power-fitting alone is not enough. Judgment call
 * (**[HUMAN] review, standing rule 6**): light 0.6 / medium 0.85 / rigid 1.0.
 */
export const RIGIDITY_FEED_FACTOR: Record<NonNullable<Machine['rigidity']>, number> = {
  light: 0.6,
  medium: 0.85,
  rigid: 1.0,
};

/** Power-fit targets this fraction of available power (headroom for wear/dull tools). */
export const POWER_FIT_TARGET = 0.9;
/** Never auto-cut feed below this fraction of the request — past that, re-fixture/re-cut. */
const POWER_FIT_FLOOR = 0.1;

function nearestDiscrete(rpms: number[], desired: number): number {
  let best = rpms[0];
  let bestDiff = Math.abs(rpms[0] - desired);
  for (const r of rpms) {
    const d = Math.abs(r - desired);
    if (d < bestDiff) {
      best = r;
      bestDiff = d;
    }
  }
  return best;
}

export interface LimitedResult {
  /** Clamped, achievable result (what the machine can actually do). */
  result: MillingResult;
  /** The unclamped request (what was asked for). */
  unclamped: MillingResult;
  clampedRpm: boolean;
  clampedFeed: boolean;
  /** True when feed was auto-reduced to fit available spindle power. */
  clampedPower: boolean;
  /** Power available at the clamped rpm, hp. */
  availablePower_hp: number;
  /** Effective performance if rigidity capped it, else null. */
  performanceCappedTo: number | null;
  /** Phase 7 T3 — long-tool / reduced-shank derating that was applied. */
  longTool?: LongToolAssessment;
}

/** Run the calculation and clamp it to the machine's capabilities. PLAN §5.1. */
export function calculateWithLimits(sel: MillingSelection, machine: Machine): LimitedResult {
  const requested = sel.performance ?? 50;
  const effPerf = capPerformance(requested, machine.rigidity);
  const performanceCappedTo = effPerf < requested ? effPerf : null;

  // Phase 7 T3 — long-tool / reduced-shank derating, applied to the resolved
  // request BEFORE machine clamping (it is tool physics, not a machine limit).
  const longTool = assessLongTool({
    stickout_in: sel.tool.stickout_in,
    diameter_in: sel.tool.diameter_in,
    shankDiameter_in: sel.tool.shankDiameter_in,
  });
  const resolved = resolveMillingInput({ ...sel, machine, performance: effPerf });
  const rigidityFactor = RIGIDITY_FEED_FACTOR[machine.rigidity ?? 'rigid'];
  const input = {
    ...resolved,
    sfm: resolved.sfm * longTool.rpmFactor,
    chipload_in: resolved.chipload_in * longTool.feedFactor * rigidityFactor,
    ap_in: resolved.ap_in * longTool.apFactor,
  };
  const unclamped = computeMilling(input);

  // --- RPM: snap to discrete speeds, then clamp to [minRpm, maxRpm] ---
  let targetRpm = unclamped.rpm;
  let clampedRpm = false;
  if (machine.discreteRpms && machine.discreteRpms.length > 0) {
    const snapped = nearestDiscrete(machine.discreteRpms, targetRpm);
    if (Math.abs(snapped - targetRpm) > 0.5) {
      targetRpm = snapped;
      clampedRpm = true;
    }
  }
  if (targetRpm > machine.maxRpm) {
    targetRpm = machine.maxRpm;
    clampedRpm = true;
  } else if (targetRpm < machine.minRpm) {
    targetRpm = machine.minRpm;
    clampedRpm = true;
  }

  let result = clampedRpm ? computeMilling({ ...input, rpmOverride_rpm: targetRpm }) : unclamped;

  // --- Feed: cap to the machine's max table feed ---
  let clampedFeed = false;
  if (result.feed_ipm > machine.maxFeed_ipm) {
    result = computeMilling({
      ...input,
      rpmOverride_rpm: targetRpm,
      feedOverride_ipm: machine.maxFeed_ipm,
    });
    clampedFeed = true;
  }

  // --- Power: auto-reduce feed so the cut actually fits the spindle. ---
  // Motor power is ∝ MRR ∝ feed at fixed rpm/engagement, so a linear scale
  // lands on target in one step.
  let clampedPower = false;
  const avail = availablePower(machine, result.rpm);
  if (result.motorPower_hp > avail) {
    const scale = Math.max(POWER_FIT_FLOOR, (avail * POWER_FIT_TARGET) / result.motorPower_hp);
    result = computeMilling({
      ...input,
      rpmOverride_rpm: result.rpm,
      feedOverride_ipm: result.feed_ipm * scale,
    });
    clampedPower = true;
  }

  return {
    result,
    unclamped,
    clampedRpm,
    clampedFeed,
    clampedPower,
    availablePower_hp: avail,
    performanceCappedTo,
    longTool,
  };
}

/**
 * Balance engagement against available power. PLAN §5.3.
 *  - hold 'woc'  → vary axial depth (ap) to hit available power  ("Maximize DOC")
 *  - hold 'doc'  → vary radial width (ae) to hit available power  ("Maximize WOC")
 * Returns both dimensions; the caller applies the one that changed.
 * Motor power increases monotonically with engagement, so we bisect.
 */
export function fitEngagement(
  sel: MillingSelection,
  machine: Machine,
  hold: 'woc' | 'doc',
): { ae_in: number; ap_in: number } {
  const varyDoc = hold === 'woc';
  const lo = 0.01 * sel.tool.diameter_in;
  const hi = Math.max(lo * 1.001, varyDoc ? sel.tool.fluteLength_in : sel.tool.diameter_in);

  const excessPowerAt = (x: number): number => {
    const trial = varyDoc ? { ...sel, ap_in: x } : { ...sel, ae_in: x };
    const lim = calculateWithLimits(trial, machine);
    return lim.result.motorPower_hp - lim.availablePower_hp;
  };

  let a = lo;
  let b = hi;
  let x: number;
  if (excessPowerAt(a) >= 0) {
    x = a; // even minimal engagement over-powers → back off to minimum
  } else if (excessPowerAt(b) <= 0) {
    x = b; // full engagement still within power → use the geometric maximum
  } else {
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      if (excessPowerAt(m) > 0) b = m;
      else a = m;
    }
    x = (a + b) / 2;
  }

  return varyDoc ? { ae_in: sel.ae_in, ap_in: x } : { ae_in: x, ap_in: sel.ap_in };
}
