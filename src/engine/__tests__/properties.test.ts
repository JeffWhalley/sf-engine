import { describe, it, expect } from 'vitest';
import { computeMilling } from '../milling';
import { radialChipThinningFactor } from '../chipThinning';
import { EngineError } from '../validate';
import { VECTOR_A } from './vectors';
import type { MillingInput } from '../types';

describe('properties', () => {
  it('RPM strictly decreases as diameter increases', () => {
    let prev = Infinity;
    for (const d of [0.125, 0.25, 0.5, 0.75, 1.0]) {
      const r = computeMilling({ ...VECTOR_A.input, diameter_in: d });
      expect(r.rpm).toBeLessThan(prev);
      prev = r.rpm;
    }
  });

  it('feed increases with flute count', () => {
    const f2 = computeMilling({ ...VECTOR_A.input, flutes: 2 });
    const f4 = computeMilling({ ...VECTOR_A.input, flutes: 4 });
    expect(f4.feed_ipm).toBeGreaterThan(f2.feed_ipm);
  });

  it('RCTF >= 1 always, = 1 at half engagement', () => {
    for (let r = 0.02; r <= 0.99; r += 0.03) {
      expect(radialChipThinningFactor(r * 0.5, 0.5)).toBeGreaterThanOrEqual(1);
    }
    expect(radialChipThinningFactor(0.25, 0.5)).toBe(1);
  });
});

describe('boundary & error handling', () => {
  it('rejects non-positive numeric inputs (no NaN leaks)', () => {
    expect(() => computeMilling({ ...VECTOR_A.input, diameter_in: 0 })).toThrow(EngineError);
    expect(() => computeMilling({ ...VECTOR_A.input, sfm: -1 })).toThrow(EngineError);
    expect(() => computeMilling({ ...VECTOR_A.input, flutes: 0 })).toThrow(EngineError);
    expect(() => computeMilling({ ...VECTOR_A.input, ae_in: NaN })).toThrow(EngineError);
  });
});

describe('no-NaN guarantee over randomized in-range inputs', () => {
  it('all outputs are finite for valid inputs', () => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    for (let i = 0; i < 500; i++) {
      const D = rand(0.05, 1.5);
      const input: MillingInput = {
        sfm: rand(50, 1200),
        diameter_in: D,
        flutes: Math.ceil(rand(1, 6)),
        chipload_in: rand(0.0005, 0.01),
        ae_in: rand(0.001, D), // up to full slot
        ap_in: rand(0.005, 2),
        toolType: 'flatEndmill',
        unitPower: rand(0.1, 2.5),
        efficiency: rand(0.6, 0.95),
        stickout_in: rand(0.3, 4),
        toolMaterial: 'carbide',
      };
      const r = computeMilling(input);
      for (const v of Object.values(r)) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
