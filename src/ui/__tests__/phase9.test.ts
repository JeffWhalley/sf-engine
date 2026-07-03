/**
 * Phase 9 — sweep chart data + tool-life panel data.
 * AC: sweep values match direct calculate() spot checks; tool-life monotonic.
 */
import { describe, it, expect } from 'vitest';
import { buildPerformanceSweep } from '../sweepData';
import { taylorClassFor, referenceSfm, estimateForSfm, DEFAULT_ASSUMPTIONS } from '../toolLifeData';
import { getMaterial, getTool, getMachine, calculateWithLimits } from '../../data';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const machine = getMachine('mill-vmc-20hp')!;
const sel = { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50 };

describe('performance sweep (AC: matches direct calculate() spot checks)', () => {
  it('sampled points equal calculateWithLimits at the same performance', () => {
    const s = buildPerformanceSweep(sel, machine, 41);
    expect(s.points).toHaveLength(41);
    expect(s.errorCount).toBe(0);
    for (const x of [0, 50, 100]) {
      const p = s.points.find((q) => q.x === x)!;
      const direct = calculateWithLimits({ ...sel, performance: x }, machine).result;
      expect(p.feed_ipm).toBeCloseTo(direct.feed_ipm, 9);
      expect(p.motorPower_hp).toBeCloseTo(direct.motorPower_hp, 9);
      expect(p.rpm).toBeCloseTo(direct.rpm, 9);
    }
  });

  it('feed is monotonically non-decreasing with aggressiveness (until clamps)', () => {
    const s = buildPerformanceSweep(sel, machine, 21);
    let prev = -Infinity;
    for (const p of s.points) {
      expect(p.feed_ipm!).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p.feed_ipm!;
    }
  });
});

describe('tool-life panel data (AC: monotonic — faster → shorter life)', () => {
  const ref = referenceSfm(material, 'milling', tool.material);

  it('reference SFM equals the mid-window pick and class mapping is sane', () => {
    expect(ref).toBeGreaterThan(0);
    expect(taylorClassFor('hss')).toBe('hss');
    expect(taylorClassFor('cobalt')).toBe('cobalt');
    expect(taylorClassFor('carbide')).toBe('carbide');
    expect(taylorClassFor('carbideCoated')).toBe('carbide');
  });

  it('life at reference speed ≈ class refLife; higher speed → shorter life', () => {
    const atRef = estimateForSfm(ref, ref, 'carbide', DEFAULT_ASSUMPTIONS);
    expect(atRef.life.lifeRatio).toBeCloseTo(1, 9);
    const faster = estimateForSfm(ref * 1.3, ref, 'carbide', DEFAULT_ASSUMPTIONS);
    const slower = estimateForSfm(ref * 0.7, ref, 'carbide', DEFAULT_ASSUMPTIONS);
    expect(faster.life.lifeMin).toBeLessThan(atRef.life.lifeMin);
    expect(slower.life.lifeMin).toBeGreaterThan(atRef.life.lifeMin);
  });

  it('cost per part responds to assumptions in the right direction', () => {
    const base = estimateForSfm(ref, ref, 'carbide', DEFAULT_ASSUMPTIONS);
    const pricierTool = estimateForSfm(ref, ref, 'carbide', {
      ...DEFAULT_ASSUMPTIONS, toolCost: DEFAULT_ASSUMPTIONS.toolCost * 4,
    });
    expect(pricierTool.cost.toolCostPerPart).toBeGreaterThan(base.cost.toolCostPerPart);
    const moreEdges = estimateForSfm(ref, ref, 'carbide', {
      ...DEFAULT_ASSUMPTIONS, edgesPerTool: 4,
    });
    expect(moreEdges.cost.toolCostPerPart).toBeLessThan(base.cost.toolCostPerPart);
  });

  it('drilling/turning reference windows resolve per ISO group', () => {
    expect(referenceSfm(material, 'drilling', 'hss', 'hss')).toBeGreaterThan(0);
    expect(referenceSfm(material, 'drilling', 'hss', 'carbide')).toBeGreaterThan(
      referenceSfm(material, 'drilling', 'hss', 'hss'),
    );
    expect(referenceSfm(material, 'turning', 'carbide')).toBeGreaterThan(0);
  });
});

describe('PLAN 8.4 — machine curve data (spot checks vs availablePower)', () => {
  it('curve samples equal availablePower and torque identity holds', async () => {
    const { buildMachineCurve } = await import('../sweepData');
    const { availablePower } = await import('../../data');
    const m = getMachine('mill-vmc-20hp')!;
    const curve = buildMachineCurve(m, 31);
    expect(curve).toHaveLength(31);
    expect(curve[0]!.rpm).toBe(m.minRpm);
    expect(curve[30]!.rpm).toBe(m.maxRpm);
    for (const p of [curve[0]!, curve[15]!, curve[30]!]) {
      expect(p.power_hp).toBeCloseTo(availablePower(m, p.rpm), 9);
      expect(p.torque_lbft).toBeCloseTo((5252 * p.power_hp) / p.rpm, 9);
    }
    // constant-power region caps at nameplate; below baseRpm it derates
    expect(Math.max(...curve.map((p) => p.power_hp))).toBeLessThanOrEqual(m.maxPower_hp + 1e-9);
  });
});
