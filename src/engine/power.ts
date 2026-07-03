/**
 * Material removal, power, torque, and cutting force. Plan §2.7–§2.10.
 */

import { assertPositive } from './validate';

/** Material removal rate, in³/min. Plan §2.7.  MRR = ae * ap * vf */
export function mrr(ae_in: number, ap_in: number, feed_ipm: number): number {
  assertPositive('ae_in', ae_in);
  assertPositive('ap_in', ap_in);
  assertPositive('feed_ipm', feed_ipm);
  return ae_in * ap_in * feed_ipm;
}

export interface SpindlePower {
  /** Power at the cutter, hp. */
  cutting_hp: number;
  /** Power required at the motor, hp. */
  motor_hp: number;
}

/**
 * Spindle power from MRR and material unit power. Plan §2.8.
 *   P_cut   = MRR * unitPower
 *   P_motor = P_cut / efficiency
 */
export function spindlePower(
  mrr_in3min: number,
  unitPower_hpminin3: number,
  efficiency = 0.8,
): SpindlePower {
  assertPositive('mrr_in3min', mrr_in3min);
  assertPositive('unitPower_hpminin3', unitPower_hpminin3);
  assertPositive('efficiency', efficiency);

  const cutting = mrr_in3min * unitPower_hpminin3;
  return { cutting_hp: cutting, motor_hp: cutting / efficiency };
}

/**
 * Cutting power via the metric Kienzle/Kc path, kW. Plan §2.8 cross-check.
 *   P_kW = (ae * ap * vf * kc) / (60e6)   [mm, mm, mm/min, N/mm²]
 * Provided for validation against the unit-power path; not used by the
 * default milling pipeline.
 */
export function spindlePowerMetricKc(
  ae_mm: number,
  ap_mm: number,
  feed_mmmin: number,
  kc_Nmm2: number,
): number {
  assertPositive('ae_mm', ae_mm);
  assertPositive('ap_mm', ap_mm);
  assertPositive('feed_mmmin', feed_mmmin);
  assertPositive('kc_Nmm2', kc_Nmm2);
  return (ae_mm * ap_mm * feed_mmmin * kc_Nmm2) / 60e6;
}

/** Torque from power and speed. Plan §2.9.  T(lb-ft) = (hp * 5252) / rpm */
export function torqueFromPower(power_hp: number, rpm: number): number {
  assertPositive('power_hp', power_hp);
  assertPositive('rpm', rpm);
  return (power_hp * 5252) / rpm;
}

export interface CuttingForces {
  tangential_lbf: number;
  radial_lbf: number;
}

/**
 * Average cutting forces from cutting power and surface speed. Plan §2.10.
 *   Ft = (P_cut_hp * 33000) / Vcut_ftmin
 *   Fr = radialForceRatio * Ft
 *
 * @param surfaceSpeed_ftmin surface speed at the cutting point (= SFM when RPM
 *        was derived from the effective diameter).
 */
export function cuttingForce(
  cuttingPower_hp: number,
  surfaceSpeed_ftmin: number,
  radialForceRatio = 0.4,
): CuttingForces {
  assertPositive('cuttingPower_hp', cuttingPower_hp);
  assertPositive('surfaceSpeed_ftmin', surfaceSpeed_ftmin);
  assertPositive('radialForceRatio', radialForceRatio);

  const tangential = (cuttingPower_hp * 33000) / surfaceSpeed_ftmin;
  return { tangential_lbf: tangential, radial_lbf: radialForceRatio * tangential };
}
