/**
 * Golden vectors — input -> expected output rows. Plan §8.1.
 *
 * Add a row whenever a calculation is touched. These are the regression
 * backbone: if one of these moves unexpectedly, a formula changed.
 */

import type { MillingInput, MillingResult } from '../types';

export interface GoldenVector {
  name: string;
  input: MillingInput;
  expected: Partial<MillingResult>;
}

/**
 * Vector A — Aluminum, 1/2" 4FL carbide, light radial / full-ish axial.
 * Hand-computed in plan §8.1.
 */
export const VECTOR_A: GoldenVector = {
  name: 'A: 6061 aluminum, 1/2" 4FL carbide flat',
  input: {
    sfm: 600,
    diameter_in: 0.5,
    flutes: 4,
    chipload_in: 0.003,
    ae_in: 0.05,
    ap_in: 0.5,
    toolType: 'flatEndmill',
    unitPower: 0.3,
    efficiency: 0.8,
    stickout_in: 1.5,
    toolMaterial: 'carbide',
    fluteFactor: 0.8,
    radialForceRatio: 0.4,
  },
  expected: {
    rpm: 4583.66,
    radialChipThinningFactor: 1.6667,
    chipload_in: 0.005,
    feed_ipm: 91.67,
    mrr_in3min: 2.292,
    cuttingPower_hp: 0.688,
    motorPower_hp: 0.859,
    cuttingTorque_lbft: 0.788,
    tangentialForce_lbf: 37.8,
    radialForce_lbf: 15.1,
    deflection_in: 0.00015,
  },
};
