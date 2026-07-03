/**
 * Phase 8 T3 — manufacturer overrides.
 * AC: override supersedes computed SFM/chipload (demonstrably changes output);
 * exact-material entries beat ISO-group entries; no match → generic path.
 */
import { describe, it, expect } from 'vitest';
import { getMaterial, getTool } from '../index';
import { findMfrOverride, MFR_OVERRIDES } from '../mfrOverrides';
import { resolveMillingInput, activeMfrOverride, pickSFM, pickChipload } from '../resolve';

const alu = getMaterial('al-6061')!;
const steel = getMaterial('steel-1018')!;
const demoTool = getTool('em-flat-0375-3fl-carbide-alu')!; // brand: Example Tooling
const plainTool = getTool('em-flat-050-4fl-carbide')!; // no brand/series

const sel = (tool = demoTool, material = alu) => ({ material, tool, ae_in: 0.1, ap_in: 0.4 });

describe('findMfrOverride matching', () => {
  it('matches brand+series × ISO group; unbranded tools never match', () => {
    expect(findMfrOverride(demoTool, alu)).toBeDefined();
    expect(findMfrOverride(plainTool, alu)).toBeUndefined();
  });

  it('no entry for the material group → undefined (falls back to generic)', () => {
    expect(findMfrOverride(demoTool, steel)).toBeUndefined(); // P group not in example
  });

  it('exact material-id entry beats the ISO-group entry', () => {
    const o = MFR_OVERRIDES[0]!;
    const withExact = {
      ...o,
      byMaterialId: {
        'al-6061': { sfm: { min: 111, max: 222 }, chiploadByDiameter: [{ d_in: 0.375, fz_in: 0.009 }] },
      },
    };
    const exact = withExact.byMaterialId['al-6061']!;
    // simulate registry with the exact entry present
    MFR_OVERRIDES[0] = withExact;
    try {
      expect(findMfrOverride(demoTool, alu)).toEqual(exact);
    } finally {
      MFR_OVERRIDES[0] = o;
    }
  });
});

describe('AC: override supersedes generic SFM/chipload in resolveMillingInput', () => {
  it('branded tool resolves manufacturer numbers, not pickSFM/pickChipload', () => {
    const input = resolveMillingInput({ ...sel(), performance: 50 });
    const genericSfm = pickSFM(alu, demoTool.material, 50);
    const genericFz = pickChipload(alu, demoTool.diameter_in, 50);
    // Example table: sfm 900–1600 @50 → 1250; fz(0.375") 0.004 × 1.0
    expect(input.sfm).toBeCloseTo(1250, 9);
    expect(input.chipload_in).toBeCloseTo(0.004, 9);
    expect(input.sfm).not.toBeCloseTo(genericSfm, 1);
    expect(input.chipload_in).not.toBeCloseTo(genericFz, 5);
  });

  it('performance slider still moves the manufacturer window', () => {
    const lo = resolveMillingInput({ ...sel(), performance: 0 });
    const hi = resolveMillingInput({ ...sel(), performance: 100 });
    expect(lo.sfm).toBeCloseTo(900, 9);
    expect(hi.sfm).toBeCloseTo(1600, 9);
    expect(hi.chipload_in).toBeGreaterThan(lo.chipload_in);
  });

  it('same tool on a non-covered material uses the generic path', () => {
    const input = resolveMillingInput({ ...sel(demoTool, steel), performance: 50 });
    expect(input.sfm).toBeCloseTo(pickSFM(steel, demoTool.material, 50), 9);
  });

  it('activeMfrOverride powers the badge', () => {
    expect(activeMfrOverride(sel())).toBeDefined();
    expect(activeMfrOverride(sel(plainTool))).toBeUndefined();
  });
});
