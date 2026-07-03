import { describe, it, expect } from 'vitest';
import { TOOLS, getTool } from '../tools';
import { MACHINES, getMachine } from '../machines';

describe('tools seed data', () => {
  it('has at least 6 tools with unique ids', () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
  });

  it.each(TOOLS.map((t) => [t.name, t] as const))('%s passes schema', (_name, t) => {
    expect(t.diameter_in).toBeGreaterThan(0);
    expect(Number.isInteger(t.flutes)).toBe(true);
    expect(t.flutes).toBeGreaterThanOrEqual(1);
    expect(t.fluteLength_in).toBeGreaterThan(0);
    expect(t.fluteLength_in).toBeLessThanOrEqual(t.overallLength_in);
    expect(t.shankDiameter_in).toBeGreaterThan(0);
    expect(t.stickout_in).toBeGreaterThan(0);
    if (t.type === 'bullEndmill') {
      expect(t.cornerRadius_in).toBeDefined();
      expect(t.cornerRadius_in!).toBeGreaterThan(0);
    }
  });

  it('lookup works', () => {
    expect(getTool('em-flat-050-4fl-carbide')?.diameter_in).toBe(0.5);
    expect(getTool('nope')).toBeUndefined();
  });
});

describe('machines seed data', () => {
  it('has at least 3 machines with unique ids', () => {
    expect(MACHINES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(MACHINES.map((m) => m.id)).size).toBe(MACHINES.length);
  });

  it('includes a low-power (~1 HP) and a high-power (>=15 HP) machine', () => {
    expect(MACHINES.some((m) => m.maxPower_hp <= 2)).toBe(true);
    expect(MACHINES.some((m) => m.maxPower_hp >= 15)).toBe(true);
  });

  it.each(MACHINES.map((m) => [m.name, m] as const))('%s passes schema', (_name, m) => {
    expect(m.minRpm).toBeGreaterThan(0);
    expect(m.maxRpm).toBeGreaterThan(m.minRpm);
    expect(m.maxPower_hp).toBeGreaterThan(0);
    expect(m.efficiency).toBeGreaterThan(0);
    expect(m.efficiency).toBeLessThanOrEqual(1);
    expect(m.maxFeed_ipm).toBeGreaterThan(0);
    if (m.baseRpm !== undefined) {
      expect(m.baseRpm).toBeGreaterThanOrEqual(m.minRpm);
      expect(m.baseRpm).toBeLessThanOrEqual(m.maxRpm);
    }
    if (m.discreteRpms !== undefined) {
      for (let i = 1; i < m.discreteRpms.length; i++) {
        expect(m.discreteRpms[i]).toBeGreaterThan(m.discreteRpms[i - 1]);
      }
    }
  });

  it('lookup works', () => {
    expect(getMachine('mill-vmc-20hp')?.maxPower_hp).toBe(20);
    expect(getMachine('nope')).toBeUndefined();
  });
});
