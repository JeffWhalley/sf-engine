/**
 * Drilling engine — Phase 7, T1 (LAUNCH-PLAN.md §4 / PLAN.md §7).
 *
 * Pure functions, imperial-canonical (same rules as src/engine/milling.ts):
 *   - inputs/outputs in inches, ft/min (SFM), in/rev (IPR), in/min (IPM),
 *     hp, in·lbf, lbf.
 *   - Metric conversion happens at the UI boundary via units.convert().
 *   - Invalid input throws EngineError; results are never non-finite.
 *
 * Data resolution (which SFM / IPR for a material+drill) belongs to the data
 * layer (src/data/resolve.ts). This module takes RESOLVED numbers only.
 * A seed IPR-by-diameter table is provided at the bottom for the data layer
 * to adopt (marked SEED DATA).
 *
 * ── Formulas (with worked example: Golden Vector D-A, tested) ──────────────
 * 1/2" (0.500) HSS twist drill, 6061 aluminum, SFM 250, IPR 0.008,
 * unit power 0.25 hp·min/in³, Kc 700 N/mm², hole depth 2.0".
 *
 *   RPM    = 12·SFM / (π·D)          = 12·250 / (π·0.5)      = 1909.86 rev/min
 *   feed   = RPM·IPR                 = 1909.86·0.008         = 15.279 IPM
 *   MRR    = (π/4)·D²·feed           = 0.19635·15.279        = 3.0000 in³/min
 *   P_cut  = MRR·unitPower           = 3.0·0.25              = 0.7500 hp
 *   torque = 63025·P_cut / RPM       = 63025·0.75 / 1909.86  = 24.75 in·lbf
 *   thrust ≈ Kthrust·Kc·(IPR·D/2)  (see thrustEstimate docs)
 *          = 1.0·700 N/mm² · (0.2032 mm · 12.7 mm / 2) = 903.2 N = 203.1 lbf
 *   depth/D = 2.0/0.5 = 4.0 → peck drilling suggested, peck ≈ 1.0·D = 0.500"
 */

import { EngineError, requirePositive, requireNonNegative } from './validate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DrillingInput {
  /** Resolved surface speed for material × drill material, ft/min. */
  sfm: number;
  /** Drill diameter, inches. */
  diameter_in: number;
  /** Resolved feed per revolution, in/rev. */
  ipr: number;
  /** Hole depth, inches (0 or omitted = through/unknown; skips peck advice). */
  holeDepth_in?: number;
  /** Material unit power, hp·min/in³ (same figure the milling path uses). */
  unitPower_hpMinIn3: number;
  /** Specific cutting force Kc, N/mm² — enables the thrust estimate. */
  kc_nPerMm2?: number;
  /** Machine drive efficiency 0..1 for motor-side power (default 0.85). */
  efficiency?: number;
  /** Optional spindle ceiling; RPM is clamped and a warning emitted. */
  maxRpm?: number;
}

export interface PeckAdvice {
  needed: boolean;
  /** Suggested peck depth, inches (present iff needed). */
  peckDepth_in?: number;
  note: string;
}

