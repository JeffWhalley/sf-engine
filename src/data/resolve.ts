/**
 * Resolution layer — turns material/tool/machine selections into the resolved
 * numeric MillingInput the engine consumes. Plan §2.13 hook points, §3.4, §3.5.
 *
 * Performance model (intentional refinement of plan §5.2): a single
 * `performance` value in [0,100] drives both SFM and chip load.
 *   - SFM interpolates across the material's stored [min,max] window.
 *   - Chip load takes the diameter-interpolated base × a performance multiplier
 *     (0.8 at 0, 1.0 at 50, 1.35 at 100).
 * In Phase 5 the UI slider simply drives `performance`, and machine rigidity may
 * cap its upper end before it reaches these functions.
 */

import { computeMilling, computeDrilling, computeTurning } from '../engine';
import type { MillingInput, MillingResult, ToolMaterial } from '../engine/types';
import type { DrillingInput, DrillingResult } from '../engine/drilling';
import type { TurningInput, TurningResult } from '../engine/turning';
import type { Material, Tool, Machine, ChiploadPoint, SfmRange } from './types';
import {
  DRILLING_SEEDS,
  TURNING_SEEDS,
  SEED_HSS_DRILL_IPR,
  pickFromWindow,
  interpolateIpr,
} from './cuttingSeeds';
import { findMfrOverride, type MfrCutData } from './mfrOverrides';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** SFM derivation factor relative to carbide, when no explicit override exists. */
const TOOL_MATERIAL_SFM_FACTOR: Record<ToolMaterial, number> = {
  hss: 0.5,
  cobalt: 0.65,
  carbide: 1.0,
  carbideCoated: 1.25,
};

/** Resolve the SFM window for a given tool material (explicit override or derived). */
export function sfmRangeFor(material: Material, toolMaterial: ToolMaterial): SfmRange {
  const override = material.sfmOverrides?.[toolMaterial];
  if (override) return override;
  const f = TOOL_MATERIAL_SFM_FACTOR[toolMaterial];
  return { min: material.sfmCarbide.min * f, max: material.sfmCarbide.max * f };
}

/** Surface speed (ft/min) for a material + tool material at a performance position. */
export function pickSFM(
  material: Material,
  toolMaterial: ToolMaterial,
  performance: number,
): number {
  const { min, max } = sfmRangeFor(material, toolMaterial);
  const t = clamp(performance, 0, 100) / 100;
  return min + (max - min) * t;
}

/** Linear interpolation over a sorted-ascending chipload table, clamped at ends. */
export function interpolateChipload(points: ChiploadPoint[], diameter_in: number): number {
  if (points.length === 0) throw new Error('empty chipload table');
  const first = points[0];
  const last = points[points.length - 1];
  if (diameter_in <= first.d_in) return first.fz_in;
  if (diameter_in >= last.d_in) return last.fz_in;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (diameter_in >= a.d_in && diameter_in <= b.d_in) {
      const t = (diameter_in - a.d_in) / (b.d_in - a.d_in);
      return a.fz_in + (b.fz_in - a.fz_in) * t;
    }
  }
  return last.fz_in;
}

/** Performance multiplier for chip load: 0.8 @ 0, 1.0 @ 50, 1.35 @ 100. */
export function chiploadPerfMultiplier(performance: number): number {
  const p = clamp(performance, 0, 100);
  return p <= 50 ? 0.8 + (1.0 - 0.8) * (p / 50) : 1.0 + (1.35 - 1.0) * ((p - 50) / 50);
}

/** Feed per tooth (in/tooth) for a material + diameter at a performance position. */
export function pickChipload(material: Material, diameter_in: number, performance: number): number {
  return interpolateChipload(material.chiploadByDiameter, diameter_in) * chiploadPerfMultiplier(performance);
}

/** Material unit power, hp·min/in³. */
export function unitPowerFor(material: Material): number {
  return material.unitPower;
}

export type CuttingStrategy = 'slot' | 'profile' | 'hsm';

export interface EngagementSuggestion {
  ae_in: number;
  ap_in: number;
  /** True if axial depth was reduced to fit the flute length. */
  apClampedToFlute: boolean;
}

