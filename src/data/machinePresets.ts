/**
 * Machine presets — Phase 7b (LAUNCH-PLAN.md F9).
 *
 * Curated starting profiles a user adopts into their library ("start from
 * preset → edit"), keyed to the existing Machine type. They are NOT in the
 * default MACHINES picker list; the UI offers them via a searchable preset
 * picker that copies one into userMachines.
 *
 * ⚠ **[HUMAN] review every number before launch (standing rule 6).** Figures
 * are approximations of manufacturer PUBLIC specs (nameplate power, spindle
 * range, taper) with conservative judgment calls for efficiency/rigidity/
 * feed. They are starting points, not guarantees — machines vary by year and
 * options. Sources noted per entry; verify against the maker's current page.
 *
 * maxTorque_lbft ≈ 5252 × hp / baseRpm (constant-power approximation).
 */

import type { Machine } from './types';

export const MACHINE_PRESETS: Machine[] = [
  // ── CNC bench/prosumer mills ──────────────────────────────────────────────
  {
    // Tormach public spec: 3/4 hp, 10k rpm, R8 (TTS), ~135 ipm rapids.
    id: 'preset-tormach-440',
    name: 'Tormach PCNC 440',
    maxRpm: 10000, minRpm: 200, maxPower_hp: 0.75, efficiency: 0.75,
    maxFeed_ipm: 100, baseRpm: 5000, maxTorque_lbft: 0.79,
    rigidity: 'light', taper: 'R8/TTS',
  },
  {
    // Tormach public spec: ~1.5 hp peak, 10,350 rpm, R8 (TTS).
    id: 'preset-tormach-770',
    name: 'Tormach PCNC 770',
    maxRpm: 10350, minRpm: 175, maxPower_hp: 1.5, efficiency: 0.75,
    maxFeed_ipm: 135, baseRpm: 5175, maxTorque_lbft: 1.52,
    rigidity: 'light', taper: 'R8/TTS',
  },
  {
    // Tormach public spec: 2 hp, 5,140 rpm, R8 (TTS).
    id: 'preset-tormach-1100m',
    name: 'Tormach 1100M',
    maxRpm: 5140, minRpm: 100, maxPower_hp: 2, efficiency: 0.78,
    maxFeed_ipm: 110, baseRpm: 2570, maxTorque_lbft: 4.09,
    rigidity: 'medium', taper: 'R8/TTS',
  },
  {
    // Syil public spec: BT30, ~4 kW (5.4 hp), 12,000 rpm, fast rapids.
    id: 'preset-syil-x5',
    name: 'Syil X5 (BT30)',
    maxRpm: 12000, minRpm: 100, maxPower_hp: 5.4, efficiency: 0.82,
    maxFeed_ipm: 400, baseRpm: 6000, maxTorque_lbft: 4.73,
    rigidity: 'medium', taper: 'BT30',
  },
  {
    // Generic X2-class mini-mill CNC conversion: ~0.6 hp brushed/brushless.
    id: 'preset-x2-conversion',
    name: 'Mini Mill CNC conversion (X2-class)',
    maxRpm: 2500, minRpm: 100, maxPower_hp: 0.6, efficiency: 0.7,
    maxFeed_ipm: 60, baseRpm: 1250, maxTorque_lbft: 2.52,
    rigidity: 'light', taper: 'R8',
  },
  {
    // Precision Matthews public spec: PM-25MV ~1 hp brushless, 2,500 rpm, R8.
    id: 'preset-pm25mv',
    name: 'PM-25MV (CNC-converted)',
    maxRpm: 2500, minRpm: 100, maxPower_hp: 1, efficiency: 0.72,
    maxFeed_ipm: 80, baseRpm: 1250, maxTorque_lbft: 4.2,
    rigidity: 'light', taper: 'R8',
  },
  // ── Industrial VMCs ───────────────────────────────────────────────────────
  {
    // Haas public spec: Mini Mill 6,000 rpm, 7.5 hp, CAT40.
    id: 'preset-haas-minimill',
    name: 'Haas Mini Mill',
    maxRpm: 6000, minRpm: 50, maxPower_hp: 7.5, efficiency: 0.85,
    maxFeed_ipm: 500, baseRpm: 1200, maxTorque_lbft: 32.8,
    rigidity: 'rigid', taper: 'CAT40',
  },
  {
    // Haas public spec: VF-2 8,100 rpm, 30 hp, CAT40.
    id: 'preset-haas-vf2',
    name: 'Haas VF-2',
    maxRpm: 8100, minRpm: 50, maxPower_hp: 30, efficiency: 0.85,
    maxFeed_ipm: 650, baseRpm: 1400, maxTorque_lbft: 112.5,
    rigidity: 'rigid', taper: 'CAT40',
  },
  {
    // Brother public spec: Speedio-class 16k rpm BT30 drill-tap, ~10 hp cont.
    id: 'preset-brother-speedio',
    name: 'Brother Speedio (BT30 drill-tap)',
    maxRpm: 16000, minRpm: 100, maxPower_hp: 10, efficiency: 0.85,
    maxFeed_ipm: 1000, baseRpm: 4000, maxTorque_lbft: 13.1,
    rigidity: 'rigid', taper: 'BT30',
  },
  // ── Manual / knee mills ───────────────────────────────────────────────────
  {
    // Bridgeport Series I vari-speed: 2 hp, 60–4,200 rpm, R8.
    id: 'preset-bridgeport-series1',
    name: 'Bridgeport Series I (2 HP vari-speed)',
    maxRpm: 4200, minRpm: 60, maxPower_hp: 2, efficiency: 0.72,
    maxFeed_ipm: 40, baseRpm: 1000, maxTorque_lbft: 10.5,
    rigidity: 'medium', taper: 'R8',
  },
  {
    // Generic import knee mill with 8-speed gearbox (step pulleys).
    id: 'preset-knee-gearbox',
    name: 'Knee mill, 8-speed gearbox',
    maxRpm: 2720, minRpm: 80, maxPower_hp: 1.5, efficiency: 0.7,
    maxFeed_ipm: 30,
    discreteRpms: [80, 220, 420, 660, 1100, 1600, 2200, 2720],
    rigidity: 'medium', taper: 'R8',
  },
  // ── Routers ───────────────────────────────────────────────────────────────
  {
    // Trim-router class (Makita RT0701-style): 1.25 hp, 10–30k rpm, ER11.
    id: 'preset-router-trim',
    name: 'Hobby router, trim-router spindle',
    maxRpm: 30000, minRpm: 10000, maxPower_hp: 1.25, efficiency: 0.65,
    maxFeed_ipm: 150, baseRpm: 20000, maxTorque_lbft: 0.33,
    rigidity: 'light', taper: 'ER11',
  },
  {
    // Common 2.2 kW Chinese VFD spindle on a rigid hobby frame, ER20.
    id: 'preset-router-22kw',
    name: 'Hobby/pro router, 2.2 kW spindle',
    maxRpm: 24000, minRpm: 6000, maxPower_hp: 3, efficiency: 0.78,
    maxFeed_ipm: 300, baseRpm: 12000, maxTorque_lbft: 1.31,
    rigidity: 'light', taper: 'ER20',
  },
  {
    // 4×8 industrial router (Avid-class) with 4 hp spindle.
    id: 'preset-router-4x8',
    name: 'Industrial router 4×8, 4 HP',
    maxRpm: 24000, minRpm: 6000, maxPower_hp: 4, efficiency: 0.8,
    maxFeed_ipm: 500, baseRpm: 12000, maxTorque_lbft: 1.75,
    rigidity: 'medium', taper: 'ER32',
  },
  // ── Generic spindles (when the user's machine isn't listed) ──────────────
  {
    id: 'preset-generic-10k-3hp',
    name: 'Generic 10k RPM / 3 HP spindle',
    maxRpm: 10000, minRpm: 100, maxPower_hp: 3, efficiency: 0.8,
    maxFeed_ipm: 200, baseRpm: 3000, maxTorque_lbft: 5.25,
    rigidity: 'medium', taper: 'ISO30',
  },
  {
    id: 'preset-generic-20k-9hp',
    name: 'Generic 20k RPM / 9 HP spindle',
    maxRpm: 20000, minRpm: 200, maxPower_hp: 9, efficiency: 0.82,
    maxFeed_ipm: 600, baseRpm: 5000, maxTorque_lbft: 9.45,
    rigidity: 'rigid', taper: 'HSK63',
  },
  // ── Lathes (turning mode) ─────────────────────────────────────────────────
  {
    // Generic 12×36 manual/CNC-converted lathe, 2 hp.
    id: 'preset-lathe-12x36',
    name: 'Lathe 12×36, 2 HP',
    maxRpm: 2500, minRpm: 40, maxPower_hp: 2, efficiency: 0.75,
    maxFeed_ipm: 30, baseRpm: 800, maxTorque_lbft: 13.1,
    rigidity: 'medium', taper: 'D1-4',
  },
  {
    // Haas public spec: ST-10 6,000 rpm, 15 hp.
    id: 'preset-haas-st10',
    name: 'Haas ST-10 (CNC lathe)',
    maxRpm: 6000, minRpm: 50, maxPower_hp: 15, efficiency: 0.85,
    maxFeed_ipm: 500, baseRpm: 1200, maxTorque_lbft: 65.7,
    rigidity: 'rigid', taper: 'A2-5',
  },
];

/** Case-insensitive substring search over preset names (and taper). */
export function searchMachinePresets(query: string): Machine[] {
  const q = query.trim().toLowerCase();
  if (!q) return MACHINE_PRESETS;
  return MACHINE_PRESETS.filter(
    (m) => m.name.toLowerCase().includes(q) || (m.taper ?? '').toLowerCase().includes(q),
  );
}
