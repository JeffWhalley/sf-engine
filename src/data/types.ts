/**
 * Data-layer types. Plan §3.
 *
 * ToolType and ToolMaterial are owned by the engine (single source of truth);
 * everything material/tool/machine-specific lives here.
 *
 * Deviation from plan §3.1 (intentional): instead of `sfm: { hss?, carbide?,
 * carbideCoated? }` with every field optional, we store a guaranteed
 * `sfmCarbide` window and derive other tool materials by factor (see
 * resolve.ts), with optional explicit `sfmOverrides`. This guarantees a base
 * range always exists and keeps the seed data compact.
 */

import type { ToolType, ToolMaterial } from '../engine/types';

export type Coating = 'none' | 'tin' | 'tialn' | 'altin' | 'dlc';
export type IsoGroup = 'P' | 'M' | 'K' | 'N' | 'S' | 'H';

export interface SfmRange {
  /** Conservative end, ft/min. */
  min: number;
  /** Aggressive end, ft/min. */
  max: number;
}

export interface ChiploadPoint {
  d_in: number;
  fz_in: number;
}

export interface Material {
  id: string;
  name: string;
  isoGroup: IsoGroup;
  hardnessBhn?: [number, number];
  /** Carbide (uncoated) surface-speed window. Other tool materials derived. */
  sfmCarbide: SfmRange;
  /** Optional explicit SFM windows that override the derived values. */
  sfmOverrides?: Partial<Record<ToolMaterial, SfmRange>>;
  /** Feed-per-tooth vs tool diameter; linearly interpolated, clamped at ends. */
  chiploadByDiameter: ChiploadPoint[];
  /** Unit power, hp·min/in³. */
  unitPower: number;
  /** Specific cutting force, N/mm² (reference / metric cross-check). */
  kc?: number;
  /** Reserved for Phase 8 coating/manufacturer refinement; NOT applied by default. */
  coatingMultiplier?: Partial<Record<Coating, number>>;
  notes?: string;
}

export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  material: ToolMaterial;
  coating: Coating;
  diameter_in: number;
  flutes: number;
  /** Corner radius, inches — required for bull-nose tools. */
  cornerRadius_in?: number;
  /** Length of cut — limits achievable axial depth. */
  fluteLength_in: number;
  overallLength_in: number;
  shankDiameter_in: number;
  /** Length protruding from the holder. */
  stickout_in: number;
  helixAngle_deg?: number;
  youngsModulus_psi?: number;
  /** For manufacturer-override matching (Phase 8). */
  brand?: string;
  series?: string;
}

export interface Machine {
  id: string;
  name: string;
  maxRpm: number;
  minRpm: number;
  maxPower_hp: number;
  /** Drive efficiency 0..1. */
  efficiency: number;
  maxFeed_ipm: number;
  /** RPM at/above which full power is available (constant-power region). */
  baseRpm?: number;
  maxTorque_lbft?: number;
  rigidity?: 'light' | 'medium' | 'rigid';
  /** Gearbox/manual machines snap to these speeds. */
  discreteRpms?: number[];
  /** Spindle taper, display only. */
  taper?: string;
}
