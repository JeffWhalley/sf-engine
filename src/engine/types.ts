/**
 * Shared engine types.
 *
 * CANONICAL UNITS: all engine math is done in IMPERIAL — inches, feet/min,
 * minutes, horsepower, lb-ft, psi, lbf. Convert at the UI boundary only
 * (see units.ts). Never mix unit systems inside a calculation.
 */

export type UnitSystem = 'imperial' | 'metric';

export type ToolType =
  | 'flatEndmill'
  | 'ballEndmill'
  | 'bullEndmill'
  | 'chamfer'
  | 'faceMill'
  | 'drill'
  | 'highFeedMill'
  | 'reamer'
  | 'tap';

export type ToolMaterial = 'hss' | 'cobalt' | 'carbide' | 'carbideCoated';

/**
 * Fully-resolved numeric inputs for a milling calculation.
 *
 * NOTE (Phase 1 scope): this engine receives ALREADY-RESOLVED numbers. The
 * data layer (Phase 2) is responsible for turning a material + tool + coating
 * + performance-slider position into `sfm`, `chipload_in`, and `unitPower`.
 * Machine-limit clamping (Phase 5) wraps the result of computeMilling().
 */
export interface MillingInput {
  /** Surface speed, ft/min (SFM). Already includes tool-material/coating/perf scaling. */
  sfm: number;
  /** Nominal cutting diameter, inches. */
  diameter_in: number;
  /** Number of flutes/teeth. */
  flutes: number;
  /** Base feed per tooth (chip load), in/tooth, BEFORE chip-thinning compensation. */
  chipload_in: number;
  /** Radial depth of cut / width of cut (ae), inches. */
  ae_in: number;
  /** Axial depth of cut (ap), inches. */
  ap_in: number;
  /** Tool geometry type — affects effective-diameter handling. */
  toolType: ToolType;
  /** Corner radius for bull-nose tools, inches. */
  cornerRadius_in?: number;
  /** Unit power for the workpiece material, hp·min/in³. */
  unitPower: number;
  /** Spindle drive efficiency 0..1. Default 0.80. */
  efficiency?: number;
  /** Tool stickout (length from holder), inches. */
  stickout_in: number;
  /** Tool material — used to pick Young's modulus if youngsModulus_psi is absent. */
  toolMaterial?: ToolMaterial;
  /** Explicit Young's modulus override, psi. */
  youngsModulus_psi?: number;
  /** Effective-stiffness factor for the fluted section (d = factor*D). Default 0.80. */
  fluteFactor?: number;
  /** Radial-to-tangential force ratio (kr). Default 0.40. */
  radialForceRatio?: number;
  /** Upper clamp on the radial chip-thinning factor. Default 3.0. */
  rctfCeiling?: number;
  /** Phase 5: force the spindle speed (rpm) instead of deriving it from sfm.
   *  Surface speed in the result becomes the value implied by this rpm. */
  rpmOverride_rpm?: number;
  /** Phase 5: force the table feed (in/min); chip load is back-solved from it. */
  feedOverride_ipm?: number;
}

export interface MillingResult {
  /** Surface speed actually used, ft/min. */
  sfm: number;
  /** Effective cutting diameter after ball/bull geometry, inches. */
  effectiveDiameter_in: number;
  /** Spindle speed, rev/min. */
  rpm: number;
  /** Radial chip-thinning factor applied (>= 1). */
  radialChipThinningFactor: number;
  /** Adjusted feed per tooth after thinning, in/tooth. */
  chipload_in: number;
  /** Table feed rate, in/min (IPM). */
  feed_ipm: number;
  /** Material removal rate, in³/min. */
  mrr_in3min: number;
  /** Power consumed at the cutter, hp. */
  cuttingPower_hp: number;
  /** Power required at the motor (cutting / efficiency), hp. */
  motorPower_hp: number;
  /** Cutting torque at the tool, lb-ft. */
  cuttingTorque_lbft: number;
  /** Tangential cutting force, lbf. */
  tangentialForce_lbf: number;
  /** Radial (deflecting) force, lbf. */
  radialForce_lbf: number;
  /** Estimated tool-tip deflection, inches. */
  deflection_in: number;
}
