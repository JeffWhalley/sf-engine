import { describe, it, expect } from 'vitest';
import {
  computeDrilling,
  drillRpm,
  drillMrr,
  suggestPeck,
  thrustEstimate,
} from '../drilling';
import { EngineError } from '../validate';

/**
 * Golden Vector D-A — every number documented in drilling.ts header.
 * 1/2" HSS twist drill, 6061 aluminum, SFM 250, IPR 0.008,
 * unit power 0.25, Kc 700, depth 2.0", efficiency 0.85.
 */
const VECTOR_DA = {
  sfm: 250,
  diameter_in: 0.5,
  ipr: 0.008,
  holeDepth_in: 2.0,
  unitPower_hpMinIn3: 0.25,
  kc_nPerMm2: 700,
  efficiency: 0.85,
};

describe('Golden Vector D-A (aluminum, 1/2" HSS)', () => {
  const r = computeDrilling(VECTOR_DA);

  it('RPM = 1909.86', () => expect(r.rpm).toBeCloseTo(1909.86, 1));
  it('feed = 15.279 IPM', () => expect(r.feed_ipm).toBeCloseTo(15.279, 2));
  it('MRR = 3.000 in³/min', () => expect(r.mrr_in3PerMin).toBeCloseTo(3.0, 3));
  it('cutter power = 0.750 hp', () =>
    expect(r.powerAtCutter_hp).toBeCloseTo(0.75, 3));
  it('motor power = 0.882 hp at η=0.85', () =>
    expect(r.powerAtMotor_hp).toBeCloseTo(0.75 / 0.85, 3));
  it('torque = 24.75 in·lbf', () => expect(r.torque_inLbf).toBeCloseTo(24.75, 1));
  it('thrust ≈ 203 lbf', () => expect(r.thrust_lbf!).toBeCloseTo(203.1, 0));
  it('depth 4×D → peck at 1×D', () => {
    expect(r.peck.needed).toBe(true);
    expect(r.peck.peckDepth_in).toBeCloseTo(0.5, 6);
  });
  it('no clamp, no non-finite values', () => {
    expect(r.rpmClamped).toBe(false);
    for (const v of Object.values(r)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('RPM clamping', () => {
  it('clamps to maxRpm, warns, and feed follows clamped rpm', () => {
    const r = computeDrilling({ ...VECTOR_DA, maxRpm: 1000 });
    expect(r.rpm).toBe(1000);
    expect(r.rpmClamped).toBe(true);
    expect(r.feed_ipm).toBeCloseTo(8.0, 3); // 1000 × 0.008
    expect(r.warnings.join(' ')).toMatch(/clamped/i);
  });
});

describe('peck advice boundaries', () => {
  it('≤3×D no peck', () =>
    expect(suggestPeck(0.5, 1.5).needed).toBe(false));
  it('3–5×D pecks at 1×D', () => {
    const p = suggestPeck(0.5, 2.4);
    expect(p.needed).toBe(true);
    expect(p.peckDepth_in).toBeCloseTo(0.5, 6);
  });
  it('>5×D pecks at 0.6×D and mentions parabolic drills', () => {
    const p = suggestPeck(0.25, 2.0); // 8×D
    expect(p.peckDepth_in).toBeCloseTo(0.15, 6);
    expect(p.note).toMatch(/parabolic/i);
  });
  it('zero depth skips advice', () =>
    expect(suggestPeck(0.5, 0).needed).toBe(false));
});

describe('advisories', () => {
  it('small drill (<1/8") gets a spotting warning', () => {
    const r = computeDrilling({ ...VECTOR_DA, diameter_in: 0.0625, ipr: 0.001 });
    expect(r.warnings.join(' ')).toMatch(/spot or center drill/i);
  });
  it('high thrust gets a workholding warning (1" drill in steel)', () => {
    const r = computeDrilling({
      sfm: 90,
      diameter_in: 1.0,
      ipr: 0.015,
      unitPower_hpMinIn3: 1.0,
      kc_nPerMm2: 2000,
    });
    expect(r.thrust_lbf!).toBeGreaterThan(500);
    expect(r.warnings.join(' ')).toMatch(/workholding/i);
  });
  it('omitting kc omits thrust and its warning', () => {
    const r = computeDrilling({ ...VECTOR_DA, kc_nPerMm2: undefined });
    expect(r.thrust_lbf).toBeUndefined();
  });
});

describe('validation', () => {
  it.each([
    ['sfm', { ...VECTOR_DA, sfm: 0 }],
    ['diameter', { ...VECTOR_DA, diameter_in: -1 }],
    ['ipr', { ...VECTOR_DA, ipr: NaN }],
    ['unit power', { ...VECTOR_DA, unitPower_hpMinIn3: 0 }],
    ['efficiency', { ...VECTOR_DA, efficiency: 1.2 }],
    ['depth', { ...VECTOR_DA, holeDepth_in: -0.1 }],
  ])('rejects invalid %s', (_name, input) => {
    expect(() => computeDrilling(input as never)).toThrow(EngineError);
  });
});

describe('properties (randomized sweep)', () => {
  it('500 random valid inputs → all outputs finite', () => {
    let seed = 42;
    const rnd = () => {
      // xorshift-ish deterministic PRNG so failures reproduce
      seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
      return Math.abs(seed % 10_000) / 10_000;
    };
    for (let i = 0; i < 500; i++) {
      const r = computeDrilling({
        sfm: 20 + rnd() * 800,
        diameter_in: 0.03 + rnd() * 1.5,
        ipr: 0.0005 + rnd() * 0.02,
        holeDepth_in: rnd() * 6,
        unitPower_hpMinIn3: 0.15 + rnd() * 1.6,
        kc_nPerMm2: 400 + rnd() * 2600,
        efficiency: 0.6 + rnd() * 0.4,
        maxRpm: rnd() > 0.5 ? 500 + rnd() * 20000 : undefined,
      });
      for (const v of Object.values(r)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('monotonic: RPM falls as diameter grows', () => {
    expect(drillRpm(200, 0.25)).toBeGreaterThan(drillRpm(200, 0.5));
    expect(drillRpm(200, 0.5)).toBeGreaterThan(drillRpm(200, 1.0));
  });
  it('monotonic: thrust rises with feed and diameter', () => {
    expect(thrustEstimate(2000, 0.010, 0.5)).toBeGreaterThan(
      thrustEstimate(2000, 0.005, 0.5),
    );
    expect(thrustEstimate(2000, 0.008, 1.0)).toBeGreaterThan(
      thrustEstimate(2000, 0.008, 0.5),
    );
  });
  it('monotonic: MRR rises with feed', () => {
    expect(drillMrr(0.5, 16)).toBeGreaterThan(drillMrr(0.5, 8));
  });
});
