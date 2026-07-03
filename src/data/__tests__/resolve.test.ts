import { describe, it, expect } from 'vitest';
import {
  pickSFM, pickChipload, interpolateChipload, chiploadPerfMultiplier,
  sfmRangeFor, suggestEngagement, resolveMillingInput, calculate,
} from '../resolve';
import { getMaterial, MATERIALS } from '../materials';
import { getTool, TOOLS } from '../tools';
import { getMachine } from '../machines';

const AL = getMaterial('al-6061')!;
const EM = getTool('em-flat-050-4fl-carbide')!; // 1/2" carbideCoated... see below

describe('pickSFM', () => {
  it('interpolates carbide window by performance', () => {
    expect(pickSFM(AL, 'carbide', 0)).toBeCloseTo(600, 6);
    expect(pickSFM(AL, 'carbide', 50)).toBeCloseTo(900, 6);
    expect(pickSFM(AL, 'carbide', 100)).toBeCloseTo(1200, 6);
  });

  it('derives HSS as 0.5x carbide', () => {
    const r = sfmRangeFor(AL, 'hss');
    expect(r.min).toBeCloseTo(300, 6);
    expect(r.max).toBeCloseTo(600, 6);
    expect(pickSFM(AL, 'hss', 50)).toBeCloseTo(450, 6);
  });

  it('derives coated carbide as 1.25x carbide', () => {
    expect(pickSFM(AL, 'carbideCoated', 100)).toBeCloseTo(1500, 6);
  });

  it('clamps performance outside 0..100', () => {
    expect(pickSFM(AL, 'carbide', -20)).toBeCloseTo(600, 6);
    expect(pickSFM(AL, 'carbide', 200)).toBeCloseTo(1200, 6);
  });
});

describe('chipload interpolation', () => {
  it('midpoint between table points (plan §2.3 interpolation AC)', () => {
    // aluminum: 0.25 -> 0.002, 0.5 -> 0.003; midpoint 0.375 -> 0.0025
    expect(interpolateChipload(AL.chiploadByDiameter, 0.375)).toBeCloseTo(0.0025, 6);
  });

  it('clamps below/above the table', () => {
    expect(interpolateChipload(AL.chiploadByDiameter, 0.01)).toBeCloseTo(0.0005, 6);
    expect(interpolateChipload(AL.chiploadByDiameter, 5)).toBeCloseTo(0.005, 6);
  });

  it('performance multiplier anchors', () => {
    expect(chiploadPerfMultiplier(0)).toBeCloseTo(0.8, 6);
    expect(chiploadPerfMultiplier(50)).toBeCloseTo(1.0, 6);
    expect(chiploadPerfMultiplier(100)).toBeCloseTo(1.35, 6);
  });

  it('pickChipload combines interpolation and performance', () => {
    expect(pickChipload(AL, 0.5, 50)).toBeCloseTo(0.003, 6); // balanced = table value
    expect(pickChipload(AL, 0.5, 0)).toBeCloseTo(0.0024, 6);
    expect(pickChipload(AL, 0.5, 100)).toBeCloseTo(0.00405, 6);
  });
});

describe('suggestEngagement', () => {
  it('returns strategy ratios', () => {
    expect(suggestEngagement(0.5, 'slot')).toMatchObject({ ae_in: 0.5, ap_in: 0.375 });
    expect(suggestEngagement(0.5, 'profile')).toMatchObject({ ae_in: 0.2, ap_in: 0.5 });
    expect(suggestEngagement(0.5, 'hsm')).toMatchObject({ ae_in: 0.05, ap_in: 1.0 });
  });

  it('clamps axial depth to flute length and flags it', () => {
    const e = suggestEngagement(0.5, 'hsm', 0.6); // ap would be 1.0
    expect(e.ap_in).toBe(0.6);
    expect(e.apClampedToFlute).toBe(true);
  });
});

describe('resolveMillingInput + calculate', () => {
  it('produces a coherent input for a balanced aluminum cut', () => {
    const input = resolveMillingInput({
      material: AL,
      tool: getTool('em-flat-050-2fl-hss')!, // HSS 1/2" so SFM derivation is exercised
      ae_in: 0.05,
      ap_in: 0.5,
      performance: 50,
    });
    expect(input.sfm).toBeCloseTo(450, 6); // HSS aluminum balanced
    expect(input.chipload_in).toBeCloseTo(0.003, 6);
    expect(input.diameter_in).toBe(0.5);
    expect(input.flutes).toBe(2);
  });

  it('calculate() returns finite results and respects effective diameter', () => {
    const r = calculate({
      material: AL,
      tool: getTool('em-ball-050-2fl-carbide')!,
      ae_in: 0.05,
      ap_in: 0.05, // shallow -> effective diameter < D
      performance: 50,
    });
    expect(r.effectiveDiameter_in).toBeCloseTo(0.3, 6);
    expect(Number.isFinite(r.rpm)).toBe(true);
    expect(Number.isFinite(r.feed_ipm)).toBe(true);
  });

  it('machine efficiency flows into motor power', () => {
    const vmc = getMachine('mill-vmc-20hp')!;
    const sel = {
      material: getMaterial('steel-1018')!,
      tool: EM,
      ae_in: 0.1,
      ap_in: 0.25,
      performance: 50,
    };
    const withMachine = calculate({ ...sel, machine: vmc });
    const withoutMachine = calculate(sel); // default efficiency 0.80
    // VMC efficiency (0.85) > default (0.80) -> lower required motor power
    expect(withMachine.motorPower_hp).toBeLessThan(withoutMachine.motorPower_hp);
  });
});

describe('integration: every material x milling tool produces finite output', () => {
  const MILLING_TYPES = new Set(['flatEndmill', 'ballEndmill', 'bullEndmill', 'highFeedMill', 'faceMill']);
  const millingTools = TOOLS.filter((t) => MILLING_TYPES.has(t.type));

  it('no NaN/Infinity across the seed matrix at three performance levels', () => {
    for (const material of MATERIALS) {
      for (const tool of millingTools) {
        const eng = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);
        for (const performance of [0, 50, 100]) {
          const r = calculate({ material, tool, ae_in: eng.ae_in, ap_in: eng.ap_in, performance });
          for (const v of Object.values(r)) {
            expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });
});
