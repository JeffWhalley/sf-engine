import { describe, it, expect } from 'vitest';
import { deflection, areaMomentOfInertia, YOUNGS_MODULUS_PSI } from '../deflection';

describe('areaMomentOfInertia', () => {
  it('I = π d⁴ / 64', () => {
    expect(areaMomentOfInertia(0.4)).toBeCloseTo((Math.PI * 0.4 ** 4) / 64, 9);
    expect(areaMomentOfInertia(0.4)).toBeCloseTo(0.0012566, 7);
  });
});

describe('deflection', () => {
  it('plan §2.11 worked example (~0.00015 in)', () => {
    const d = deflection(15.126, 1.5, 0.5, YOUNGS_MODULUS_PSI.carbide, 0.8);
    expect(d).toBeCloseTo(0.00015, 5);
  });

  it('scales with the cube of stickout', () => {
    const base = deflection(10, 1, 0.5, YOUNGS_MODULUS_PSI.carbide);
    const doubled = deflection(10, 2, 0.5, YOUNGS_MODULUS_PSI.carbide);
    expect(doubled / base).toBeCloseTo(8, 6);
  });

  it('HSS deflects more than carbide (lower E)', () => {
    const carbide = deflection(10, 1.5, 0.5, YOUNGS_MODULUS_PSI.carbide);
    const hss = deflection(10, 1.5, 0.5, YOUNGS_MODULUS_PSI.hss);
    expect(hss).toBeGreaterThan(carbide);
  });
});
