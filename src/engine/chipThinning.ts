/**
 * Chip thinning & effective diameter. Plan §2.5 and §2.6.
 */

import { assertPositive } from './validate';
import type { ToolType } from './types';

/**
 * Radial chip-thinning factor (RCTF). Plan §2.5.
 *
 * When radial engagement ae < D/2, the real chip is thinner than the
 * programmed feed-per-tooth, so feed can be increased to keep the *actual*
 * peak chip thickness on target.
 *
 *   r = ae / D
 *   r >= 0.5  -> 1                       (no thinning at/above half engagement)
 *   r <  0.5  -> 1 / (2 * sqrt(r - r^2)) (capped at `ceiling`)
 *
 * @returns factor >= 1 to multiply the base chip load by.
 */
export function radialChipThinningFactor(
  ae_in: number,
  diameter_in: number,
  ceiling = 3.0,
): number {
  assertPositive('ae_in', ae_in);
  assertPositive('diameter_in', diameter_in);

  const r = ae_in / diameter_in;
  if (r >= 0.5) return 1;

  const factor = 1 / (2 * Math.sqrt(r - r * r));
  return Math.min(factor, ceiling);
}

/**
 * Effective cutting diameter for ball- and bull-nose tools at shallow axial
 * depth. Plan §2.6. Use the returned diameter for the SFM→RPM conversion.
 *
 * Flat / face / drill etc. always return the nominal diameter.
 */
export function effectiveDiameter(
  toolType: ToolType,
  diameter_in: number,
  ap_in: number,
  cornerRadius_in?: number,
): number {
  assertPositive('diameter_in', diameter_in);
  assertPositive('ap_in', ap_in);

  if (toolType === 'ballEndmill') {
    const R = diameter_in / 2;
    if (ap_in >= R) return diameter_in;
    // Deff = 2 * sqrt(ap * (D - ap))
    return 2 * Math.sqrt(ap_in * (diameter_in - ap_in));
  }

  if (toolType === 'bullEndmill') {
    const rc = cornerRadius_in ?? 0;
    if (rc <= 0 || ap_in >= rc) return diameter_in;
    // Deff = D - 2*rc + 2*sqrt(ap*(2*rc - ap))
    return diameter_in - 2 * rc + 2 * Math.sqrt(ap_in * (2 * rc - ap_in));
  }

  return diameter_in;
}
