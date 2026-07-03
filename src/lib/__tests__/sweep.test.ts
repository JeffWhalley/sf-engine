import { describe, it, expect } from 'vitest';
import { sweep, linspace, extractSeries } from '../sweep';
import { computeTurning, type TurningInput } from '../../engine/turning';
import { computeDrilling, type DrillingInput } from '../../engine/drilling';

describe('linspace', () => {
  it('inclusive endpoints, even spacing', () => {
    expect(linspace(0, 100, 5)).toEqual([0, 25, 50, 75, 100]);
  });
  it('exact final endpoint despite FP', () => {
    const xs = linspace(0.1, 0.3, 7);
    expect(xs[6]).toBe(0.3);
    expect(xs).toHaveLength(7);
  });
  it('rejects bad steps', () => {
    expect(() => linspace(0, 1, 1)).toThrow();
    expect(() => linspace(0, 1, 2.5)).toThrow();
  });
});

describe('sweep over the real turning engine (integration)', () => {
  const base: TurningInput = {
    sfm: 400,
    workpieceDiameter_in: 2,
    ipr: 0.01,
    doc_in: 0.1,
    noseRadius_in: 1 / 32,
    unitPower_hpMinIn3: 1.0,
  };

  it('feed sweep: MRR strictly increases with feed', () => {
    const s = sweep(
      base,
      linspace(0.002, 0.02, 19),
      (b, x) => ({ ...b, ipr: x }),
      computeTurning,
    );
    expect(s.errorCount).toBe(0);
    const ys = extractSeries(s, (r) => r.mrr_in3PerMin).map((p) => p.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  });

  it('spot-check: swept point matches a direct engine call', () => {
    const s = sweep(base, [0.008], (b, x) => ({ ...b, ipr: x }), computeTurning);
    const direct = computeTurning({ ...base, ipr: 0.008 });
    expect(s.points[0]!.result).toEqual(direct);
  });

  it('does not mutate the base input', () => {
    const frozen = Object.freeze({ ...base });
    sweep(frozen, linspace(0.002, 0.02, 5), (b, x) => ({ ...b, ipr: x }), computeTurning);
    expect(frozen.ipr).toBe(0.01);
  });
});

describe('validity-edge handling', () => {
  const base: DrillingInput = {
    sfm: 250,
    diameter_in: 0.5,
    ipr: 0.008,
    unitPower_hpMinIn3: 0.25,
  };

  it('points past a validity edge become gaps, not crashes', () => {
    // Sweep IPR from negative into valid territory: negatives throw EngineError.
    const s = sweep(
      base,
      [-0.004, -0.001, 0.002, 0.008],
      (b, x) => ({ ...b, ipr: x }),
      computeDrilling,
    );
    expect(s.errorCount).toBe(2);
    expect(s.points[0]!.error).toMatch(/ipr/);
    expect(s.points[2]!.result).toBeDefined();
    const pairs = extractSeries(s, (r) => r.feed_ipm);
    expect(pairs).toHaveLength(2); // errors skipped
  });

  it('non-Error throws propagate (programming bugs are not gaps)', () => {
    expect(() =>
      sweep({}, [1], (b) => b, () => {
        // eslint-disable-next-line no-throw-literal
        throw 'raw string';
      }),
    ).toThrow('raw string');
  });
});

describe('perf smoke (Phase 9 AC: sweeps stay frame-friendly)', () => {
  it('101-point turning sweep stays frame-friendly (best of 3 < 16ms)', () => {
    const base: TurningInput = {
      sfm: 400,
      workpieceDiameter_in: 2,
      ipr: 0.01,
      doc_in: 0.1,
      noseRadius_in: 1 / 32,
      unitPower_hpMinIn3: 1.0,
      maxRpm: 4000,
    };
    const xs = linspace(0.05 * 2, 1.0 * 2, 101);
    // Best-of-3: absolute wall-clock assertions are flaky on loaded CI
    // machines (observed once locally under concurrent zip). Best-of-N
    // measures the code's speed, not the machine's mood.
    let best = Infinity;
    let series = sweep(base, xs, (b, x) => ({ ...b, workpieceDiameter_in: x }), computeTurning);
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      series = sweep(base, xs, (b, x) => ({ ...b, workpieceDiameter_in: x }), computeTurning);
      best = Math.min(best, performance.now() - t0);
    }
    expect(series.errorCount).toBe(0);
    expect(best).toBeLessThan(16);
  });
});
