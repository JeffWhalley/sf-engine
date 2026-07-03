/**
 * Turning engine — Phase 7, T2 (LAUNCH-PLAN.md §4 / PLAN.md §7).
 *
 * Pure, imperial-canonical, throws EngineError on invalid input, never emits
 * non-finite numbers. Takes RESOLVED numbers (data layer picks SFM / feed /
 * DOC windows); this module does the physics.
 *
 * ── Formulas (worked example: Golden Vector T-A, tested) ───────────────────
 * 1018 steel, carbide insert, SFM 400, workpiece Ø 2.000", feed 0.010 in/rev,
 * DOC 0.100", nose radius 1/32" (0.03125), unit power 1.0 hp·min/in³.
 *
 *   RPM     = 12·SFM / (π·D)      = 12·400 / (π·2)        = 763.94 rev/min
 *   feed    = RPM·f               = 763.94·0.010          = 7.6394 IPM
 *   MRR     = 12·Vc·f·DOC         = 12·400·0.010·0.100    = 4.8000 in³/min
 *   P_cut   = MRR·unitPower       = 4.8·1.0               = 4.8000 hp
 *   torque  = 63025·P / RPM       = 63025·4.8 / 763.94    = 396.03 in·lbf
 *   Ra_theo = f² / (32·r)         = 0.0001 / 1.0          = 100 µin
 *
 * Constant surface speed (CSS/G96): RPM above is for the CURRENT diameter.
 * As diameter shrinks (facing, successive passes) RPM must rise to hold SFM;
 * we report the RPM at which the machine ceiling caps SFM so the UI can show
 * "full surface speed only above Ø X".
 */

import { EngineError, requirePositive, requireNonNegative } from './validate';
import { torqueFromHp } from './drilling';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TurningInput {
  /** Resolved surface speed, ft/min. */
  sfm: number;
  /** Workpiece diameter at the cut, inches. */
  workpieceDiameter_in: number;
  /** Feed per revolution, in/rev. */
  ipr: number;
  /** Depth of cut (radial, per side), inches. */
  doc_in: number;
  /** Insert nose radius, inches — enables the finish estimate. */
  noseRadius_in?: number;
  /** Material unit power, hp·min/in³. */
  unitPower_hpMinIn3: number;
  /** Machine drive efficiency 0..1 (default 0.85). */
  efficiency?: number;
  /** Spindle ceiling; RPM (and thus achieved SFM) clamped, warning emitted. */
  maxRpm?: number;
}

export interface TurningResult {
  rpm: number;
  rpmClamped: boolean;
  /** Surface speed actually achieved after any clamp, ft/min. */
  achievedSfm: number;
  feed_ipm: number;
  mrr_in3PerMin: number;
  powerAtCutter_hp: number;
  powerAtMotor_hp: number;
  torque_inLbf: number;
  /** Theoretical surface finish, µin Ra (undefined without nose radius). */
  raTheoretical_uin?: number;
  /**
   * With CSS: below this workpiece diameter the machine ceiling caps surface
   * speed (undefined when no maxRpm given).
   */
  cssFullSpeedMinDiameter_in?: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** RPM = 12·SFM / (π·D) — same relation as milling/drilling. */
export function turnRpm(sfm: number, diameter_in: number): number {
  requirePositive(sfm, 'sfm');
  requirePositive(diameter_in, 'workpieceDiameter_in');
  return (12 * sfm) / (Math.PI * diameter_in);
}

/** MRR = 12 · Vc(ft/min) · f(in/rev) · DOC(in), in³/min. */
export function turnMrr(sfm: number, ipr: number, doc_in: number): number {
  requirePositive(sfm, 'sfm');
  requirePositive(ipr, 'ipr');
  requirePositive(doc_in, 'doc_in');
  return 12 * sfm * ipr * doc_in;
}

/**
 * Theoretical surface finish for a round-nose insert:
 * Ra ≈ f² / (32·r), returned in µin. Real finish is worse (BUE, vibration,
 * wear) — label as "best case" in the UI.
 */
export function raTheoretical_uin(ipr: number, noseRadius_in: number): number {
  requirePositive(ipr, 'ipr');
  requirePositive(noseRadius_in, 'noseRadius_in');
  return ((ipr * ipr) / (32 * noseRadius_in)) * 1_000_000;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const DEFAULT_EFFICIENCY = 0.85;

export function computeTurning(input: TurningInput): TurningResult {
  const {
    sfm,
    workpieceDiameter_in,
    ipr,
    doc_in,
    noseRadius_in,
    unitPower_hpMinIn3,
    efficiency = DEFAULT_EFFICIENCY,
    maxRpm,
  } = input;

  requirePositive(unitPower_hpMinIn3, 'unitPower_hpMinIn3');
  if (efficiency <= 0 || efficiency > 1 || !Number.isFinite(efficiency)) {
    throw new EngineError(`efficiency must be in (0, 1], got ${efficiency}`);
  }
  if (maxRpm !== undefined) requirePositive(maxRpm, 'maxRpm');

  const warnings: string[] = [];

  const idealRpm = turnRpm(sfm, workpieceDiameter_in);
  let rpm = idealRpm;
  let rpmClamped = false;
  if (maxRpm !== undefined && idealRpm > maxRpm) {
    rpm = maxRpm;
    rpmClamped = true;
  }
  // Achieved surface speed after any clamp (this drives MRR/power).
  const achievedSfm = (Math.PI * workpieceDiameter_in * rpm) / 12;
  if (rpmClamped) {
    warnings.push(
      `Machine max RPM caps surface speed at ${Math.round(achievedSfm)} SFM ` +
        `(target ${Math.round(sfm)}) at Ø ${workpieceDiameter_in.toFixed(3)}". ` +
        `Expect reduced tool life predictability; feed per rev is unchanged.`,
    );
  }

  const feed_ipm = rpm * requirePositive(ipr, 'ipr');
  const mrr = turnMrr(achievedSfm, ipr, doc_in);
  const powerAtCutter = mrr * unitPower_hpMinIn3;
  const powerAtMotor = powerAtCutter / efficiency;
  const torque = torqueFromHp(powerAtCutter, rpm);

  let ra: number | undefined;
  if (noseRadius_in !== undefined) {
    ra = raTheoretical_uin(ipr, noseRadius_in);
    // Rule of thumb: keep feed ≤ ~½ the nose radius or finish/edge suffer.
    if (ipr > noseRadius_in / 2) {
      warnings.push(
        'Feed per rev exceeds half the nose radius — expect poor finish and ' +
          'edge loading; drop feed or use a larger nose radius for finishing.',
      );
    }
  }

  // CSS helper: below what diameter does maxRpm cap the requested SFM?
  const cssFullSpeedMinDiameter_in =
    maxRpm !== undefined ? (12 * sfm) / (Math.PI * maxRpm) : undefined;

  requireNonNegative(doc_in, 'doc_in');

  const result: TurningResult = {
    rpm,
    rpmClamped,
    achievedSfm,
    feed_ipm,
    mrr_in3PerMin: mrr,
    powerAtCutter_hp: powerAtCutter,
    powerAtMotor_hp: powerAtMotor,
    torque_inLbf: torque,
    raTheoretical_uin: ra,
    cssFullSpeedMinDiameter_in,
    warnings,
  };

  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new EngineError(`internal: non-finite ${k}`);
    }
  }
  return result;
}
