/**
 * Tool life & cost-per-part estimator — Phase 9, T3 / feature F5
 * (LAUNCH-PLAN.md §2.4, §4).
 *
 * Taylor's equation: V · T^n = C. Rather than storing opaque C values, each
 * tool material carries a calibration point (refSfm at which life ≈ refLife
 * minutes, per ISO-group speed windows' midpoints), so:
 *     C = refSfm · refLife^n      and      T = (C / V)^(1/n)
 *
 * ── THIS IS AN ESTIMATE, AND THE UI MUST SAY SO ────────────────────────────
 * Real tool life varies wildly with coating, coolant, engagement, chatter,
 * and material batch (easily ±3×). The purpose here is the *shape* of the
 * tradeoff (spend RPM, pay in edges) and rough $/part comparisons between
 * two parameter sets — not absolute predictions. Outputs must always render
 * with the "estimate only" caveat (LAUNCH-PLAN Phase 9 AC).
 *
 * Pure, imperial-canonical, throws EngineError, never emits non-finite.
 *
 * ── Worked example: Golden Vector L-A (tested) ─────────────────────────────
 * Carbide (n = 0.25, calibration: 45 min at reference speed), material whose
 * reference speed is 600 SFM, running at V = 800 SFM:
 *   C   = 600 · 45^0.25          = 600 · 2.59002…  = 1554.01
 *   T   = (1554.01 / 800)^(1/0.25) = 1.94251^4     = 14.236 min
 * Cost per part with tool $30, 3 usable edges/regrinds, 2.0 cutting
 * min/part, machine rate $60/h:
 *   parts/edge  = 14.236 / 2.0                     = 7.118 → floor 7
 *   tool $/part = 30 / (3 · 7)                     = $1.4286
 *   mach $/part = (2.0/60) · 60                    = $2.0000
 *   total       =                                    $3.4286
 */

import { EngineError, requirePositive } from './validate';

// ---------------------------------------------------------------------------
// Taylor life
// ---------------------------------------------------------------------------

export type ToolMaterialClass = 'hss' | 'cobalt' | 'carbide' | 'ceramic';

/**
 * Default Taylor exponents (classic handbook ranges, conservative-typical):
 * HSS ≈ 0.1–0.15 → 0.125; cobalt slightly higher; carbide ≈ 0.2–0.3 → 0.25;
 * ceramic ≈ 0.4. refLifeMin is the assumed life when running exactly at the
 * material's reference (mid-window) surface speed for that tool class.
 * [HUMAN] review before launch (standing rule 6).
 */
export const TAYLOR_DEFAULTS: Record<
  ToolMaterialClass,
  { n: number; refLifeMin: number }
> = {
  hss: { n: 0.125, refLifeMin: 60 },
  cobalt: { n: 0.14, refLifeMin: 60 },
  carbide: { n: 0.25, refLifeMin: 45 },
  ceramic: { n: 0.4, refLifeMin: 30 },
};

export interface ToolLifeInput {
  /** Actual running surface speed, ft/min. */
  sfm: number;
  /** Reference surface speed for this material+tool class (mid window), ft/min. */
  refSfm: number;
  /** Tool class for default n/refLife, or override both explicitly. */
  toolClass?: ToolMaterialClass;
  /** Taylor exponent override. */
  n?: number;
  /** Life at refSfm override, minutes. */
  refLifeMin?: number;
}

export interface ToolLifeResult {
  /** Estimated cutting time to dull, minutes. ESTIMATE ONLY. */
  lifeMin: number;
  /** Life relative to running at refSfm (1.0 = reference). */
  lifeRatio: number;
  nUsed: number;
  cUsed: number;
}

export function estimateToolLife(input: ToolLifeInput): ToolLifeResult {
  const { sfm, refSfm, toolClass } = input;
  requirePositive(sfm, 'sfm');
  requirePositive(refSfm, 'refSfm');

  const defaults = toolClass ? TAYLOR_DEFAULTS[toolClass] : undefined;
  const n = input.n ?? defaults?.n;
  const refLifeMin = input.refLifeMin ?? defaults?.refLifeMin;
  if (n === undefined || refLifeMin === undefined) {
    throw new EngineError(
      'estimateToolLife needs toolClass, or explicit n and refLifeMin.',
    );
  }
  requirePositive(n, 'n');
  if (n >= 1) throw new EngineError(`Taylor n must be < 1, got ${n}`);
  requirePositive(refLifeMin, 'refLifeMin');

  const c = refSfm * Math.pow(refLifeMin, n);
  const lifeMin = Math.pow(c / sfm, 1 / n);
  const lifeRatio = lifeMin / refLifeMin;

  const result = { lifeMin, lifeRatio, nUsed: n, cUsed: c };
  for (const [k, v] of Object.entries(result)) {
    if (!Number.isFinite(v)) throw new EngineError(`internal: non-finite ${k}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cost per part
// ---------------------------------------------------------------------------

export interface CostPerPartInput {
  /** Estimated tool life at these parameters, minutes (from estimateToolLife). */
  lifeMin: number;
  /** In-cut minutes this tool contributes per part. */
  cutMinutesPerPart: number;
  /** Purchase price of the tool (or insert set), $. */
  toolCost: number;
  /** Usable edges: index positions on inserts / regrinds+1 on endmills. Default 1. */
  edgesPerTool?: number;
  /** Shop machine+labor rate, $/hour. */
  machineRatePerHour: number;
}

export interface CostPerPartResult {
  /** Whole parts completed per edge before dulling (floored; min 0). */
  partsPerEdge: number;
  partsPerTool: number;
  toolCostPerPart: number;
  machineCostPerPart: number;
  totalCostPerPart: number;
  warnings: string[];
}

export function costPerPart(input: CostPerPartInput): CostPerPartResult {
  const {
    lifeMin,
    cutMinutesPerPart,
    toolCost,
    edgesPerTool = 1,
    machineRatePerHour,
  } = input;
  requirePositive(lifeMin, 'lifeMin');
  requirePositive(cutMinutesPerPart, 'cutMinutesPerPart');
  requirePositive(toolCost, 'toolCost');
  requirePositive(machineRatePerHour, 'machineRatePerHour');
  if (!Number.isInteger(edgesPerTool) || edgesPerTool < 1) {
    throw new EngineError(`edgesPerTool must be an integer >= 1, got ${edgesPerTool}`);
  }

  const warnings: string[] = [];
  const partsPerEdge = Math.floor(lifeMin / cutMinutesPerPart);
  const machineCostPerPart = (cutMinutesPerPart / 60) * machineRatePerHour;

  if (partsPerEdge < 1) {
    warnings.push(
      'Estimated tool life is shorter than one part\u2019s cutting time \u2014 ' +
        'these parameters likely burn tools mid-part. Slow down or reduce engagement.',
    );
    return {
      partsPerEdge: 0,
      partsPerTool: 0,
      // Burns ≥ one whole tool per part; report the tool price as the floor.
      toolCostPerPart: toolCost,
      machineCostPerPart,
      totalCostPerPart: toolCost + machineCostPerPart,
      warnings,
    };
  }

  const partsPerTool = partsPerEdge * edgesPerTool;
  const toolCostPerPart = toolCost / partsPerTool;
  const totalCostPerPart = toolCostPerPart + machineCostPerPart;

  const result: CostPerPartResult = {
    partsPerEdge,
    partsPerTool,
    toolCostPerPart,
    machineCostPerPart,
    totalCostPerPart,
    warnings,
  };
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new EngineError(`internal: non-finite ${k}`);
    }
  }
  return result;
}
