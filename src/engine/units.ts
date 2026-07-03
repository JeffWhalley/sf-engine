/**
 * Unit conversions. Plan §2.1.
 *
 * The engine works internally in imperial. These helpers convert at the UI
 * boundary. Round only for display, never mid-calculation.
 */

// --- Exact / standard factors ---
export const MM_PER_IN = 25.4; // exact
export const SFM_PER_MMIN = 3.28084; // ft per metre
export const IN3_PER_CM3 = 1 / 16.387064; // exact-ish (1 in³ = 16.387064 cm³)
export const HP_PER_KW = 1 / 0.7457;
export const LBFT_PER_NM = 0.737562;
export const PSI_PER_GPA = 145037.7;

// --- Length ---
export const inToMm = (v: number): number => v * MM_PER_IN;
export const mmToIn = (v: number): number => v / MM_PER_IN;

// --- Surface speed ---
export const mminToSfm = (v: number): number => v * SFM_PER_MMIN;
export const sfmToMmin = (v: number): number => v / SFM_PER_MMIN;

// --- Feed rate (per-minute linear) uses the same length factor ---
export const ipmToMmmin = (v: number): number => v * MM_PER_IN;
export const mmminToIpm = (v: number): number => v / MM_PER_IN;

// --- Volumetric removal rate ---
export const cm3ToIn3 = (v: number): number => v * IN3_PER_CM3;
export const in3ToCm3 = (v: number): number => v / IN3_PER_CM3;

// --- Power ---
export const kwToHp = (v: number): number => v * HP_PER_KW;
export const hpToKw = (v: number): number => v / HP_PER_KW;

// --- Torque ---
export const nmToLbft = (v: number): number => v * LBFT_PER_NM;
export const lbftToNm = (v: number): number => v / LBFT_PER_NM;

// --- Stiffness ---
export const gpaToPsi = (v: number): number => v * PSI_PER_GPA;
export const psiToGpa = (v: number): number => v / PSI_PER_GPA;

/**
 * Convenience dispatcher for the unit tokens the UI uses.
 * Kept small and explicit on purpose — easy for a simple agent to extend.
 */
export type UnitToken =
  | 'in' | 'mm'
  | 'sfm' | 'mmin'
  | 'ipm' | 'mmmin'
  | 'in3min' | 'cm3min'
  | 'hp' | 'kw'
  | 'lbft' | 'nm'
  | 'psi' | 'gpa';

const TO_CANONICAL: Record<UnitToken, (v: number) => number> = {
  in: (v) => v,
  mm: mmToIn,
  sfm: (v) => v,
  mmin: mminToSfm,
  ipm: (v) => v,
  mmmin: mmminToIpm,
  in3min: (v) => v,
  cm3min: cm3ToIn3,
  hp: (v) => v,
  kw: kwToHp,
  lbft: (v) => v,
  nm: nmToLbft,
  psi: (v) => v,
  gpa: gpaToPsi,
};

const FROM_CANONICAL: Record<UnitToken, (v: number) => number> = {
  in: (v) => v,
  mm: inToMm,
  sfm: (v) => v,
  mmin: sfmToMmin,
  ipm: (v) => v,
  mmmin: ipmToMmmin,
  in3min: (v) => v,
  cm3min: in3ToCm3,
  hp: (v) => v,
  kw: hpToKw,
  lbft: (v) => v,
  nm: lbftToNm,
  psi: (v) => v,
  gpa: psiToGpa,
};

/** Convert `value` from unit `from` to unit `to` (must be the same dimension). */
export function convert(value: number, from: UnitToken, to: UnitToken): number {
  return FROM_CANONICAL[to](TO_CANONICAL[from](value));
}
