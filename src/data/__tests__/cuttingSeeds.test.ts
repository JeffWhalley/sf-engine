import { describe, it, expect } from 'vitest';
import {
  DRILLING_SEEDS,
  TURNING_SEEDS,
  pickFromWindow,
  interpolateIpr,
  type IsoGroup,
} from '../cuttingSeeds';
import { computeDrilling } from '../../engine/drilling';
import { SEED_HSS_DRILL_IPR } from '../cuttingSeeds';
import { computeTurning } from '../../engine/turning';

const GROUPS = Object.keys(DRILLING_SEEDS) as IsoGroup[];
const PERFS = [0, 50, 100];
const DIAMETERS = [0.0625, 0.125, 0.25, 0.5, 1.0];

/** Rough unit-power stand-ins per group for the sweep (hp·min/in³). */
const UNIT_POWER: Record<IsoGroup, number> = {
  P: 1.0, M: 1.2, K: 0.7, N: 0.25, S: 1.8, H: 1.6,
};

describe('window sanity', () => {
  it('every window has 0 < min < max', () => {
    for (const g of GROUPS) {
      const d = DRILLING_SEEDS[g];
      const t = TURNING_SEEDS[g];
      for (const w of [d.sfmHss, d.sfmCarbide, t.sfmCarbide, t.iprRough,
        t.iprFinish, t.docRough, t.docFinish]) {
        expect(w.min).toBeGreaterThan(0);
        expect(w.max).toBeGreaterThan(w.min);
      }
      expect(d.iprMultiplier).toBeGreaterThan(0);
    }
  });

  it('finishing windows sit lower than roughing windows (per group)', () => {
    for (const g of GROUPS) {
      const t = TURNING_SEEDS[g];
      // Slight overlap is realistic; the invariant is "finishing is lighter".
      expect(t.iprFinish.min).toBeLessThan(t.iprRough.min);
      expect(t.iprFinish.max).toBeLessThan(t.iprRough.max);
      expect(t.docFinish.min).toBeLessThan(t.docRough.min);
      expect(t.docFinish.max).toBeLessThan(t.docRough.max);
    }
  });

  it('relative ordering encodes machinability (N fastest, S/H slowest)', () => {
    expect(DRILLING_SEEDS.N.sfmHss.min).toBeGreaterThan(DRILLING_SEEDS.P.sfmHss.max);
    expect(DRILLING_SEEDS.S.sfmHss.max).toBeLessThan(DRILLING_SEEDS.P.sfmHss.min);
    expect(TURNING_SEEDS.N.sfmCarbide.min).toBeGreaterThan(TURNING_SEEDS.P.sfmCarbide.max);
  });
});

describe('helpers', () => {
  it('pickFromWindow interpolates and clamps', () => {
    const w = { min: 100, max: 300 };
    expect(pickFromWindow(w, 0)).toBe(100);
    expect(pickFromWindow(w, 50)).toBe(200);
    expect(pickFromWindow(w, 100)).toBe(300);
    expect(pickFromWindow(w, -20)).toBe(100);
    expect(pickFromWindow(w, 140)).toBe(300);
  });

  it('interpolateIpr matches table nodes and clamps ends', () => {
    expect(interpolateIpr(SEED_HSS_DRILL_IPR, 0.5)).toBeCloseTo(0.008, 6);
    expect(interpolateIpr(SEED_HSS_DRILL_IPR, 0.01)).toBeCloseTo(0.001, 6); // below first
    expect(interpolateIpr(SEED_HSS_DRILL_IPR, 3)).toBeCloseTo(0.015, 6); // above last
    // midpoint of 0.25 (0.004) and 0.375 (0.006)
    expect(interpolateIpr(SEED_HSS_DRILL_IPR, 0.3125)).toBeCloseTo(0.005, 6);
  });
});

describe('integration sweep: every group × perf × diameter through the engines', () => {
  it(`drilling: ${GROUPS.length} groups × 3 perf × ${DIAMETERS.length} Ø, HSS + carbide → finite, warned, sane`, () => {
    for (const g of GROUPS) {
      const seed = DRILLING_SEEDS[g];
      for (const perf of PERFS) {
        for (const d of DIAMETERS) {
          for (const sfmWindow of [seed.sfmHss, seed.sfmCarbide]) {
            const r = computeDrilling({
              sfm: pickFromWindow(sfmWindow, perf),
              diameter_in: d,
              ipr: interpolateIpr(SEED_HSS_DRILL_IPR, d) * seed.iprMultiplier,
              holeDepth_in: d * 4,
              unitPower_hpMinIn3: UNIT_POWER[g],
              kc_nPerMm2: 1500,
              maxRpm: 10000,
            });
            for (const v of Object.values(r)) {
              if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
            }
            expect(r.rpm).toBeGreaterThan(0);
            expect(r.rpm).toBeLessThanOrEqual(10000);
          }
        }
      }
    }
  });

  it('turning: every group × perf, rough + finish → finite and sane', () => {
    for (const g of GROUPS) {
      const seed = TURNING_SEEDS[g];
      for (const perf of PERFS) {
        for (const op of ['rough', 'finish'] as const) {
          const r = computeTurning({
            sfm: pickFromWindow(seed.sfmCarbide, perf),
            workpieceDiameter_in: 1.5,
            ipr: pickFromWindow(op === 'rough' ? seed.iprRough : seed.iprFinish, perf),
            doc_in: pickFromWindow(op === 'rough' ? seed.docRough : seed.docFinish, perf),
            noseRadius_in: 1 / 32,
            unitPower_hpMinIn3: UNIT_POWER[g],
            maxRpm: 4000,
          });
          for (const v of Object.values(r)) {
            if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
          }
          expect(r.powerAtCutter_hp).toBeGreaterThan(0);
          expect(r.powerAtCutter_hp).toBeLessThan(60); // nothing absurd from seeds
        }
      }
    }
  });
});