/** Suggested starting engagement by strategy. Plan §3.5. */
export function suggestEngagement(
  diameter_in: number,
  strategy: CuttingStrategy,
  fluteLength_in?: number,
): EngagementSuggestion {
  let ae: number;
  let ap: number;
  switch (strategy) {
    case 'slot':
      ae = 1.0 * diameter_in;
      ap = 0.75 * diameter_in;
      break;
    case 'profile':
      ae = 0.4 * diameter_in;
      ap = 1.0 * diameter_in;
      break;
    case 'hsm':
      ae = 0.1 * diameter_in;
      ap = 2.0 * diameter_in;
      break;
  }
  let apClampedToFlute = false;
  if (fluteLength_in != null && ap > fluteLength_in) {
    ap = fluteLength_in;
    apClampedToFlute = true;
  }
  return { ae_in: ae, ap_in: ap, apClampedToFlute };
}

export interface MillingSelection {
  material: Material;
  tool: Tool;
  ae_in: number;
  ap_in: number;
  /** Performance position, 0..100. Default 50 (balanced). */
  performance?: number;
  /** Optional machine — used here only to source drive efficiency. */
  machine?: Machine;
  /**
   * Phase 8 T4 — HSM/trochoidal mode: light radial engagement lets carbide run
   * substantially faster, so SFM gets HSM_SFM_BOOST. Requires an adaptive/
   * trochoidal toolpath in CAM (UI shows that advisory).
   */
  hsm?: boolean;
}

/**
 * SFM multiplier applied in HSM mode. Judgment call (typical adaptive-milling
 * practice runs 1.3–2× handbook SFM at ≤15% radial engagement) — conservative
 * end. **[HUMAN] review (standing rule 6).**
 */
export const HSM_SFM_BOOST = 1.5;

/**
 * Manufacturer data active for this selection, or undefined (Phase 8 T3).
 * UI uses this for the "Using <brand> data" badge.
 */
export function activeMfrOverride(sel: Pick<MillingSelection, 'tool' | 'material'>): MfrCutData | undefined {
  return findMfrOverride(sel.tool, sel.material);
}

/** SFM/chipload from a manufacturer table, honoring the performance model. */
function mfrPicks(o: MfrCutData, diameter_in: number, performance: number) {
  const t = clamp(performance, 0, 100) / 100;
  return {
    sfm: o.sfm.min + (o.sfm.max - o.sfm.min) * t,
    chipload_in:
      interpolateChipload(o.chiploadByDiameter, diameter_in) * chiploadPerfMultiplier(performance),
  };
}

/** Resolve a full selection into the engine's MillingInput. */
export function resolveMillingInput(sel: MillingSelection): MillingInput {
  const performance = sel.performance ?? 50;
  const efficiency = sel.machine?.efficiency ?? 0.8;
  const mfr = findMfrOverride(sel.tool, sel.material);
  const picks = mfr
    ? mfrPicks(mfr, sel.tool.diameter_in, performance)
    : {
        sfm: pickSFM(sel.material, sel.tool.material, performance),
        chipload_in: pickChipload(sel.material, sel.tool.diameter_in, performance),
      };
  return {
    sfm: picks.sfm * (sel.hsm ? HSM_SFM_BOOST : 1),
    diameter_in: sel.tool.diameter_in,
    flutes: sel.tool.flutes,
    chipload_in: picks.chipload_in,
    ae_in: sel.ae_in,
    ap_in: sel.ap_in,
    toolType: sel.tool.type,
    cornerRadius_in: sel.tool.cornerRadius_in,
    unitPower: sel.material.unitPower,
    efficiency,
    stickout_in: sel.tool.stickout_in,
    toolMaterial: sel.tool.material,
    youngsModulus_psi: sel.tool.youngsModulus_psi,
  };
}

/** Convenience: resolve a selection and run the milling calculation. */
export function calculate(sel: MillingSelection): MillingResult {
  return computeMilling(resolveMillingInput(sel));
}

// ---------------------------------------------------------------------------
// Phase 7 — drilling & turning resolution (contracts per cuttingSeeds.ts)
// ---------------------------------------------------------------------------

export type DrillMaterial = 'hss' | 'carbide';

export interface DrillingSelection {
  material: Material;
  /** Drill diameter, inches. */
  drillDiameter_in: number;
  /** Default 'hss' (conservative). */
  drillMaterial?: DrillMaterial;
  /** Hole depth, inches (omit for through/unknown — skips peck advice). */
  holeDepth_in?: number;
  /** Performance position 0..100. Default 50 (balanced). */
  performance?: number;
  /** Optional machine — sources drive efficiency and the RPM ceiling. */
  machine?: Machine;
}