export interface DrillingResult {
  rpm: number;
  /** True if rpm was clamped to maxRpm. */
  rpmClamped: boolean;
  feed_ipm: number;
  mrr_in3PerMin: number;
  powerAtCutter_hp: number;
  powerAtMotor_hp: number;
  torque_inLbf: number;
  /** Rough thrust estimate, lbf. Undefined when kc not supplied. */
  thrust_lbf?: number;
  peck: PeckAdvice;
  /** Advisory strings, same spirit as milling warnings (never blocks). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Primitives (exported for reuse/tests)
// ---------------------------------------------------------------------------

/** Spindle speed from surface speed. RPM = 12·SFM / (π·D). */
export function drillRpm(sfm: number, diameter_in: number): number {
  requirePositive(sfm, 'sfm');
  requirePositive(diameter_in, 'diameter_in');
  return (12 * sfm) / (Math.PI * diameter_in);
}

/** Linear feed. IPM = RPM · IPR. */
export function drillFeed(rpm: number, ipr: number): number {
  requirePositive(rpm, 'rpm');
  requirePositive(ipr, 'ipr');
  return rpm * ipr;
}

/** Material removal rate for a full-diameter hole. MRR = (π/4)·D²·IPM. */
export function drillMrr(diameter_in: number, feed_ipm: number): number {
  requirePositive(diameter_in, 'diameter_in');
  requirePositive(feed_ipm, 'feed_ipm');
  return (Math.PI / 4) * diameter_in * diameter_in * feed_ipm;
}

/** Spindle torque from power. T(in·lbf) = 63025 · hp / RPM. */
export function torqueFromHp(power_hp: number, rpm: number): number {
  requireNonNegative(power_hp, 'power_hp');
  requirePositive(rpm, 'rpm');
  return (63025 * power_hp) / rpm;
}

const N_PER_LBF = 4.448_221_6;
const MM_PER_IN = 25.4;

/**
 * Rough drilling thrust estimate.
 *
 * Model: total undeformed chip area across both lips = IPR · D / 2 (each lip
 * cuts IPR/2 over radius D/2). Tangential-equivalent force = Kc · area; the
 * axial (thrust) component — chisel-edge extrusion plus lip axial component at
 * a ~118° point — is taken as Kthrust × that figure, Kthrust default 1.0.
 *
 * This is a STARTING-POINT estimate (±50%): real thrust varies with point
 * geometry, web thickness, wear, and coolant. Good enough to warn about
 * small/weak machines and thin workholding; not good enough for fixture
 * engineering. Surface this caveat in the UI.
 */
export function thrustEstimate(
  kc_nPerMm2: number,
  ipr: number,
  diameter_in: number,
  kThrust = 1.0,
): number {
  requirePositive(kc_nPerMm2, 'kc_nPerMm2');
  requirePositive(ipr, 'ipr');
  requirePositive(diameter_in, 'diameter_in');
  requirePositive(kThrust, 'kThrust');
  const f_mm = ipr * MM_PER_IN;
  const d_mm = diameter_in * MM_PER_IN;
  const areaTotal_mm2 = (f_mm * d_mm) / 2;
  const newtons = kThrust * kc_nPerMm2 * areaTotal_mm2;
  return newtons / N_PER_LBF;
}

/**
 * Peck-cycle advice by depth-to-diameter ratio (conventional practice):
 *   depth ≤ 3·D  → no peck needed
 *   3–5·D        → peck ≈ 1.0·D
 *   > 5·D        → peck ≈ 0.6·D; recommend parabolic-flute drill + coolant
 */
export function suggestPeck(diameter_in: number, holeDepth_in: number): PeckAdvice {
  requirePositive(diameter_in, 'diameter_in');
  requireNonNegative(holeDepth_in, 'holeDepth_in');
  if (holeDepth_in === 0) {
    return { needed: false, note: 'Hole depth not given — peck advice skipped.' };
  }
  const ratio = holeDepth_in / diameter_in;
  if (ratio <= 3) {
    return { needed: false, note: `Depth ${ratio.toFixed(1)}×D — no peck required.` };
  }
  if (ratio <= 5) {
    return {
      needed: true,
      peckDepth_in: 1.0 * diameter_in,
      note: `Depth ${ratio.toFixed(1)}×D — peck about 1×D to clear chips.`,
    };
  }
  return {
    needed: true,
    peckDepth_in: 0.6 * diameter_in,
    note:
      `Deep hole (${ratio.toFixed(1)}×D) — peck about 0.6×D; consider a ` +
      `parabolic-flute drill and through/flood coolant.`,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const DEFAULT_EFFICIENCY = 0.85;
/** Below this diameter, recommend spotting/center drilling first. */
const SPOT_DRILL_BELOW_IN = 0.125;

export function computeDrilling(input: DrillingInput): DrillingResult {
  const {
    sfm,
    diameter_in,
    ipr,
    holeDepth_in = 0,
    unitPower_hpMinIn3,
    kc_nPerMm2,
    efficiency = DEFAULT_EFFICIENCY,
    maxRpm,
  } = input;

  requirePositive(unitPower_hpMinIn3, 'unitPower_hpMinIn3');
  requireNonNegative(holeDepth_in, 'holeDepth_in');
  if (efficiency <= 0 || efficiency > 1 || !Number.isFinite(efficiency)) {
    throw new EngineError(`efficiency must be in (0, 1], got ${efficiency}`);
  }
  if (maxRpm !== undefined) requirePositive(maxRpm, 'maxRpm');

  const warnings: string[] = [];

  let rpm = drillRpm(sfm, diameter_in);
  let rpmClamped = false;
  if (maxRpm !== undefined && rpm > maxRpm) {
    rpm = maxRpm;
    rpmClamped = true;
    warnings.push(
      `Spindle limited: ideal RPM exceeds machine max — clamped to ${Math.round(maxRpm)}. ` +
        `Surface speed is reduced accordingly.`,
    );
  }

  const feed_ipm = drillFeed(rpm, ipr);
  const mrr = drillMrr(diameter_in, feed_ipm);
  const powerAtCutter = mrr * unitPower_hpMinIn3;
  const powerAtMotor = powerAtCutter / efficiency;
  const torque = torqueFromHp(powerAtCutter, rpm);
  const thrust = kc_nPerMm2 !== undefined
    ? thrustEstimate(kc_nPerMm2, ipr, diameter_in)
    : undefined;

  if (diameter_in < SPOT_DRILL_BELOW_IN) {
    warnings.push(
      'Small drill (< 1/8") — spot or center drill first and reduce feed 20–30% ' +
        'if the setup is anything but rigid.',
    );
  }
  if (thrust !== undefined && thrust > 500) {
    warnings.push(
      `Estimated thrust ≈ ${Math.round(thrust)} lbf — verify workholding and ` +
        `machine quill/Z axis can take it.`,
    );
  }

  const peck = suggestPeck(diameter_in, holeDepth_in);

  const result: DrillingResult = {
    rpm,
    rpmClamped,
    feed_ipm,
    mrr_in3PerMin: mrr,
    powerAtCutter_hp: powerAtCutter,
    powerAtMotor_hp: powerAtMotor,
    torque_inLbf: torque,
    thrust_lbf: thrust,
    peck,
    warnings,
  };

  // Repo hard rule: never leak a non-finite number.
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new EngineError(`internal: non-finite ${k}`);
    }
  }
  return result;
}
