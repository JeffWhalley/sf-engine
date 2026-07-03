/**
 * Phase 9 T3 — tool-life panel data (UI boundary, no React).
 * ESTIMATE ONLY — every consumer must surface that caveat.
 */

import { estimateToolLife, costPerPart } from '../engine';
import type { ToolLifeResult, CostPerPartResult, ToolMaterialClass } from '../engine';
import { pickSFM, DRILLING_SEEDS, TURNING_SEEDS, pickFromWindow } from '../data';
import type { Material } from '../data';
import type { ToolMaterial } from '../engine';

/** Map the repo's tool materials onto Taylor classes. */
export function taylorClassFor(toolMaterial: ToolMaterial | 'carbide'): ToolMaterialClass {
  switch (toolMaterial) {
    case 'hss': return 'hss';
    case 'cobalt': return 'cobalt';
    default: return 'carbide'; // carbide + carbideCoated
  }
}

export interface ToolLifeEstimate {
  life: ToolLifeResult;
  cost: CostPerPartResult;
  refSfm: number;
}

export interface ShopAssumptions {
  toolCost: number;
  edgesPerTool: number;
  cutMinutesPerPart: number;
  machineRatePerHour: number;
}

export const DEFAULT_ASSUMPTIONS: ShopAssumptions = {
  toolCost: 25,
  edgesPerTool: 1,
  cutMinutesPerPart: 5,
  machineRatePerHour: 75,
};

/** Reference (mid-window) SFM for the active operation. */
export function referenceSfm(
  material: Material,
  operation: 'milling' | 'drilling' | 'turning',
  toolMaterial: ToolMaterial,
  drillMaterial?: 'hss' | 'carbide',
): number {
  if (operation === 'drilling') {
    const seed = DRILLING_SEEDS[material.isoGroup];
    return pickFromWindow(drillMaterial === 'carbide' ? seed.sfmCarbide : seed.sfmHss, 50);
  }
  if (operation === 'turning') {
    return pickFromWindow(TURNING_SEEDS[material.isoGroup].sfmCarbide, 50);
  }
  return pickSFM(material, toolMaterial, 50);
}

/** Life + cost estimate for an achieved surface speed. Throws EngineError on junk. */
export function estimateForSfm(
  achievedSfm: number,
  refSfm: number,
  toolClass: ToolMaterialClass,
  a: ShopAssumptions,
): ToolLifeEstimate {
  const life = estimateToolLife({ sfm: achievedSfm, refSfm, toolClass });
  const cost = costPerPart({
    lifeMin: life.lifeMin,
    cutMinutesPerPart: a.cutMinutesPerPart,
    toolCost: a.toolCost,
    edgesPerTool: a.edgesPerTool,
    machineRatePerHour: a.machineRatePerHour,
  });
  return { life, cost, refSfm };
}
