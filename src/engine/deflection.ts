/**
 * Tool deflection — round cantilever beam model. Plan §2.11.
 */

import { assertPositive } from './validate';
import type { ToolMaterial } from './types';

/** Young's modulus by tool material, psi. Plan §2.11 reference values. */
export const YOUNGS_MODULUS_PSI: Record<ToolMaterial, number> = {
  carbide: 90_000_000, // ~620 GPa
  carbideCoated: 90_000_000,
  cobalt: 32_000_000, // ~220 GPa
  hss: 30_000_000, // ~210 GPa
};

/** Area moment of inertia for a solid round section, in⁴.  I = π d⁴ / 64 */
export function areaMomentOfInertia(diameter_in: number): number {
  assertPositive('diameter_in', diameter_in);
  return (Math.PI * Math.pow(diameter_in, 4)) / 64;
}

/**
 * Tip deflection of a tool modeled as a round cantilever loaded radially at
 * the tip. Plan §2.11.
 *
 *   d = fluteFactor * D            (fluted section is less stiff than the OD)
 *   I = π d⁴ / 64
 *   δ = (Fr * L³) / (3 * E * I)
 */
export function deflection(
  radialForce_lbf: number,
  stickout_in: number,
  diameter_in: number,
  youngsModulus_psi: number,
  fluteFactor = 0.8,
): number {
  assertPositive('radialForce_lbf', radialForce_lbf);
  assertPositive('stickout_in', stickout_in);
  assertPositive('diameter_in', diameter_in);
  assertPositive('youngsModulus_psi', youngsModulus_psi);
  assertPositive('fluteFactor', fluteFactor);

  const d = fluteFactor * diameter_in;
  const I = areaMomentOfInertia(d);
  return (radialForce_lbf * Math.pow(stickout_in, 3)) / (3 * youngsModulus_psi * I);
}
