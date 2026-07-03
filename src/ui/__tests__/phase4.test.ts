import { describe, it, expect } from 'vitest';
import { calculate, getMaterial, getTool, getMachine } from '../../data';
import { advisories } from '../warnings';

const AL = getMaterial('al-6061')!;
const FLAT = getTool('em-flat-050-4fl-carbide')!;
const BALL = getTool('em-ball-050-2fl-carbide')!;
const MACHINE = getMachine('mill-vmc-20hp')!;

describe('Phase 4.1 — radial chip thinning raises feed as WOC drops', () => {
  const wide = calculate({ material: AL, tool: FLAT, ae_in: 0.25, ap_in: 0.5, performance: 50 }); // 50% Ø
  const narrow = calculate({ material: AL, tool: FLAT, ae_in: 0.05, ap_in: 0.5, performance: 50 }); // 10% Ø

  it('thinning factor is 1.0 at half engagement and >1 below it', () => {
    expect(wide.radialChipThinningFactor).toBeCloseTo(1.0, 3);
    expect(narrow.radialChipThinningFactor).toBeGreaterThan(1.4);
  });

  it('narrow WOC yields a higher feed rate', () => {
    expect(narrow.feed_ipm).toBeGreaterThan(wide.feed_ipm);
  });

  it('adjusted chip load exceeds the base at narrow WOC', () => {
    const base = narrow.chipload_in / narrow.radialChipThinningFactor;
    expect(narrow.chipload_in).toBeGreaterThan(base);
  });
});

describe('Phase 4.2 — ball nose at shallow DOC uses a smaller effective diameter', () => {
  const flat = calculate({ material: AL, tool: FLAT, ae_in: 0.1, ap_in: 0.05, performance: 50 });
  const ball = calculate({ material: AL, tool: BALL, ae_in: 0.1, ap_in: 0.05, performance: 50 });

  it('effective diameter is below nominal for the ball tool', () => {
    expect(ball.effectiveDiameter_in).toBeCloseTo(0.3, 6); // 1/2" ball at 0.05" DOC
    expect(flat.effectiveDiameter_in).toBeCloseTo(0.5, 6);
  });

  it('ball spins faster than the flat at equal surface speed (smaller Ø)', () => {
    expect(ball.rpm).toBeGreaterThan(flat.rpm);
  });
});

describe('Phase 4.3 — deflection advisory fires past the limit', () => {
  it('a long, thin stickout trips the deflection warning', () => {
    const longTool = { ...FLAT, stickout_in: 3.5 }; // far past ~3xD
    const r = calculate({ material: AL, tool: longTool, ae_in: 0.45, ap_in: 0.8, performance: 90 });
    const warns = advisories(r, { machine: MACHINE, tool: longTool, ap_in: 0.8, sys: 'imperial' });
    expect(r.deflection_in).toBeGreaterThan(0.001);
    expect(warns.some((w) => /deflection/i.test(w.message))).toBe(true);
  });

  it('a rigid short setup stays within limits (no deflection warning)', () => {
    const r = calculate({ material: AL, tool: FLAT, ae_in: 0.05, ap_in: 0.3, performance: 30 });
    const warns = advisories(r, { machine: MACHINE, tool: FLAT, ap_in: 0.3, sys: 'imperial' });
    expect(warns.some((w) => /deflection/i.test(w.message))).toBe(false);
  });
});
