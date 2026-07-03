import { describe, it, expect } from 'vitest';
import { radialChipThinningFactor, effectiveDiameter } from '../chipThinning';
import { EngineError } from '../validate';

describe('radialChipThinningFactor', () => {
  it('is 1.0 at half engagement (ae = D/2)', () => {
    expect(radialChipThinningFactor(0.25, 0.5)).toBeCloseTo(1.0, 6);
  });

  it('matches plan §2.5 worked examples', () => {
    expect(radialChipThinningFactor(0.125, 0.5)).toBeCloseTo(1.1547, 4); // r=0.25
    expect(radialChipThinningFactor(0.05, 0.5)).toBeCloseTo(1.6667, 4); // r=0.10
  });

  it('returns 1.0 above half engagement (incl. full slot)', () => {
    expect(radialChipThinningFactor(0.4, 0.5)).toBe(1);
    expect(radialChipThinningFactor(0.5, 0.5)).toBe(1);
    expect(radialChipThinningFactor(0.6, 0.5)).toBe(1); // ae > D
  });

  it('clamps to the ceiling at very small engagement', () => {
    expect(radialChipThinningFactor(0.001, 0.5)).toBe(3.0); // would be ~11 unclamped
    expect(radialChipThinningFactor(0.001, 0.5, 5)).toBe(5.0);
  });

  it('throws on invalid input', () => {
    expect(() => radialChipThinningFactor(0, 0.5)).toThrow(EngineError);
    expect(() => radialChipThinningFactor(0.1, -1)).toThrow(EngineError);
  });
});

describe('effectiveDiameter', () => {
  it('flat tools always return nominal diameter', () => {
    expect(effectiveDiameter('flatEndmill', 0.5, 0.05)).toBe(0.5);
    expect(effectiveDiameter('faceMill', 2, 0.1)).toBe(2);
  });

  it('ball: shallow DOC reduces effective diameter (plan §2.6)', () => {
    expect(effectiveDiameter('ballEndmill', 0.5, 0.05)).toBeCloseTo(0.3, 6);
  });

  it('ball: ap >= radius returns full diameter', () => {
    expect(effectiveDiameter('ballEndmill', 0.5, 0.25)).toBe(0.5);
    expect(effectiveDiameter('ballEndmill', 0.5, 0.4)).toBe(0.5);
  });

  it('bull: shallow DOC within corner radius reduces diameter', () => {
    // D=0.5, rc=0.0625, ap=0.03 -> 0.5 - 0.125 + 2*sqrt(0.03*(0.125-0.03))
    const d = effectiveDiameter('bullEndmill', 0.5, 0.03, 0.0625);
    expect(d).toBeCloseTo(0.5 - 0.125 + 2 * Math.sqrt(0.03 * (0.125 - 0.03)), 6);
    expect(d).toBeLessThan(0.5);
  });

  it('bull: ap >= corner radius returns full diameter', () => {
    expect(effectiveDiameter('bullEndmill', 0.5, 0.1, 0.0625)).toBe(0.5);
  });
});
