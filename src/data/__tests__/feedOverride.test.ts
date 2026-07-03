/**
 * Manual feed lock — feed becomes an ENTERED property; DOC/WOC are the
 * dependent variables (Max DOC/WOC solve engagement at the locked feed).
 */
import { describe, it, expect } from 'vitest';
import {
  getMaterial, getTool, getMachine, calculateWithLimits, fitEngagement, availablePower,
  sfmRangeFor,
} from '../index';
import { buildWarnings } from '../../ui/warnings';
import { useCalcStore } from '../../store/useCalcStore';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const hobby = getMachine('mill-hobby-1hp')!;
const vmc = getMachine('mill-vmc-20hp')!;

describe('calculateWithLimits with a manual feed lock', () => {
  it('holds the entered feed exactly and derives chip load from it', () => {
    const l = calculateWithLimits(
      { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50, feedOverride_ipm: 40 },
      vmc,
    );
    expect(l.feedLocked).toBe(true);
    expect(l.result.feed_ipm).toBeCloseTo(40, 9);
    expect(l.result.chipload_in).toBeCloseTo(40 / (l.result.rpm * tool.flutes), 9);
  });

  it('does NOT auto-reduce a locked feed for power — it warns instead', () => {
    const l = calculateWithLimits(
      { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50, feedOverride_ipm: 90 },
      hobby,
    );
    expect(l.clampedPower).toBe(false);
    expect(l.result.feed_ipm).toBeCloseTo(90, 6);
    expect(l.result.motorPower_hp).toBeGreaterThan(l.availablePower_hp);
    const w = buildWarnings(l, { machine: hobby, tool, ap_in: 0.5, sys: 'imperial' });
    expect(w.some((a) => a.severity === 'danger' && /available/i.test(a.message))).toBe(true);
  });

  it('machine max table feed still physically caps a locked feed', () => {
    const l = calculateWithLimits(
      { material, tool, ae_in: 0.2, ap_in: 0.5, feedOverride_ipm: 500 },
      hobby, // maxFeed 100 ipm
    );
    expect(l.clampedFeed).toBe(true);
    expect(l.result.feed_ipm).toBeLessThanOrEqual(hobby.maxFeed_ipm + 1e-9);
  });

  it('rigidity derating does not double-punish a manual feed', () => {
    const light = calculateWithLimits(
      { material, tool, ae_in: 0.2, ap_in: 0.5, feedOverride_ipm: 30 },
      { ...vmc, rigidity: 'light' },
    );
    expect(light.result.feed_ipm).toBeCloseTo(30, 9);
  });
});

describe('DOC/WOC as the dependent variables', () => {
  it('Max DOC at a locked fast feed shrinks ap until demanded power fits', () => {
    const sel = { material, tool, ae_in: 0.2, ap_in: 1.0, performance: 50, feedOverride_ipm: 60 };
    const { ap_in } = fitEngagement(sel, hobby, 'woc');
    const fitted = calculateWithLimits({ ...sel, ap_in }, hobby);
    expect(ap_in).toBeLessThan(1.0);
    expect(fitted.demandedPower_hp).toBeLessThanOrEqual(
      availablePower(hobby, fitted.result.rpm) + 0.02,
    );
    expect(fitted.result.feed_ipm).toBeCloseTo(60, 6); // feed stayed locked
  });

  it('regression: without a lock, fitEngagement still bisects on DEMANDED power', () => {
    const sel = { material, tool, ae_in: 0.2, ap_in: 1.0, performance: 50 };
    const { ap_in } = fitEngagement(sel, hobby, 'woc');
    // must not blindly return the geometric max now that power-fit caps results
    const atMax = calculateWithLimits(sel, hobby);
    expect(atMax.demandedPower_hp).toBeGreaterThan(atMax.availablePower_hp); // over-demand at full ap
    expect(ap_in).toBeLessThan(1.0);
  });
});

describe('store plumbing', () => {
  it('setFeedOverride + snapshot round-trip; junk clears the lock', () => {
    const s = useCalcStore.getState();
    s.setFeedOverride(42);
    expect(useCalcStore.getState().feedOverride_ipm).toBe(42);
    const snap = useCalcStore.getState().snapshot();
    useCalcStore.getState().setFeedOverride(null);
    useCalcStore.getState().loadSnapshot(snap);
    expect(useCalcStore.getState().feedOverride_ipm).toBe(42);
    useCalcStore.getState().setFeedOverride(0); // invalid → null
    expect(useCalcStore.getState().feedOverride_ipm).toBeNull();
  });
});

describe('holdChipload — RPM solved from the locked feed', () => {
  const sel = { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50 };

  it('raises RPM so the derived chip load lands on target (fast feed)', () => {
    const auto = calculateWithLimits(sel, vmc);
    // stay inside the SFM window's RPM headroom so the solve can fully land
    const window = sfmRangeFor(material, tool.material);
    const headroom = window.max / auto.result.sfm;
    const factor = 1 + (headroom - 1) * 0.75;
    const locked = calculateWithLimits(
      { ...sel, feedOverride_ipm: auto.result.feed_ipm * factor, holdChipload: true },
      vmc,
    );
    expect(locked.rpmSolvedForChipload).toBe(true);
    expect(locked.result.rpm).toBeGreaterThan(auto.result.rpm);
    // chip load back on the same target (both cuts share ae → same thinning)
    expect(locked.result.chipload_in).toBeCloseTo(auto.result.chipload_in, 4);
  });

  it('beyond the window headroom, RPM caps at the thermal limit and chip thickens', () => {
    const auto = calculateWithLimits(sel, vmc);
    const locked = calculateWithLimits(
      { ...sel, feedOverride_ipm: auto.result.feed_ipm * 3, holdChipload: true },
      { ...vmc, maxFeed_ipm: 5000 },
    );
    const window = sfmRangeFor(material, tool.material);
    expect(locked.result.sfm).toBeLessThanOrEqual(window.max + 1);
    expect(locked.result.chipload_in).toBeGreaterThan(auto.result.chipload_in);
  });

  it('caps the solved RPM at the material SFM window (thermal limit)', () => {
    const insane = calculateWithLimits(
      { ...sel, feedOverride_ipm: 5000, holdChipload: true },
      { ...vmc, maxRpm: 100000, maxFeed_ipm: 10000 },
    );
    // achieved sfm must not exceed the window max
    expect(insane.result.sfm).toBeLessThanOrEqual(
      sfmRangeFor(material, tool.material).max + 1,
    );
  });

  it('machine max RPM still wins over the solve', () => {
    const l = calculateWithLimits(
      { ...sel, feedOverride_ipm: 200, holdChipload: true },
      hobby, // 10k rpm ceiling
    );
    expect(l.result.rpm).toBeLessThanOrEqual(hobby.maxRpm + 1e-9);
    expect(l.result.feed_ipm).toBeCloseTo(Math.min(200, hobby.maxFeed_ipm), 6);
  });

  it('slow locked feed lowers RPM but not below the SFM window floor', () => {
    const auto = calculateWithLimits(sel, vmc);
    const slow = calculateWithLimits(
      { ...sel, feedOverride_ipm: auto.result.feed_ipm * 0.3, holdChipload: true },
      vmc,
    );
    expect(slow.result.rpm).toBeLessThan(auto.result.rpm);
    expect(slow.result.sfm).toBeGreaterThanOrEqual(sfmRangeFor(material, tool.material).min - 1);
  });
});
