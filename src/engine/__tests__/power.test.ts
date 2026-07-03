import { describe, it, expect } from 'vitest';
import {
  mrr, spindlePower, spindlePowerMetricKc, torqueFromPower, cuttingForce,
} from '../power';
import { EngineError } from '../validate';

describe('mrr', () => {
  it('plan §2.7 example', () => {
    expect(mrr(0.05, 0.5, 91.673)).toBeCloseTo(2.292, 3);
  });
});

describe('spindlePower', () => {
  it('plan §2.8 aluminum example', () => {
    const p = spindlePower(2.292, 0.3, 0.8);
    expect(p.cutting_hp).toBeCloseTo(0.688, 3);
    expect(p.motor_hp).toBeCloseTo(0.859, 3);
  });
});

describe('spindlePowerMetricKc', () => {
  it('vector B metric cross-check (~0.573 kW)', () => {
    // ae=5mm, ap=5mm, vf≈763.94 mm/min, kc=1800 N/mm²
    expect(spindlePowerMetricKc(5, 5, 763.94, 1800)).toBeCloseTo(0.573, 3);
  });
});

describe('torqueFromPower', () => {
  it('plan §2.9 example', () => {
    expect(torqueFromPower(0.688, 4583.66)).toBeCloseTo(0.788, 3);
  });
});

describe('cuttingForce', () => {
  it('plan §2.10 example', () => {
    const f = cuttingForce(0.688, 600, 0.4);
    expect(f.tangential_lbf).toBeCloseTo(37.8, 1);
    expect(f.radial_lbf).toBeCloseTo(15.1, 1);
  });

  it('throws on invalid input', () => {
    expect(() => cuttingForce(0, 600)).toThrow(EngineError);
    expect(() => cuttingForce(1, 0)).toThrow(EngineError);
  });
});
