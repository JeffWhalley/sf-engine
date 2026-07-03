/**
 * Phase 7b AC — every preset passes the Phase-5 limit checker against the
 * integration sweep without impossible states; search works.
 */
import { describe, it, expect } from 'vitest';
import { MACHINE_PRESETS, searchMachinePresets } from '../machinePresets';
import { MATERIALS } from '../materials';
import { getTool } from '../tools';
import { calculateWithLimits, availablePower } from '../limits';
import { resolveDrillingInput, resolveTurningInput } from '../resolve';
import { computeDrilling, computeTurning } from '../../engine';

const tool = getTool('em-flat-050-4fl-carbide')!;

describe('preset schema sanity', () => {
  it('15–20 presets, unique ids, physically coherent fields', () => {
    expect(MACHINE_PRESETS.length).toBeGreaterThanOrEqual(15);
    expect(MACHINE_PRESETS.length).toBeLessThanOrEqual(20);
    const ids = new Set(MACHINE_PRESETS.map((m) => m.id));
    expect(ids.size).toBe(MACHINE_PRESETS.length);
    for (const m of MACHINE_PRESETS) {
      expect(m.id).toMatch(/^preset-/);
      expect(m.minRpm).toBeGreaterThan(0);
      expect(m.maxRpm).toBeGreaterThan(m.minRpm);
      expect(m.maxPower_hp).toBeGreaterThan(0);
      expect(m.efficiency).toBeGreaterThan(0);
      expect(m.efficiency).toBeLessThanOrEqual(1);
      expect(m.maxFeed_ipm).toBeGreaterThan(0);
      if (m.baseRpm) expect(m.baseRpm).toBeLessThanOrEqual(m.maxRpm);
      if (m.discreteRpms) {
        expect(m.discreteRpms[0]).toBeGreaterThanOrEqual(m.minRpm);
        expect(m.discreteRpms[m.discreteRpms.length - 1]).toBeLessThanOrEqual(m.maxRpm);
      }
    }
  });
});

describe('AC: presets × integration sweep through the limit checker', () => {
  it('milling: every preset × every material clamps to finite, in-range output', () => {
    for (const machine of MACHINE_PRESETS) {
      for (const material of MATERIALS) {
        const limited = calculateWithLimits(
          { material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50 },
          machine,
        );
        const r = limited.result;
        for (const [k, v] of Object.entries(r)) {
          if (typeof v === 'number') {
            expect(Number.isFinite(v), `${machine.id} × ${material.id} → ${k}`).toBe(true);
          }
        }
        expect(r.rpm).toBeGreaterThanOrEqual(machine.minRpm - 1e-9);
        expect(r.rpm).toBeLessThanOrEqual(machine.maxRpm + 1e-9);
        expect(r.feed_ipm).toBeLessThanOrEqual(machine.maxFeed_ipm + 1e-9);
        expect(availablePower(machine, r.rpm)).toBeGreaterThan(0);
      }
    }
  });

  it('drilling + turning: every preset × every material stays finite', () => {
    for (const machine of MACHINE_PRESETS) {
      for (const material of MATERIALS) {
        const dr = computeDrilling(
          resolveDrillingInput({ material, drillDiameter_in: 0.25, machine }),
        );
        expect(Number.isFinite(dr.rpm) && Number.isFinite(dr.feed_ipm)).toBe(true);
        expect(dr.rpm).toBeLessThanOrEqual(machine.maxRpm + 1e-9);
        const tr = computeTurning(
          resolveTurningInput({ material, workpieceDiameter_in: 2, machine }),
        );
        expect(Number.isFinite(tr.rpm) && Number.isFinite(tr.feed_ipm)).toBe(true);
        expect(tr.rpm).toBeLessThanOrEqual(machine.maxRpm + 1e-9);
      }
    }
  });
});

describe('preset search', () => {
  it('matches by name and taper, case-insensitive; empty query returns all', () => {
    expect(searchMachinePresets('').length).toBe(MACHINE_PRESETS.length);
    expect(searchMachinePresets('tormach').length).toBe(3);
    expect(searchMachinePresets('HAAS').length).toBe(3);
    expect(searchMachinePresets('bt30').length).toBeGreaterThanOrEqual(2);
    expect(searchMachinePresets('zzz-none')).toHaveLength(0);
  });
});
