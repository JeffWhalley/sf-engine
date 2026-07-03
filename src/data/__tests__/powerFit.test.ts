/**
 * Feasibility fix — recommendations must fit the actual machine:
 * feed auto-scales to available spindle power, and light machines derate
 * chip load for rigidity (chatter), not just power.
 */
import { describe, it, expect } from 'vitest';
import {
  getMaterial, getTool, getMachine, calculateWithLimits, availablePower,
  RIGIDITY_FEED_FACTOR, POWER_FIT_TARGET,
} from '../index';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const sel = { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50 };

describe('power fit', () => {
  it('a heavy cut on the 1 HP machine is reduced to fit available power', () => {
    const machine = getMachine('mill-hobby-1hp')!;
    const l = calculateWithLimits(sel, machine);
    const avail = availablePower(machine, l.result.rpm);
    expect(l.clampedPower).toBe(true);
    expect(l.result.motorPower_hp).toBeLessThanOrEqual(avail + 1e-9);
    expect(l.result.motorPower_hp).toBeCloseTo(avail * POWER_FIT_TARGET, 1);
    // the "wanted" numbers are preserved for the readout
    expect(l.unclamped.feed_ipm).toBeGreaterThan(l.result.feed_ipm);
  });

  it('the same cut on the 20 HP VMC is untouched', () => {
    const machine = getMachine('mill-vmc-20hp')!;
    const l = calculateWithLimits(sel, machine);
    expect(l.clampedPower).toBe(false);
  });

  it('every seed machine × material now yields a power-feasible recommendation', () => {
    for (const mid of ['mill-hobby-1hp', 'router-3hp', 'mill-vmc-20hp', 'mill-manual-gearbox']) {
      const machine = getMachine(mid)!;
      const l = calculateWithLimits(sel, machine);
      expect(
        l.result.motorPower_hp,
        `${mid}: ${l.result.motorPower_hp} hp vs ${l.availablePower_hp} avail`,
      ).toBeLessThanOrEqual(availablePower(machine, l.result.rpm) + 1e-9);
    }
  });
});

describe('rigidity chip-load derating', () => {
  it('light machine gets 0.6× the chip load of a rigid one at equal settings', () => {
    const rigid = calculateWithLimits(sel, getMachine('mill-vmc-20hp')!);
    // compare pre-power-clamp requests (unclamped) to isolate the rigidity factor;
    // hold rpm influence aside by comparing chip load, not feed
    const light = calculateWithLimits(sel, { ...getMachine('mill-vmc-20hp')!, rigidity: 'light' as const });
    expect(light.unclamped.chipload_in / rigid.unclamped.chipload_in)
      .toBeCloseTo(RIGIDITY_FEED_FACTOR.light, 6);
  });

  it('factors are sane and ordered', () => {
    expect(RIGIDITY_FEED_FACTOR.light).toBeLessThan(RIGIDITY_FEED_FACTOR.medium);
    expect(RIGIDITY_FEED_FACTOR.medium).toBeLessThan(RIGIDITY_FEED_FACTOR.rigid);
    expect(RIGIDITY_FEED_FACTOR.rigid).toBe(1);
  });
});