/**
 * Resolve a drilling selection into the engine's DrillingInput.
 *
 * Mirrors the milling resolver's performance model: SFM interpolates the
 * DRILLING_SEEDS window (isoGroup × drill material); IPR is the diameter-
 * interpolated SEED_HSS_DRILL_IPR baseline × the group's iprMultiplier × the
 * same chip-load performance multiplier milling uses (0.8 @0 / 1.0 @50 /
 * 1.35 @100).
 */
export function resolveDrillingInput(sel: DrillingSelection): DrillingInput {
  const performance = sel.performance ?? 50;
  const seed = DRILLING_SEEDS[sel.material.isoGroup];
  const window = (sel.drillMaterial ?? 'hss') === 'carbide' ? seed.sfmCarbide : seed.sfmHss;
  return {
    sfm: pickFromWindow(window, performance),
    diameter_in: sel.drillDiameter_in,
    ipr:
      interpolateIpr(SEED_HSS_DRILL_IPR, sel.drillDiameter_in) *
      seed.iprMultiplier *
      chiploadPerfMultiplier(performance),
    holeDepth_in: sel.holeDepth_in,
    unitPower_hpMinIn3: sel.material.unitPower,
    kc_nPerMm2: sel.material.kc,
    efficiency: sel.machine?.efficiency ?? 0.8,
    maxRpm: sel.machine?.maxRpm,
  };
}

/** Convenience: resolve a drilling selection and run the calculation. */
export function calculateDrilling(sel: DrillingSelection): DrillingResult {
  return computeDrilling(resolveDrillingInput(sel));
}

export type TurningOp = 'rough' | 'finish';
export type InsertMaterial = 'carbide' | 'hss';

/** HSS single-point tooling runs far slower than carbide inserts. */
const HSS_TURNING_SFM_FACTOR = 0.35;

export interface TurningSelection {
  material: Material;
  /** Workpiece diameter at the cut, inches. */
  workpieceDiameter_in: number;
  /** Default 'rough'. */
  op?: TurningOp;
  /** Default 'carbide'; 'hss' derives SFM × 0.35 (see cuttingSeeds.ts). */
  insertMaterial?: InsertMaterial;
  /** Insert nose radius, inches — enables the theoretical-Ra estimate. */
  noseRadius_in?: number;
  /** Explicit feed override, in/rev (else seeded from the op window). */
  ipr?: number;
  /** Explicit DOC override, inches per side (else seeded from the op window). */
  doc_in?: number;
  /** Performance position 0..100. Default 50 (balanced). */
  performance?: number;
  /** Optional machine — sources drive efficiency and the RPM ceiling. */
  machine?: Machine;
}

/**
 * Resolve a turning selection into the engine's TurningInput. SFM, feed/rev,
 * and DOC all interpolate their TURNING_SEEDS windows (isoGroup × op) by the
 * performance position, same semantics as the milling resolver.
 */
export function resolveTurningInput(sel: TurningSelection): TurningInput {
  const performance = sel.performance ?? 50;
  const op = sel.op ?? 'rough';
  const seed = TURNING_SEEDS[sel.material.isoGroup];
  const sfmFactor = (sel.insertMaterial ?? 'carbide') === 'hss' ? HSS_TURNING_SFM_FACTOR : 1;
  return {
    sfm: pickFromWindow(seed.sfmCarbide, performance) * sfmFactor,
    workpieceDiameter_in: sel.workpieceDiameter_in,
    ipr: sel.ipr ?? pickFromWindow(op === 'rough' ? seed.iprRough : seed.iprFinish, performance),
    doc_in: sel.doc_in ?? pickFromWindow(op === 'rough' ? seed.docRough : seed.docFinish, performance),
    noseRadius_in: sel.noseRadius_in,
    unitPower_hpMinIn3: sel.material.unitPower,
    efficiency: sel.machine?.efficiency ?? 0.8,
    maxRpm: sel.machine?.maxRpm,
  };
}

/** Convenience: resolve a turning selection and run the calculation. */
export function calculateTurning(sel: TurningSelection): TurningResult {
  return computeTurning(resolveTurningInput(sel));
}
