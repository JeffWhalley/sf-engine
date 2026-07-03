/**
 * Phase 7 T3 integration — derating flows through calculateWithLimits.
 * AC (PLAN §7.3): increasing stickout lowers feed and raises the warning.
 */
import { describe, it, expect } from 'vitest';
import { getMaterial, getTool, getMachine } from '../index';
import { calculateWithLimits } from '../limits';
import { buildWarnings } from '../../ui/warnings';

const material = getMaterial('al-6061')!;
const machine = getMachine('mill-vmc-20hp')!;
const base = getTool('em-flat-050-4fl-carbide')!; // 0.5" Ø, 1.5" stickout = 3×D

const sel = (stickout_in: number, shankDiameter_in = base.shankDiameter_in) => ({
  material,
  tool: { ...base, stickout_in, shankDiameter_in },
  ae_in: 0.2,
  ap_in: 0.5,
  performance: 50 as const,
});

describe('long-tool derating through calculateWithLimits', () => {
  it('increasing stickout lowers feed and deflection stays bounded', () => {
    const at3 = calculateWithLimits(sel(1.5), machine);
    const at5 = calculateWithLimits(sel(2.5), machine);
    const at8 = calculateWithLimits(sel(4.0), machine);
    expect(at3.longTool?.derated).toBe(false);
    expect(at5.longTool?.derated).toBe(true);
    expect(at5.result.feed_ipm).toBeLessThan(at3.result.feed_ipm);
    expect(at8.result.feed_ipm).toBeLessThan(at5.result.feed_ipm);
    expect(at5.result.rpm).toBeLessThan(at3.result.rpm);
  });

  it('derating caps axial DOC (ap enters MRR: less power drawn than undereated request)', () => {
    const at3 = calculateWithLimits(sel(1.5), machine);
    const at6 = calculateWithLimits(sel(3.0), machine);
    expect(at6.result.mrr_in3min).toBeLessThan(at3.result.mrr_in3min);
  });

  it('warning reaches the UI advisory list', () => {
    const limited = calculateWithLimits(sel(2.5), machine);
    const advisories = buildWarnings(limited, {
      machine,
      tool: { ...base, stickout_in: 2.5 },
      ap_in: 0.5,
      sys: 'imperial',
    });
    expect(advisories.some((a) => /long tool/i.test(a.message))).toBe(true);
  });

  it('reduced-shank tool derates further and warns', () => {
    const full = calculateWithLimits(sel(1.5), machine);
    const necked = calculateWithLimits(sel(1.5, 0.375), machine);
    expect(necked.longTool?.reducedShank).toBe(true);
    expect(necked.result.feed_ipm).toBeLessThan(full.result.feed_ipm);
    const advisories = buildWarnings(necked, {
      machine,
      tool: { ...base, shankDiameter_in: 0.375 },
      ap_in: 0.5,
      sys: 'imperial',
    });
    expect(advisories.some((a) => /shank/i.test(a.message))).toBe(true);
  });

  it('3×D baseline result is byte-identical to pre-derating behavior (no regression)', () => {
    const l = calculateWithLimits(sel(1.5), machine);
    expect(l.longTool?.feedFactor).toBe(1);
    expect(l.longTool?.rpmFactor).toBe(1);
  });
});
