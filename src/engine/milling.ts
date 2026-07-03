/**
 * Milling primitives and the computeMilling orchestrator. Plan §2.2–§2.4, §2.13.
 *
 * Phase 1 scope: pure calculation on resolved numeric inputs. No data lookups
 * (Phase 2) and no machine clamping (Phase 5). Those wrap this function later.
 */

import { assertPositive } from './validate';
import { radialChipThinningFactor, effectiveDiameter } from './chipThinning';
import { mrr, spindlePower, torqueFromPower, cuttingForce } from './power';
import { deflection, YOUNGS_MODULUS_PSI } from './deflection';
import type { MillingInput, MillingResult } from './types';

/** Spindle speed from surface speed. Plan §2.2.  RPM = (SFM * 12) / (π D) */
export function rpmFromSurfaceSpeed(sfm: number, diameter_in: number): number {
  assertPositive('sfm', sfm);
  assertPositive('diameter_in', diameter_in);
  return (sfm * 12) / (Math.PI * diameter_in);
}

/** Surface speed from spindle speed. Plan §2.4.  SFM = (RPM π D) / 12 */
export function surfaceSpeedFromRpm(rpm: number, diameter_in: number): number {
  assertPositive('rpm', rpm);
  assertPositive('diameter_in', diameter_in);
  return (rpm * Math.PI * diameter_in) / 12;
}

/** Table feed rate. Plan §2.3.  vf = RPM * Z * fz */
export function feedRate(rpm: number, flutes: number, chipload_in: number): number {
  assertPositive('rpm', rpm);
  assertPositive('flutes', flutes);
  assertPositive('chipload_in', chipload_in);
  return rpm * flutes * chipload_in;
}

/**
 * Full milling pipeline. Plan §2.13.
 *
 * Order of operations (matters):
 *   effective diameter -> RPM from Deff -> radial chip thinning -> feed
 *   -> MRR -> power -> torque -> force -> deflection.
 */
export function computeMilling(input: MillingInput): MillingResult {
  assertPositive('sfm', input.sfm);
  assertPositive('diameter_in', input.diameter_in);
  assertPositive('flutes', input.flutes);
  assertPositive('chipload_in', input.chipload_in);
  assertPositive('ae_in', input.ae_in);
  assertPositive('ap_in', input.ap_in);
  assertPositive('unitPower', input.unitPower);
  assertPositive('stickout_in', input.stickout_in);

  const efficiency = input.efficiency ?? 0.8;
  const fluteFactor = input.fluteFactor ?? 0.8;
  const kr = input.radialForceRatio ?? 0.4;
  const ceiling = input.rctfCeiling ?? 3.0;
  const E = input.youngsModulus_psi ?? YOUNGS_MODULUS_PSI[input.toolMaterial ?? 'carbide'];

  const Deff = effectiveDiameter(
    input.toolType,
    input.diameter_in,
    input.ap_in,
    input.cornerRadius_in,
  );

  const rpm = input.rpmOverride_rpm ?? rpmFromSurfaceSpeed(input.sfm, Deff);

  const rctf = radialChipThinningFactor(input.ae_in, input.diameter_in, ceiling);
  let chiploadAdj = input.chipload_in * rctf;
  let feed = feedRate(rpm, input.flutes, chiploadAdj);
  if (input.feedOverride_ipm != null) {
    // Feed capped by the machine: hold rpm, back-solve the achievable chip load.
    feed = input.feedOverride_ipm;
    chiploadAdj = feed / (rpm * input.flutes);
  }
  const mrrValue = mrr(input.ae_in, input.ap_in, feed);

  const power = spindlePower(mrrValue, input.unitPower, efficiency);
  const torque = torqueFromPower(power.cutting_hp, rpm);

  // Surface speed at the actual cutting point. Equals input.sfm when rpm is
  // derived from sfm; reflects the reduced speed when rpm is clamped (Phase 5).
  const vcut = surfaceSpeedFromRpm(rpm, Deff);
  const force = cuttingForce(power.cutting_hp, vcut, kr);

  const defl = deflection(force.radial_lbf, input.stickout_in, input.diameter_in, E, fluteFactor);

  return {
    sfm: vcut,
    effectiveDiameter_in: Deff,
    rpm,
    radialChipThinningFactor: rctf,
    chipload_in: chiploadAdj,
    feed_ipm: feed,
    mrr_in3min: mrrValue,
    cuttingPower_hp: power.cutting_hp,
    motorPower_hp: power.motor_hp,
    cuttingTorque_lbft: torque,
    tangentialForce_lbf: force.tangential_lbf,
    radialForce_lbf: force.radial_lbf,
    deflection_in: defl,
  };
}
