import { describe, it, expect } from 'vitest';
import {
  calculateWithLimits, availablePower, capPerformance, fitEngagement,
  getMaterial, getTool, getMachine, type MillingSelection,
} from '../../data';

const AL = getMaterial('al-6061')!;
const STEEL = getTool('em-flat-050-4fl-carbide')!;
const HOBBY = getMachine('mill-hobby-1hp')!; // 1 HP, maxRpm 10000
const VMC = getMachine('mill-vmc-20hp')!;
const ROUTER = getMachine('router-3hp')!; // minRpm 6000, maxRpm 24000
const GEARBOX = getMachine('mill-manual-gearbox')!; // discrete speeds

describe('Phase 5.1 — RPM clamping', () => {
  it('caps over-speed to the machine maximum and reduces surface speed', () => {
    // tiny tool in aluminum wants a very high rpm; hobby max is 10000
    const smallTool = { ...STEEL, diameter_in: 0.03125, flutes: 2 };
    const sel: MillingSelection = { material: AL, tool: smallTool, ae_in: 0.005, ap_in: 0.03, performance: 80 };
    const lim = calculateWithLimits(sel, HOBBY);
    expect(lim.unclamped.rpm).toBeGreaterThan(HOBBY.maxRpm);
    expect(lim.clampedRpm).toBe(true);
    expect(Math.round(lim.result.rpm)).toBe(HOBBY.maxRpm);
    expect(lim.result.sfm).toBeLessThan(lim.unclamped.sfm);
  });

  it('raises below-minimum speed to the machine minimum (router)', () => {
    // big tool wants low rpm; router min is 6000
    const bigTool = { ...STEEL, diameter_in: 1.0 };
    const sel: MillingSelection = { material: AL, tool: bigTool, ae_in: 0.1, ap_in: 0.2, performance: 20 };
    const lim = calculateWithLimits(sel, ROUTER);
    expect(lim.clampedRpm).toBe(true);
    expect(Math.round(lim.result.rpm)).toBe(ROUTER.minRpm);
  });

  it('snaps to a discrete gearbox speed', () => {
    const sel: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.1, ap_in: 0.2, performance: 50 };
    const lim = calculateWithLimits(sel, GEARBOX);
    expect(lim.clampedRpm).toBe(true);
    expect(GEARBOX.discreteRpms).toContain(Math.round(lim.result.rpm));
  });
});

describe('Phase 5.1 — feed clamping', () => {
  it('caps feed to the machine maximum and lowers chip load', () => {
    const sel: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.05, ap_in: 0.2, performance: 100 };
    const lim = calculateWithLimits(sel, GEARBOX); // 30 ipm max feed
    expect(lim.result.feed_ipm).toBeLessThanOrEqual(GEARBOX.maxFeed_ipm + 1e-6);
    if (lim.clampedFeed) {
      expect(lim.result.chipload_in).toBeLessThan(lim.unclamped.chipload_in);
    }
  });
});

describe('Phase 5.2 — available power curve & warning', () => {
  it('power falls off below base rpm', () => {
    expect(availablePower(VMC, VMC.baseRpm!)).toBeCloseTo(VMC.maxPower_hp, 6);
    expect(availablePower(VMC, VMC.baseRpm! / 2)).toBeCloseTo(VMC.maxPower_hp / 2, 6);
    expect(availablePower(VMC, VMC.maxRpm)).toBeCloseTo(VMC.maxPower_hp, 6);
  });

  it('a heavy cut on the 1 HP machine exceeds available power', () => {
    const sel: MillingSelection = { material: getMaterial('steel-4140-annealed')!, tool: STEEL, ae_in: 0.5, ap_in: 0.9, performance: 90 };
    const lim = calculateWithLimits(sel, HOBBY);
    expect(lim.result.motorPower_hp).toBeGreaterThan(lim.availablePower_hp);
  });
});

describe('Phase 5.2/5.3 — rigidity caps performance', () => {
  it('light machines cap the performance position', () => {
    expect(capPerformance(100, 'light')).toBe(70);
    expect(capPerformance(50, 'light')).toBe(50);
    expect(capPerformance(100, 'medium')).toBe(90);
    expect(capPerformance(100, 'rigid')).toBe(100);
  });

  it('calculateWithLimits reports when performance was capped', () => {
    const sel: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.05, ap_in: 0.3, performance: 100 };
    const lim = calculateWithLimits(sel, HOBBY); // light
    expect(lim.performanceCappedTo).toBe(70);
  });

  it('aggressive raises feed vs conservative (on a machine with headroom)', () => {
    const base: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.05, ap_in: 0.3 };
    const cons = calculateWithLimits({ ...base, performance: 10 }, VMC);
    const aggr = calculateWithLimits({ ...base, performance: 90 }, VMC);
    expect(aggr.result.feed_ipm).toBeGreaterThan(cons.result.feed_ipm);
  });
});

describe('Phase 5.4 — DOC/WOC balancing to available power', () => {
  it('Max DOC drives spindle load to ~available power (or the flute-length bound)', () => {
    const sel: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.05, ap_in: 0.1, performance: 50 };
    const { ap_in } = fitEngagement(sel, HOBBY, 'woc');
    const lim = calculateWithLimits({ ...sel, ap_in }, HOBBY);
    const atBound = Math.abs(ap_in - STEEL.fluteLength_in) < 1e-3;
    const nearPower =
      Math.abs(lim.result.motorPower_hp - lim.availablePower_hp) / lim.availablePower_hp < 0.05;
    expect(atBound || nearPower).toBe(true);
    expect(ap_in).toBeGreaterThan(sel.ap_in); // it opened the cut up
  });

  it('Max WOC holds depth and changes width', () => {
    const sel: MillingSelection = { material: AL, tool: STEEL, ae_in: 0.02, ap_in: 0.25, performance: 50 };
    const { ae_in, ap_in } = fitEngagement(sel, HOBBY, 'doc');
    expect(ap_in).toBe(sel.ap_in); // depth held
    expect(ae_in).not.toBe(sel.ae_in); // width solved
  });
});
