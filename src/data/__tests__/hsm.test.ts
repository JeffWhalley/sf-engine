/**
 * Phase 8 T4 — HSM mode. AC (PLAN §8.2): HSM preset produces higher MRR than
 * the profile baseline at comparable (machine-limited) power.
 */
import { describe, it, expect } from 'vitest';
import { getMaterial, getTool, getMachine, suggestEngagement, calculateWithLimits,
  resolveMillingInput, HSM_SFM_BOOST } from '../index';
import { useCalcStore } from '../../store/useCalcStore';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const machine = getMachine('mill-vmc-20hp')!;

describe('HSM_SFM_BOOST in the resolver', () => {
  it('hsm: true multiplies resolved SFM by exactly HSM_SFM_BOOST', () => {
    const base = { material, tool, ae_in: 0.05, ap_in: 1.0, performance: 50 };
    const off = resolveMillingInput({ ...base, hsm: false });
    const on = resolveMillingInput({ ...base, hsm: true });
    expect(on.sfm).toBeCloseTo(off.sfm * HSM_SFM_BOOST, 9);
    expect(on.chipload_in).toBeCloseTo(off.chipload_in, 12); // chipload untouched
  });
});

describe('AC: HSM beats profile MRR under the same machine limits', () => {
  it('hsm engagement + boost → higher clamped MRR than profile', () => {
    const hsmEng = suggestEngagement(tool.diameter_in, 'hsm', tool.fluteLength_in);
    const profEng = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);
    const hsm = calculateWithLimits(
      { material, tool, ...{ ae_in: hsmEng.ae_in, ap_in: hsmEng.ap_in }, performance: 50, hsm: true },
      machine,
    ).result;
    const profile = calculateWithLimits(
      { material, tool, ae_in: profEng.ae_in, ap_in: profEng.ap_in, performance: 50 },
      machine,
    ).result;
    expect(hsm.mrr_in3min).toBeGreaterThan(profile.mrr_in3min);
    expect(hsm.motorPower_hp).toBeLessThanOrEqual(machine.maxPower_hp);
  });
});

describe('store strategy tracking', () => {
  it('applyStrategy sets it; manual ae/ap edit clears it; snapshot round-trips', () => {
    const s = useCalcStore.getState();
    s.setOperation('milling');
    s.setTool('em-flat-050-4fl-carbide');
    s.applyStrategy('hsm');
    expect(useCalcStore.getState().strategy).toBe('hsm');
    const snap = useCalcStore.getState().snapshot();
    expect(snap.strategy).toBe('hsm');
    useCalcStore.getState().setAe(0.123);
    expect(useCalcStore.getState().strategy).toBeNull();
    useCalcStore.getState().loadSnapshot(snap);
    expect(useCalcStore.getState().strategy).toBe('hsm');
    useCalcStore.getState().applyStrategy('profile'); // reset for other tests
  });
});
