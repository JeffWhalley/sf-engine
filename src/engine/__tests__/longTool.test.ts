/**
 * Phase 7 T3 — long-tool / reduced-shank derating (PLAN.md §7.3).
 * AC: increasing stickout lowers feed and raises a deflection-related warning.
 */
import { describe, it, expect } from 'vitest';
import {
  assessLongTool,
  NORMAL_STICKOUT_RATIO,
  MIN_FEED_FACTOR,
  MIN_RPM_FACTOR,
} from '../longTool';
import { EngineError } from '../validate';

describe('assessLongTool — stickout derating', () => {
  it('no derate at or below 3×D (standard stickout)', () => {
    for (const st of [0.5, 1.0, 1.5]) {
      const a = assessLongTool({ stickout_in: st, diameter_in: 0.5 });
      expect(a.derated).toBe(false);
      expect(a.feedFactor).toBe(1);
      expect(a.rpmFactor).toBe(1);
      expect(a.apFactor).toBe(1);
      expect(a.warnings).toHaveLength(0);
    }
  });

  it('4×D: documented example — over=4/3, feed=(3/4)^1.5≈0.6495, rpm=(3/4)^0.5≈0.866', () => {
    const a = assessLongTool({ stickout_in: 2.0, diameter_in: 0.5 });
    expect(a.stickoutRatio).toBeCloseTo(4, 9);
    expect(a.derated).toBe(true);
    expect(a.feedFactor).toBeCloseTo(Math.pow(3 / 4, 1.5), 6); // 0.6495
    expect(a.apFactor).toBeCloseTo(a.feedFactor, 12);
    expect(a.rpmFactor).toBeCloseTo(Math.sqrt(3 / 4), 6); // 0.8660
    expect(a.warnings.length).toBeGreaterThan(0);
  });

  it('monotonic: more stickout → lower (or equal, at floors) factors', () => {
    let prevFeed = 1.01;
    let prevRpm = 1.01;
    for (const ratio of [3, 3.5, 4, 5, 6, 8, 12, 20]) {
      const a = assessLongTool({ stickout_in: ratio * 0.5, diameter_in: 0.5 });
      expect(a.feedFactor).toBeLessThanOrEqual(prevFeed);
      expect(a.rpmFactor).toBeLessThanOrEqual(prevRpm);
      prevFeed = a.feedFactor;
      prevRpm = a.rpmFactor;
    }
  });

  it('floors: extreme stickout clamps to MIN_* and switches to a re-fixture warning', () => {
    const a = assessLongTool({ stickout_in: 10, diameter_in: 0.5 }); // 20×D
    expect(a.feedFactor).toBe(MIN_FEED_FACTOR);
    expect(a.rpmFactor).toBe(MIN_RPM_FACTOR);
    expect(a.warnings.join(' ')).toMatch(/shorten|choke|fixture/i);
  });

  it('reduced shank multiplies feed by (shank/D)², bounded, and warns', () => {
    const normal = assessLongTool({ stickout_in: 1.0, diameter_in: 0.5, shankDiameter_in: 0.5 });
    expect(normal.reducedShank).toBe(false);
    const reduced = assessLongTool({ stickout_in: 1.0, diameter_in: 0.5, shankDiameter_in: 0.375 });
    expect(reduced.reducedShank).toBe(true);
    expect(reduced.feedFactor).toBeCloseTo(Math.max(0.5, (0.375 / 0.5) ** 2), 6);
    expect(reduced.warnings.join(' ')).toMatch(/shank/i);
    expect(reduced.rpmFactor).toBe(1); // shank penalty is feed/DOC only
  });

  it('NORMAL_STICKOUT_RATIO is the documented 3×D and invalid input throws', () => {
    expect(NORMAL_STICKOUT_RATIO).toBe(3);
    expect(() => assessLongTool({ stickout_in: 0, diameter_in: 0.5 })).toThrow(EngineError);
    expect(() => assessLongTool({ stickout_in: 1, diameter_in: -1 })).toThrow(EngineError);
    expect(() =>
      assessLongTool({ stickout_in: 1, diameter_in: 0.5, shankDiameter_in: NaN }),
    ).toThrow(EngineError);
  });
});
