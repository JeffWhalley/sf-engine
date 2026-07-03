import { describe, it, expect } from 'vitest';
import { computeTurning, raTheoretical_uin, turnRpm } from '../turning';
import { EngineError } from '../validate';

/**
 * Golden Vector T-A — every number documented in turning.ts header.
 * 1018 steel, carbide, SFM 400, Ø 2.000", f 0.010 ipr, DOC 0.100",
 * nose radius 1/32", unit power 1.0, efficiency 0.85.
 */
const VECTOR_TA = {
  sfm: 400,
  workpieceDiameter_in: 2.0,
  ipr: 0.010,
  doc_in: 0.100,
  noseRadius_in: 1 / 32,
  unitPower_hpMinIn3: 1.0,
  efficiency: 0.85,
};

describe('Golden Vector T-A (1018 steel, Ø2", carbide)', () => {
  const r = computeTurning(VECTOR_TA);

  it('RPM = 763.94', () => expect(r.rpm).toBeCloseTo(763.94, 1));
  it('feed = 7.639 IPM', () => expect(r.feed_ipm).toBeCloseTo(7.6394, 3));
  it('MRR = 4.800 in³/min', () => expect(r.mrr_in3PerMin).toBeCloseTo(4.8, 3));
  it('cutter power = 4.800 hp', () =>
    expect(r.powerAtCutter_hp).toBeCloseTo(4.8, 3));
  it('motor power = 5.647 hp at η=0.85', () =>
    expect(r.powerAtMotor_hp).toBeCloseTo(4.8 / 0.85, 3));
  it('torque = 396.0 in·lbf', () => expect(r.torque_inLbf).toBeCloseTo(396.0, 0));
  it('achieved SFM equals target when unclamped', () =>
    expect(r.achievedSfm).toBeCloseTo(400, 6));
  it('Ra theoretical = 100 µin', () =>
    expect(r.raTheoretical_uin!).toBeCloseTo(100, 3));
});

describe('RPM clamp & CSS behavior', () => {
  it('small diameter + maxRpm: SFM, MRR, power all follow the clamp', () => {
    // Ø 0.25" at SFM 400 wants 6111 RPM; clamp at 3000.
    const r = computeTurning({
      ...VECTOR_TA,
      workpieceDiameter_in: 0.25,
      maxRpm: 3000,
    });
    expect(r.rpmClamped).toBe(true);
    expect(r.rpm).toBe(3000);
    // achieved SFM = π·0.25·3000/12 = 196.35
    expect(r.achievedSfm).toBeCloseTo(196.35, 1);
    // MRR = 12·196.35·0.010·0.100 = 2.356 — derated with achieved SFM
    expect(r.mrr_in3PerMin).toBeCloseTo(2.356, 2);
    expect(r.warnings.join(' ')).toMatch(/caps surface speed/i);
  });

  it('reports the CSS full-speed diameter threshold', () => {
    const r = computeTurning({ ...VECTOR_TA, maxRpm: 3000 });
    // 12·400/(π·3000) = 0.5093"
    expect(r.cssFullSpeedMinDiameter_in!).toBeCloseTo(0.5093, 3);
    expect(r.rpmClamped).toBe(false); // Ø2" itself is fine
  });

  it('omits threshold without maxRpm', () => {
    expect(computeTurning(VECTOR_TA).cssFullSpeedMinDiameter_in).toBeUndefined();
  });
});

describe('finish advisory', () => {
  it('warns when feed exceeds half the nose radius', () => {
    const r = computeTurning({ ...VECTOR_TA, ipr: 0.020 }); // r/2 = 0.0156
    expect(r.warnings.join(' ')).toMatch(/nose radius/i);
  });
  it('finishing feed produces a fine Ra and no finish warning', () => {
    const r = computeTurning({ ...VECTOR_TA, ipr: 0.004 });
    expect(r.raTheoretical_uin!).toBeCloseTo(16, 0); // 0.004²/(32·(1/32)) = 16 µin
    expect(r.warnings.join(' ')).not.toMatch(/nose radius/i);
  });
  it('no nose radius → no Ra estimate', () => {
    const r = computeTurning({ ...VECTOR_TA, noseRadius_in: undefined });
    expect(r.raTheoretical_uin).toBeUndefined();
  });
});

describe('validation', () => {
  it.each([
    ['sfm', { ...VECTOR_TA, sfm: -5 }],
    ['diameter', { ...VECTOR_TA, workpieceDiameter_in: 0 }],
    ['ipr', { ...VECTOR_TA, ipr: Infinity }],
    ['doc', { ...VECTOR_TA, doc_in: 0 }],
    ['unit power', { ...VECTOR_TA, unitPower_hpMinIn3: NaN }],
    ['efficiency', { ...VECTOR_TA, efficiency: 0 }],
  ])('rejects invalid %s', (_name, input) => {
    expect(() => computeTurning(input as never)).toThrow(EngineError);
  });
});

describe('properties (randomized sweep)', () => {
  it('500 random valid inputs → all outputs finite', () => {
    let seed = 1337;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
      return Math.abs(seed % 10_000) / 10_000;
    };
    for (let i = 0; i < 500; i++) {
      const r = computeTurning({
        sfm: 50 + rnd() * 1200,
        workpieceDiameter_in: 0.1 + rnd() * 8,
        ipr: 0.001 + rnd() * 0.025,
        doc_in: 0.005 + rnd() * 0.3,
        noseRadius_in: rnd() > 0.3 ? 0.008 + rnd() * 0.06 : undefined,
        unitPower_hpMinIn3: 0.15 + rnd() * 1.8,
        efficiency: 0.6 + rnd() * 0.4,
        maxRpm: rnd() > 0.5 ? 800 + rnd() * 8000 : undefined,
      });
      for (const v of Object.values(r)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('monotonic: RPM falls as workpiece diameter grows', () => {
    expect(turnRpm(400, 1)).toBeGreaterThan(turnRpm(400, 2));
    expect(turnRpm(400, 2)).toBeGreaterThan(turnRpm(400, 4));
  });
  it('monotonic: Ra worsens with feed, improves with nose radius', () => {
    expect(raTheoretical_uin(0.012, 0.03125)).toBeGreaterThan(
      raTheoretical_uin(0.006, 0.03125),
    );
    expect(raTheoretical_uin(0.008, 0.015)).toBeGreaterThan(
      raTheoretical_uin(0.008, 0.06),
    );
  });
});
