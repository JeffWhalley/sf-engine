/**
 * Drilling & turning seed data — Phase 7 data prep (LAUNCH-PLAN.md §4).
 *
 * Keyed by ISO material group (P steel, M stainless, K cast iron, N aluminum/
 * non-ferrous, S superalloys/Ti, H hardened) to match the repo's `Material.
 * isoGroup` field, so the data layer can resolve without new per-material
 * fields at first; per-material overrides can refine later.
 *
 * VALUES: conventional handbook figures, CONSERVATIVE end of ranges (repo
 * standing rule: err conservative and warn). **[HUMAN] review before launch
 * (standing rule 6)** — these are starting points, not manufacturer data.
 *
 * INTEGRATION: move into sf-engine `src/data/`, then add to resolve.ts:
 *   resolveDrillingInput(materialId, drill, machine?) — SFM window by
 *     isoGroup × drill material, IPR from SEED_HSS_DRILL_IPR (below)
 *     × iprMultiplier below, performance slider interpolates windows the
 *     same way the milling resolver does.
 *   resolveTurningInput(materialId, insert, op: 'rough' | 'finish', ...)
 */

export type { IsoGroup } from './types';
import type { IsoGroup } from './types';

export interface Window {
  /** Conservative end. */
  min: number;
  /** Aggressive end. */
  max: number;
}

// ---------------------------------------------------------------------------
// Drilling
// ---------------------------------------------------------------------------

export interface DrillingSeed {
  /** HSS twist-drill surface speed window, ft/min. */
  sfmHss: Window;
  /** Solid-carbide drill surface speed window, ft/min. */
  sfmCarbide: Window;
  /** Multiplier on SEED_HSS_DRILL_IPR's steel-baseline feeds. */
  iprMultiplier: number;
}

export const DRILLING_SEEDS: Record<IsoGroup, DrillingSeed> = {
  // P — carbon/alloy steels
  P: { sfmHss: { min: 60, max: 100 }, sfmCarbide: { min: 200, max: 350 }, iprMultiplier: 1.0 },
  // M — stainless steels (work-hardening: keep feed up, speed down)
  M: { sfmHss: { min: 30, max: 60 }, sfmCarbide: { min: 120, max: 250 }, iprMultiplier: 0.6 },
  // K — cast irons
  K: { sfmHss: { min: 70, max: 110 }, sfmCarbide: { min: 220, max: 400 }, iprMultiplier: 1.2 },
  // N — aluminum & non-ferrous
  N: { sfmHss: { min: 200, max: 300 }, sfmCarbide: { min: 500, max: 900 }, iprMultiplier: 1.5 },
  // S — Ti & heat-resistant superalloys (low speed, positive feed, never dwell)
  S: { sfmHss: { min: 15, max: 35 }, sfmCarbide: { min: 60, max: 150 }, iprMultiplier: 0.5 },
  // H — hardened steels (carbide only in practice; HSS window is "don't")
  H: { sfmHss: { min: 10, max: 20 }, sfmCarbide: { min: 80, max: 180 }, iprMultiplier: 0.4 },
};

// ---------------------------------------------------------------------------
// Turning
// ---------------------------------------------------------------------------

export interface TurningSeed {
  /** Carbide insert surface speed window, ft/min (HSS turning derived ×0.35). */
  sfmCarbide: Window;
  /** Roughing feed window, in/rev. */
  iprRough: Window;
  /** Finishing feed window, in/rev. */
  iprFinish: Window;
  /** Roughing DOC window, inches per side. */
  docRough: Window;
  /** Finishing DOC window, inches per side. */
  docFinish: Window;
}

