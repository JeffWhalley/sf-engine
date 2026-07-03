import { describe, it, expect } from 'vitest';
import {
  inToMm, mmToIn, mminToSfm, sfmToMmin, kwToHp, hpToKw,
  nmToLbft, lbftToNm, gpaToPsi, convert,
} from '../units';

describe('units', () => {
  it('in <-> mm round trips within 1e-9', () => {
    for (const v of [0.0625, 0.125, 0.25, 0.5, 1, 3.937]) {
      expect(mmToIn(inToMm(v))).toBeCloseTo(v, 9);
    }
  });

  it('known length conversions', () => {
    expect(inToMm(1)).toBeCloseTo(25.4, 9);
    expect(mmToIn(25.4)).toBeCloseTo(1, 9);
  });

  it('surface speed conversions', () => {
    // 120 m/min ≈ 393.70 ft/min
    expect(mminToSfm(120)).toBeCloseTo(393.7, 1);
    expect(sfmToMmin(393.7)).toBeCloseTo(120, 1);
  });

  it('power conversions', () => {
    expect(hpToKw(1)).toBeCloseTo(0.7457, 4);
    expect(kwToHp(0.7457)).toBeCloseTo(1, 4);
  });

  it('torque conversions', () => {
    expect(nmToLbft(1)).toBeCloseTo(0.737562, 5);
    expect(lbftToNm(0.737562)).toBeCloseTo(1, 5);
  });

  it('stiffness conversion (carbide ~620 GPa ~ 90 Mpsi)', () => {
    expect(gpaToPsi(620)).toBeCloseTo(89_923_374, -3); // within ~1000 psi
  });

  it('convert() dispatcher matches named helpers', () => {
    expect(convert(120, 'mmin', 'sfm')).toBeCloseTo(mminToSfm(120), 6);
    expect(convert(10, 'mm', 'in')).toBeCloseTo(mmToIn(10), 9);
    expect(convert(0.5, 'in', 'in')).toBe(0.5);
  });
});
