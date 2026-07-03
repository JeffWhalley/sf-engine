/**
 * Display formatting at the UI boundary. The engine is imperial-canonical; these
 * helpers convert numbers for display and parse user input back to canonical inches.
 */

import type { MillingResult, DrillingResult, TurningResult } from '../engine';
import { inToMm, ipmToMmmin, hpToKw, lbftToNm, in3ToCm3 } from '../engine';

export type UnitSystem = 'imperial' | 'metric';

const LBF_TO_N = 4.4482216153;

export function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// --- length inputs (ae, ap, diameter, stickout) ---
export const lengthUnit = (sys: UnitSystem): string => (sys === 'metric' ? 'mm' : 'in');
export const lengthToDisplay = (in_: number, sys: UnitSystem): number =>
  sys === 'metric' ? inToMm(in_) : in_;
export const lengthFromDisplay = (v: number, sys: UnitSystem): number =>
  sys === 'metric' ? v / 25.4 : v;

export interface Reading {
  value: string;
  unit: string;
}

/** Turn a MillingResult into display-ready { value, unit } readings. */
export function formatResult(r: MillingResult, sys: UnitSystem) {
  const metric = sys === 'metric';
  return {
    rpm: { value: fmt(Math.round(r.rpm), 0), unit: 'rpm' } as Reading,
    feed: metric
      ? { value: fmt(ipmToMmmin(r.feed_ipm), 0), unit: 'mm/min' }
      : { value: fmt(r.feed_ipm, 2), unit: 'in/min' },
    sfm: metric
      ? { value: fmt(r.sfm / 3.28084, 0), unit: 'm/min' }
      : { value: fmt(r.sfm, 0), unit: 'ft/min' },
    chipload: metric
      ? { value: fmt(inToMm(r.chipload_in), 3), unit: 'mm/tooth' }
      : { value: fmt(r.chipload_in, 4), unit: 'in/tooth' },
    mrr: metric
      ? { value: fmt(in3ToCm3(r.mrr_in3min), 1), unit: 'cm³/min' }
      : { value: fmt(r.mrr_in3min, 2), unit: 'in³/min' },
    cuttingPower: metric
      ? { value: fmt(hpToKw(r.cuttingPower_hp), 2), unit: 'kW' }
      : { value: fmt(r.cuttingPower_hp, 2), unit: 'hp' },
    motorPower: metric
      ? { value: fmt(hpToKw(r.motorPower_hp), 2), unit: 'kW' }
      : { value: fmt(r.motorPower_hp, 2), unit: 'hp' },
    torque: metric
      ? { value: fmt(lbftToNm(r.cuttingTorque_lbft), 2), unit: 'N·m' }
      : { value: fmt(r.cuttingTorque_lbft, 2), unit: 'lb·ft' },
    force: metric
      ? { value: fmt(r.tangentialForce_lbf * LBF_TO_N, 0), unit: 'N' }
      : { value: fmt(r.tangentialForce_lbf, 1), unit: 'lbf' },
    radialForce: metric
      ? { value: fmt(r.radialForce_lbf * LBF_TO_N, 0), unit: 'N' }
      : { value: fmt(r.radialForce_lbf, 1), unit: 'lbf' },
    deflection: metric
      ? { value: fmt(r.deflection_in * 25400, 1), unit: 'µm' }
      : { value: fmt(r.deflection_in * 1000, 2), unit: 'thou' },
    effectiveDiameter: metric
      ? { value: fmt(inToMm(r.effectiveDiameter_in), 2), unit: 'mm' }
      : { value: fmt(r.effectiveDiameter_in, 3), unit: 'in' },
    thinningFactor: { value: fmt(r.radialChipThinningFactor, 2), unit: '×' } as Reading,
  };
}

/** Power display in the active unit system (for the motor-power gauge label). */
export const powerToDisplay = (hp: number, sys: UnitSystem): number =>
  sys === 'metric' ? hpToKw(hp) : hp;
export const powerUnit = (sys: UnitSystem): string => (sys === 'metric' ? 'kW' : 'hp');