export const TURNING_SEEDS: Record<IsoGroup, TurningSeed> = {
  P: {
    sfmCarbide: { min: 350, max: 700 },
    iprRough: { min: 0.008, max: 0.015 }, iprFinish: { min: 0.003, max: 0.006 },
    docRough: { min: 0.05, max: 0.15 }, docFinish: { min: 0.005, max: 0.02 },
  },
  M: {
    sfmCarbide: { min: 200, max: 450 },
    iprRough: { min: 0.008, max: 0.014 }, iprFinish: { min: 0.004, max: 0.007 },
    docRough: { min: 0.04, max: 0.12 }, docFinish: { min: 0.008, max: 0.02 },
  },
  K: {
    sfmCarbide: { min: 300, max: 600 },
    iprRough: { min: 0.01, max: 0.018 }, iprFinish: { min: 0.004, max: 0.008 },
    docRough: { min: 0.05, max: 0.15 }, docFinish: { min: 0.005, max: 0.02 },
  },
  N: {
    sfmCarbide: { min: 800, max: 2000 },
    iprRough: { min: 0.008, max: 0.018 }, iprFinish: { min: 0.003, max: 0.006 },
    docRough: { min: 0.05, max: 0.2 }, docFinish: { min: 0.005, max: 0.02 },
  },
  S: {
    sfmCarbide: { min: 100, max: 250 },
    iprRough: { min: 0.006, max: 0.012 }, iprFinish: { min: 0.003, max: 0.006 },
    docRough: { min: 0.03, max: 0.1 }, docFinish: { min: 0.008, max: 0.02 },
  },
  H: {
    sfmCarbide: { min: 150, max: 350 },
    iprRough: { min: 0.004, max: 0.01 }, iprFinish: { min: 0.002, max: 0.005 },
    docRough: { min: 0.02, max: 0.08 }, docFinish: { min: 0.003, max: 0.01 },
  },
};

// ---------------------------------------------------------------------------
// Helpers (mirror the milling resolver's semantics)
// ---------------------------------------------------------------------------

/** Interpolate a window by performance 0–100 (0 = min/conservative). */
export function pickFromWindow(w: Window, performance: number): number {
  if (!Number.isFinite(performance)) throw new Error('performance must be finite');
  const p = Math.min(100, Math.max(0, performance)) / 100;
  return w.min + (w.max - w.min) * p;
}

/**
 * Piecewise-linear interpolation over a {d_in, ipr} table, clamped at the
 * ends — same semantics as the milling chiploadByDiameter resolver.
 */
export function interpolateIpr(
  table: ReadonlyArray<{ d_in: number; ipr: number }>,
  diameter_in: number,
): number {
  if (table.length === 0) throw new Error('empty IPR table');
  if (!Number.isFinite(diameter_in) || diameter_in <= 0) {
    throw new Error(`diameter_in must be > 0, got ${diameter_in}`);
  }
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (diameter_in <= first.d_in) return first.ipr;
  if (diameter_in >= last.d_in) return last.ipr;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1]!;
    const b = table[i]!;
    if (diameter_in <= b.d_in) {
      const t = (diameter_in - a.d_in) / (b.d_in - a.d_in);
      return a.ipr + (b.ipr - a.ipr) * t;
    }
  }
  return last.ipr; // unreachable, satisfies control flow
}

// ---------------------------------------------------------------------------
// Drill feed-per-rev seed table (moved here from engine/drilling.ts at merge —
// the engine must not own seed data)
// ---------------------------------------------------------------------------

/**
 * Generic HSS twist-drill feed per revolution vs. diameter (steel baseline,
 * conservative end of handbook ranges). Interpolate linearly (clamped at
 * ends) via interpolateIpr() and apply DRILLING_SEEDS[group].iprMultiplier,
 * mirroring how chiploadByDiameter works for milling.
 * Cited basis: conventional handbook drilling feed tables (conservative end).
 * **[HUMAN] review values before launch (standing rule 6).**
 */
export const SEED_HSS_DRILL_IPR: ReadonlyArray<{ d_in: number; ipr: number }> = [
  { d_in: 0.0625, ipr: 0.001 },
  { d_in: 0.125, ipr: 0.002 },
  { d_in: 0.25, ipr: 0.004 },
  { d_in: 0.375, ipr: 0.006 },
  { d_in: 0.5, ipr: 0.008 },
  { d_in: 0.75, ipr: 0.011 },
  { d_in: 1.0, ipr: 0.015 },
];
