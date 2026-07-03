import { describe, it, expect } from 'vitest';
import {
  estimateToolLife,
  costPerPart,
  TAYLOR_DEFAULTS,
} from '../toolLife';
import { EngineError } from '../validate';

describe('Golden Vector L-A (carbide, 800 SFM vs 600 ref)', () => {
  const life = estimateToolLife({ sfm: 800, refSfm: 600, toolClass: 'carbide' });

  it('C = 1554.01', () => expect(life.cUsed).toBeCloseTo(1554.01, 1));
  it('life = 14.236 min', () => expect(life.lifeMin).toBeCloseTo(14.236, 2));
  it('life ratio = 14.236/45 = 0.3164', () =>
    expect(life.lifeRatio).toBeCloseTo(0.3164, 3));

  const cost = costPerPart({
    lifeMin: life.lifeMin,
    cutMinutesPerPart: 2.0,
    toolCost: 30,
    edgesPerTool: 3,
    machineRatePerHour: 60,
  });
  it('7 parts per edge, 21 per tool', () => {
    expect(cost.partsPerEdge).toBe(7);
    expect(cost.partsPerTool).toBe(21);
  });
  it('tool $/part = 1.4286', () =>
    expect(cost.toolCostPerPart).toBeCloseTo(1.4286, 3));
  it('machine $/part = 2.00', () =>
    expect(cost.machineCostPerPart).toBeCloseTo(2.0, 6));
  it('total $/part = 3.4286', () =>
    expect(cost.totalCostPerPart).toBeCloseTo(3.4286, 3));
});

describe('Taylor sanity anchors', () => {
  it('running at reference speed returns reference life for every class', () => {
    for (const cls of Object.keys(TAYLOR_DEFAULTS) as Array<keyof typeof TAYLOR_DEFAULTS>) {
      const r = estimateToolLife({ sfm: 500, refSfm: 500, toolClass: cls });
      expect(r.lifeMin).toBeCloseTo(TAYLOR_DEFAULTS[cls].refLifeMin, 6);
      expect(r.lifeRatio).toBeCloseTo(1, 6);
    }
  });

  it('monotonic: more speed → less life (property, 200 samples)', () => {
    let seed = 99;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
      return Math.abs(seed % 10_000) / 10_000;
    };
    for (let i = 0; i < 200; i++) {
      const refSfm = 100 + rnd() * 900;
      const v1 = refSfm * (0.5 + rnd());
      const v2 = v1 * (1.05 + rnd());
      const cls = (['hss', 'cobalt', 'carbide', 'ceramic'] as const)[
        Math.floor(rnd() * 4)
      ];
      const a = estimateToolLife({ sfm: v1, refSfm, toolClass: cls });
      const b = estimateToolLife({ sfm: v2, refSfm, toolClass: cls });
      expect(b.lifeMin).toBeLessThan(a.lifeMin);
      expect(Number.isFinite(a.lifeMin) && Number.isFinite(b.lifeMin)).toBe(true);
    }
  });

  it('HSS is punished harder than carbide for the same overspeed', () => {
    const hss = estimateToolLife({ sfm: 130, refSfm: 100, toolClass: 'hss' });
    const carbide = estimateToolLife({ sfm: 130, refSfm: 100, toolClass: 'carbide' });
    expect(hss.lifeRatio).toBeLessThan(carbide.lifeRatio);
  });

  it('explicit n/refLife overrides work without toolClass', () => {
    const r = estimateToolLife({ sfm: 200, refSfm: 200, n: 0.3, refLifeMin: 20 });
    expect(r.lifeMin).toBeCloseTo(20, 6);
    expect(r.nUsed).toBe(0.3);
  });
});

describe('costPerPart edge cases', () => {
  it('life shorter than one part → 0 parts, warning, tool price as floor', () => {
    const r = costPerPart({
      lifeMin: 1.5,
      cutMinutesPerPart: 2.0,
      toolCost: 25,
      machineRatePerHour: 90,
    });
    expect(r.partsPerEdge).toBe(0);
    expect(r.toolCostPerPart).toBe(25);
    expect(r.totalCostPerPart).toBeCloseTo(25 + 3.0, 6);
    expect(r.warnings.join(' ')).toMatch(/burn tools mid-part/i);
  });

  it('default edgesPerTool = 1', () => {
    const r = costPerPart({
      lifeMin: 10,
      cutMinutesPerPart: 2,
      toolCost: 10,
      machineRatePerHour: 60,
    });
    expect(r.partsPerTool).toBe(5);
    expect(r.toolCostPerPart).toBeCloseTo(2, 6);
  });
});

describe('validation', () => {
  it('missing class and overrides throws', () => {
    expect(() => estimateToolLife({ sfm: 100, refSfm: 100 })).toThrow(EngineError);
  });
  it('n >= 1 rejected', () => {
    expect(() =>
      estimateToolLife({ sfm: 100, refSfm: 100, n: 1, refLifeMin: 30 }),
    ).toThrow(EngineError);
  });
  it.each([
    ['sfm', { sfm: 0, refSfm: 100, toolClass: 'carbide' }],
    ['refSfm', { sfm: 100, refSfm: -1, toolClass: 'carbide' }],
  ])('rejects invalid %s', (_n, input) => {
    expect(() => estimateToolLife(input as never)).toThrow(EngineError);
  });
  it('fractional edgesPerTool rejected', () => {
    expect(() =>
      costPerPart({
        lifeMin: 10,
        cutMinutesPerPart: 1,
        toolCost: 10,
        edgesPerTool: 2.5,
        machineRatePerHour: 60,
      }),
    ).toThrow(EngineError);
  });
});
