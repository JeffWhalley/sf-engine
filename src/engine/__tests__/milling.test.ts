import { describe, it, expect } from 'vitest';
import {
  computeMilling, rpmFromSurfaceSpeed, surfaceSpeedFromRpm, feedRate,
} from '../milling';
import { mmToIn, mminToSfm, ipmToMmmin } from '../units';
import { VECTOR_A } from './vectors';
import type { MillingResult } from '../types';

describe('milling primitives', () => {
  it('rpmFromSurfaceSpeed §2.2', () => {
    expect(rpmFromSurfaceSpeed(600, 0.5)).toBeCloseTo(4583.66, 1);
  });
  it('surfaceSpeedFromRpm inverts rpmFromSurfaceSpeed', () => {
    expect(surfaceSpeedFromRpm(4583.66, 0.5)).toBeCloseTo(600, 1);
  });
  it('feedRate §2.3', () => {
    expect(feedRate(4583.66, 4, 0.003)).toBeCloseTo(55.0, 1);
  });
});

describe('computeMilling — Vector A (golden)', () => {
  const r = computeMilling(VECTOR_A.input);
  const e = VECTOR_A.expected;

  const checks: [keyof MillingResult, number, number][] = [
    ['rpm', e.rpm!, 1],
    ['radialChipThinningFactor', e.radialChipThinningFactor!, 3],
    ['chipload_in', e.chipload_in!, 5],
    ['feed_ipm', e.feed_ipm!, 1],
    ['mrr_in3min', e.mrr_in3min!, 3],
    ['cuttingPower_hp', e.cuttingPower_hp!, 3],
    ['motorPower_hp', e.motorPower_hp!, 3],
    ['cuttingTorque_lbft', e.cuttingTorque_lbft!, 3],
    ['tangentialForce_lbf', e.tangentialForce_lbf!, 1],
    ['radialForce_lbf', e.radialForce_lbf!, 1],
    ['deflection_in', e.deflection_in!, 5],
  ];

  for (const [key, expected, digits] of checks) {
    it(`${key} ≈ ${expected}`, () => {
      expect(r[key] as number).toBeCloseTo(expected, digits);
    });
  }
});

describe('computeMilling — Vector B (metric, converted at boundary)', () => {
  // Vc 120 m/min, D 10mm, Z 4, fz 0.05mm, ae 5mm (=0.5D), ap 5mm, mild steel.
  const input = {
    sfm: mminToSfm(120),
    diameter_in: mmToIn(10),
    flutes: 4,
    chipload_in: mmToIn(0.05),
    ae_in: mmToIn(5),
    ap_in: mmToIn(5),
    toolType: 'flatEndmill' as const,
    unitPower: 1.1,
    stickout_in: mmToIn(40),
    toolMaterial: 'carbide' as const,
  };
  const r = computeMilling(input);

  it('RPM ≈ 3819.7', () => {
    expect(r.rpm).toBeCloseTo(3819.7, 0);
  });
  it('no radial thinning at half engagement', () => {
    expect(r.radialChipThinningFactor).toBeCloseTo(1.0, 6);
  });
  it('feed ≈ 763.9 mm/min', () => {
    expect(ipmToMmmin(r.feed_ipm)).toBeCloseTo(763.9, 0);
  });
});

describe('computeMilling — ball nose uses effective diameter', () => {
  const flat = computeMilling({ ...VECTOR_A.input, toolType: 'flatEndmill' });
  const ball = computeMilling({ ...VECTOR_A.input, toolType: 'ballEndmill', ap_in: 0.05 });
  it('ball at shallow DOC spins faster (smaller Deff)', () => {
    expect(ball.effectiveDiameter_in).toBeCloseTo(0.3, 6);
    expect(ball.rpm).toBeGreaterThan(flat.rpm);
  });
});