/** Turn a DrillingResult into display-ready readings (Phase 7 T4). */
export function formatDrillingResult(r: DrillingResult, sys: UnitSystem) {
  const metric = sys === 'metric';
  return {
    rpm: { value: fmt(Math.round(r.rpm), 0), unit: 'rpm' } as Reading,
    feed: metric
      ? ({ value: fmt(ipmToMmmin(r.feed_ipm), 0), unit: 'mm/min' } as Reading)
      : ({ value: fmt(r.feed_ipm, 2), unit: 'in/min' } as Reading),
    mrr: metric
      ? ({ value: fmt(in3ToCm3(r.mrr_in3PerMin), 1), unit: 'cm³/min' } as Reading)
      : ({ value: fmt(r.mrr_in3PerMin, 2), unit: 'in³/min' } as Reading),
    powerAtMotor: metric
      ? ({ value: fmt(hpToKw(r.powerAtMotor_hp), 2), unit: 'kW' } as Reading)
      : ({ value: fmt(r.powerAtMotor_hp, 2), unit: 'hp' } as Reading),
    torque: metric
      ? ({ value: fmt(r.torque_inLbf * 0.112985, 2), unit: 'N·m' } as Reading)
      : ({ value: fmt(r.torque_inLbf, 2), unit: 'in·lbf' } as Reading),
    thrust:
      r.thrust_lbf === undefined
        ? undefined
        : metric
          ? ({ value: fmt(r.thrust_lbf * 4.4482216, 0), unit: 'N' } as Reading)
          : ({ value: fmt(r.thrust_lbf, 0), unit: 'lbf' } as Reading),
    peckDepth:
      r.peck.peckDepth_in === undefined
        ? undefined
        : metric
          ? ({ value: fmt(inToMm(r.peck.peckDepth_in), 2), unit: 'mm' } as Reading)
          : ({ value: fmt(r.peck.peckDepth_in, 3), unit: 'in' } as Reading),
  };
}

/** Turn a TurningResult into display-ready readings (Phase 7 T4). */
export function formatTurningResult(r: TurningResult, sys: UnitSystem) {
  const metric = sys === 'metric';
  return {
    rpm: { value: fmt(Math.round(r.rpm), 0), unit: 'rpm' } as Reading,
    feed: metric
      ? ({ value: fmt(ipmToMmmin(r.feed_ipm), 0), unit: 'mm/min' } as Reading)
      : ({ value: fmt(r.feed_ipm, 2), unit: 'in/min' } as Reading),
    achievedSfm: metric
      ? ({ value: fmt(r.achievedSfm / 3.28084, 0), unit: 'm/min' } as Reading)
      : ({ value: fmt(r.achievedSfm, 0), unit: 'ft/min' } as Reading),
    mrr: metric
      ? ({ value: fmt(in3ToCm3(r.mrr_in3PerMin), 1), unit: 'cm³/min' } as Reading)
      : ({ value: fmt(r.mrr_in3PerMin, 2), unit: 'in³/min' } as Reading),
    powerAtMotor: metric
      ? ({ value: fmt(hpToKw(r.powerAtMotor_hp), 2), unit: 'kW' } as Reading)
      : ({ value: fmt(r.powerAtMotor_hp, 2), unit: 'hp' } as Reading),
    torque: metric
      ? ({ value: fmt(r.torque_inLbf * 0.112985, 2), unit: 'N·m' } as Reading)
      : ({ value: fmt(r.torque_inLbf, 2), unit: 'in·lbf' } as Reading),
    ra:
      r.raTheoretical_uin === undefined
        ? undefined
        : metric
          ? ({ value: fmt(r.raTheoretical_uin * 0.0254, 2), unit: 'µm Ra' } as Reading)
          : ({ value: fmt(r.raTheoretical_uin, 0), unit: 'µin Ra' } as Reading),
    cssMinDiameter:
      r.cssFullSpeedMinDiameter_in === undefined
        ? undefined
        : metric
          ? ({ value: fmt(inToMm(r.cssFullSpeedMinDiameter_in), 1), unit: 'mm' } as Reading)
          : ({ value: fmt(r.cssFullSpeedMinDiameter_in, 3), unit: 'in' } as Reading),
  };
}
