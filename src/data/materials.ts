/**
 * Seed material database. Plan §3.1, §3.4.
 *
 * SFM ranges and unit-power values are deliberately conservative *starting
 * points*, not manufacturer data. Refine via the Phase 8 override path.
 *
 * Chipload tables are generated from a single reference feed-per-tooth at 1/2"
 * using the aluminum table's shape ratios (plan §3.4), so every material gets a
 * consistent diameter scaling. The aluminum reference (0.003") reproduces the
 * plan's §3.4 table exactly.
 */

import type { Material, ChiploadPoint } from './types';

const D_POINTS = [0.0625, 0.125, 0.25, 0.5, 0.75, 1.0];
// Feed-per-tooth as a fraction of the 1/2" reference, per diameter point.
const SHAPE = [1 / 6, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3];

const round5 = (x: number): number => Math.round(x * 1e5) / 1e5;

/** Build a chipload-vs-diameter table from the feed-per-tooth at 1/2". */
function chiploadTable(refAtHalfInch: number): ChiploadPoint[] {
  return D_POINTS.map((d, i) => ({ d_in: d, fz_in: round5(refAtHalfInch * SHAPE[i]) }));
}

export const MATERIALS: Material[] = [
  {
    id: 'al-6061',
    name: '6061-T6 Aluminum',
    isoGroup: 'N',
    hardnessBhn: [95, 95],
    sfmCarbide: { min: 600, max: 1200 },
    chiploadByDiameter: chiploadTable(0.003),
    unitPower: 0.3,
    kc: 800,
    notes: 'Free-machining; favors high SFM, sharp uncoated or DLC tools.',
  },
  {
    id: 'brass-360',
    name: 'Brass 360 (free-cutting)',
    isoGroup: 'N',
    hardnessBhn: [100, 130],
    sfmCarbide: { min: 500, max: 800 },
    chiploadByDiameter: chiploadTable(0.002),
    unitPower: 0.55,
    kc: 1300,
  },
  {
    id: 'steel-1018',
    name: 'Mild Steel 1018',
    isoGroup: 'P',
    hardnessBhn: [120, 170],
    sfmCarbide: { min: 300, max: 450 },
    chiploadByDiameter: chiploadTable(0.002),
    unitPower: 1.1,
    kc: 1800,
  },
  {
    id: 'steel-4140-annealed',
    name: 'Alloy Steel 4140 (annealed)',
    isoGroup: 'P',
    hardnessBhn: [197, 235],
    sfmCarbide: { min: 250, max: 350 },
    chiploadByDiameter: chiploadTable(0.0016),
    unitPower: 1.4,
    kc: 2100,
  },
  {
    id: 'tool-steel-45hrc',
    name: 'Tool Steel (hardened ~45 HRC)',
    isoGroup: 'H',
    hardnessBhn: [421, 421],
    sfmCarbide: { min: 120, max: 200 },
    chiploadByDiameter: chiploadTable(0.001),
    unitPower: 1.9,
    kc: 2600,
    notes: 'Hard milling; keep DOC modest and watch deflection.',
  },
  {
    id: 'ss-304',
    name: 'Stainless 304',
    isoGroup: 'M',
    hardnessBhn: [170, 200],
    sfmCarbide: { min: 200, max: 300 },
    chiploadByDiameter: chiploadTable(0.0015),
    unitPower: 1.5,
    kc: 2400,
    notes: 'Work-hardens; maintain chip load, avoid dwelling.',
  },
  {
    id: 'ss-316',
    name: 'Stainless 316',
    isoGroup: 'M',
    hardnessBhn: [170, 220],
    sfmCarbide: { min: 180, max: 280 },
    chiploadByDiameter: chiploadTable(0.0014),
    unitPower: 1.55,
    kc: 2500,
  },
  {
    id: 'cast-iron-gray',
    name: 'Gray Cast Iron',
    isoGroup: 'K',
    hardnessBhn: [180, 220],
    sfmCarbide: { min: 250, max: 400 },
    chiploadByDiameter: chiploadTable(0.0022),
    unitPower: 0.8,
    kc: 1300,
  },
  {
    id: 'ti-6al-4v',
    name: 'Titanium Ti-6Al-4V',
    isoGroup: 'S',
    hardnessBhn: [330, 360],
    sfmCarbide: { min: 120, max: 200 },
    chiploadByDiameter: chiploadTable(0.0012),
    unitPower: 1.3,
    kc: 1400,
    notes: 'Low SFM, flood coolant, keep the tool moving to manage heat.',
  },
  {
    id: 'inconel-718',
    name: 'Inconel 718',
    isoGroup: 'S',
    hardnessBhn: [350, 450],
    sfmCarbide: { min: 60, max: 120 },
    chiploadByDiameter: chiploadTable(0.0008),
    unitPower: 2.3,
    kc: 3200,
    notes: 'Very abrasive and work-hardening; rigid setups only.',
  },
  {
    id: 'plastic-pc',
    name: 'Polycarbonate (plastic)',
    isoGroup: 'N',
    hardnessBhn: [15, 15],
    sfmCarbide: { min: 500, max: 1000 },
    chiploadByDiameter: chiploadTable(0.004),
    unitPower: 0.1,
    kc: 300,
    notes: 'Single/low flute counts and sharp tools to avoid melting.',
  },
  // ── Common machining plastics — conservative starting points.
  // Heat, not force, is the enemy in all of these: sharp tools, good chip
  // evacuation, and don't dwell. **[HUMAN] review values (standing rule 6).**
  {
    id: 'plastic-acetal',
    name: 'Acetal / Delrin (POM)',
    isoGroup: 'N',
    hardnessBhn: [20, 20],
    sfmCarbide: { min: 400, max: 1200 },
    chiploadByDiameter: chiploadTable(0.004),
    unitPower: 0.12,
    kc: 350,
    notes: 'The best-machining plastic: crisp chips, holds tolerance. Sharp 2-flute, moderate rpm.',
  },
  {
    id: 'plastic-hdpe',
    name: 'HDPE',
    isoGroup: 'N',
    hardnessBhn: [6, 6],
    sfmCarbide: { min: 300, max: 900 },
    chiploadByDiameter: chiploadTable(0.005),
    unitPower: 0.06,
    kc: 200,
    notes: 'Soft and gummy — razor-sharp single/O-flute, big chips to carry heat out, low rpm beats melting.',
  },
  {
    id: 'plastic-uhmw',
    name: 'UHMW-PE',
    isoGroup: 'N',
    hardnessBhn: [5, 5],
    sfmCarbide: { min: 250, max: 700 },
    chiploadByDiameter: chiploadTable(0.005),
    unitPower: 0.06,
    kc: 200,
    notes: 'Stringy, never truly chips — O-flute geometry, climb cut, expect fuzz to trim. Clamps poorly; support well.',
  },
  {
    id: 'plastic-nylon66',
    name: 'Nylon 6/6',
    isoGroup: 'N',
    hardnessBhn: [12, 12],
    sfmCarbide: { min: 300, max: 800 },
    chiploadByDiameter: chiploadTable(0.004),
    unitPower: 0.1,
    kc: 300,
    notes: 'Flexes under the cutter and absorbs moisture (grows ~0.5%): rough, rest, then finish for tolerance.',
  },
  {
    id: 'plastic-acrylic',
    name: 'Acrylic, cast (PMMA)',
    isoGroup: 'N',
    hardnessBhn: [20, 20],
    sfmCarbide: { min: 300, max: 800 },
    chiploadByDiameter: chiploadTable(0.003),
    unitPower: 0.1,
    kc: 300,
    notes: 'Melts and chip-welds easily; cracks under dull tools. O-flute, air blast, CAST sheet only (extruded is far worse).',
  },
  {
    id: 'plastic-ptfe',
    name: 'PTFE / Teflon',
    isoGroup: 'N',
    hardnessBhn: [4, 4],
    sfmCarbide: { min: 200, max: 500 },
    chiploadByDiameter: chiploadTable(0.003),
    unitPower: 0.05,
    kc: 150,
    notes: 'Extremely soft, creeps under clamping and springs back ~1–2 thou — light cuts, gentle fixturing, sharp HSS works fine.',
  },
  {
    id: 'plastic-peek',
    name: 'PEEK',
    isoGroup: 'N',
    hardnessBhn: [25, 25],
    sfmCarbide: { min: 250, max: 600 },
    chiploadByDiameter: chiploadTable(0.003),
    unitPower: 0.15,
    kc: 400,
    notes: 'Engineering thermoplastic; keep it cool (air/coolant) — internal stresses; anneal between ops for tight tolerances.',
  },
  {
    id: 'plastic-abs',
    name: 'ABS',
    isoGroup: 'N',
    hardnessBhn: [10, 10],
    sfmCarbide: { min: 300, max: 800 },
    chiploadByDiameter: chiploadTable(0.004),
    unitPower: 0.08,
    kc: 250,
    notes: 'Machines easily but melts at the drop of a hat — sharp tools, keep the chips moving, no dwelling.',
  },
  {
    id: 'composite-g10',
    name: 'G-10 / FR4 (Garolite)',
    isoGroup: 'N',
    hardnessBhn: [40, 40],
    sfmCarbide: { min: 200, max: 400 },
    chiploadByDiameter: chiploadTable(0.002),
    unitPower: 0.3,
    kc: 600,
    notes: 'Glass-filled: eats HSS in minutes — carbide only, and the dust is abrasive AND hazardous: extraction + respirator.',
  },
];

const MATERIAL_BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

export function getMaterial(id: string): Material | undefined {
  return MATERIAL_BY_ID.get(id);
}

/** Case-insensitive substring search over name/id for the UI's material picker. */
export function searchMaterials(query: string): Material[] {
  const q = query.trim().toLowerCase();
  if (!q) return MATERIALS;
  return MATERIALS.filter(
    (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
  );
}
