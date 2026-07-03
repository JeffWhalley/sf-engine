import { describe, it, expect } from 'vitest';
import { MATERIALS, getMaterial, searchMaterials } from '../materials';

const ISO_GROUPS = new Set(['P', 'M', 'K', 'N', 'S', 'H']);

describe('materials seed data', () => {
  it('has at least 10 materials with unique ids', () => {
    expect(MATERIALS.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(MATERIALS.map((m) => m.id));
    expect(ids.size).toBe(MATERIALS.length);
  });

  it.each(MATERIALS.map((m) => [m.name, m] as const))('%s passes schema', (_name, m) => {
    expect(m.id.length).toBeGreaterThan(0);
    expect(m.name.length).toBeGreaterThan(0);
    expect(ISO_GROUPS.has(m.isoGroup)).toBe(true);

    // SFM window valid and positive
    expect(m.sfmCarbide.min).toBeGreaterThan(0);
    expect(m.sfmCarbide.max).toBeGreaterThan(m.sfmCarbide.min);

    // unit power & kc positive
    expect(m.unitPower).toBeGreaterThan(0);
    if (m.kc !== undefined) expect(m.kc).toBeGreaterThan(0);

    // chipload table: ascending diameter, increasing fz, all positive
    const t = m.chiploadByDiameter;
    expect(t.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < t.length; i++) {
      expect(t[i].d_in).toBeGreaterThan(0);
      expect(t[i].fz_in).toBeGreaterThan(0);
      if (i > 0) {
        expect(t[i].d_in).toBeGreaterThan(t[i - 1].d_in);
        expect(t[i].fz_in).toBeGreaterThanOrEqual(t[i - 1].fz_in);
      }
    }
  });

  it('aluminum chipload table reproduces plan §3.4 exactly', () => {
    const al = getMaterial('al-6061')!;
    const fz = Object.fromEntries(al.chiploadByDiameter.map((p) => [p.d_in, p.fz_in]));
    expect(fz[0.0625]).toBeCloseTo(0.0005, 6);
    expect(fz[0.125]).toBeCloseTo(0.001, 6);
    expect(fz[0.25]).toBeCloseTo(0.002, 6);
    expect(fz[0.5]).toBeCloseTo(0.003, 6);
    expect(fz[0.75]).toBeCloseTo(0.004, 6);
    expect(fz[1.0]).toBeCloseTo(0.005, 6);
  });

  it('lookup and search work', () => {
    expect(getMaterial('al-6061')?.name).toContain('Aluminum');
    expect(getMaterial('nope')).toBeUndefined();
    expect(searchMaterials('stainless').length).toBeGreaterThanOrEqual(2);
    expect(searchMaterials('').length).toBe(MATERIALS.length);
  });
});
