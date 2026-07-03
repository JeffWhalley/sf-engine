/**
 * Manufacturer speeds & feeds overrides — Phase 8 T3 (PLAN §8.1, LAUNCH-PLAN
 * Phase 8 T3).
 *
 * When the selected tool carries `brand` + `series` matching an entry here,
 * the resolver uses the manufacturer's numbers INSTEAD of the generic
 * pickSFM/pickChipload path, and the UI shows a "Using <brand> data" badge.
 * The performance slider still interpolates the manufacturer's SFM window and
 * scales chip load with the standard multiplier, so the slider stays live.
 *
 * ⚠ The single entry below is EXAMPLE data for the demo tool — **[HUMAN]**
 * replace with real, verified manufacturer tables before launch (do not ship
 * numbers attributed to a real brand without their published data in hand).
 */

import type { ChiploadPoint, IsoGroup, Material, SfmRange, Tool } from './types';

export interface MfrCutData {
  /** Manufacturer surface-speed window, ft/min (performance interpolates). */
  sfm: SfmRange;
  /** Manufacturer chip-load table, in/tooth vs diameter (interpolated). */
  chiploadByDiameter: ChiploadPoint[];
}

export interface MfrOverride {
  brand: string;
  series: string;
  /** Exact material-id matches take precedence… */
  byMaterialId?: Record<string, MfrCutData>;
  /** …falling back to ISO-group entries. */
  byIsoGroup?: Partial<Record<IsoGroup, MfrCutData>>;
}

export const MFR_OVERRIDES: MfrOverride[] = [
  {
    // EXAMPLE ONLY — invented numbers for the seeded demo tool. [HUMAN] swap
    // for a real catalog table (this is deliberately hotter than generic
    // seeds, as real aluminum-specific tooling data tends to be).
    brand: 'Example Tooling',
    series: 'ET-3FL-ALU',
    byIsoGroup: {
      N: {
        sfm: { min: 900, max: 1600 },
        chiploadByDiameter: [
          { d_in: 0.125, fz_in: 0.0012 },
          { d_in: 0.25, fz_in: 0.0025 },
          { d_in: 0.375, fz_in: 0.004 },
          { d_in: 0.5, fz_in: 0.005 },
        ],
      },
    },
  },
];

/**
 * Find manufacturer data for a tool × material, or undefined. Exact
 * material-id entries beat ISO-group entries; first matching brand+series
 * wins (registry order is curation order).
 */
export function findMfrOverride(tool: Tool, material: Material): MfrCutData | undefined {
  if (!tool.brand || !tool.series) return undefined;
  for (const o of MFR_OVERRIDES) {
    if (o.brand !== tool.brand || o.series !== tool.series) continue;
    const exact = o.byMaterialId?.[material.id];
    if (exact) return exact;
    const group = o.byIsoGroup?.[material.isoGroup];
    if (group) return group;
  }
  return undefined;
}
