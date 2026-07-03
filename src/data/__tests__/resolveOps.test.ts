/**
 * Phase 7 resolver tests — resolveDrillingInput / resolveTurningInput
 * (INTEGRATION.md steps 4–5), plus the full-material integration sweep:
 * every MATERIAL (not just ISO group) × drill/turn → finite results.
 */
import { describe, it, expect } from 'vitest';
import { MATERIALS, getMaterial } from '../materials';
import { getMachine } from '../machines';
import {
  resolveDrillingInput,
  resolveTurningInput,
  calculateDrilling,
  calculateTurning,
  chiploadPerfMultiplier,
} from '../resolve';
import { DRILLING_SEEDS, SEED_HSS_DRILL_IPR, interpolateIpr, pickFromWindow } from '../cuttingSeeds';
import { computeDrilling } from '../../engine/drilling';
import { computeTurning } from '../../engine/turning';

const al = getMaterial('al-6061')!;

describe('resolveDrillingInput', () => {
  it('resolves 6061 × 1/2" HSS at balanced performance per the seed contracts', () => {
    const input = resolveDrillingInput({ material: al, drillDiameter_in: 0.5 });
    const seed = DRILLING_SEEDS[al.isoGroup];
    expect(input.sfm).toBeCloseTo(pickFromWindow(seed.sfmHss, 50), 6);
    expect(input.ipr).toBeCloseTo(
      interpolateIpr(SEED_HSS_DRILL_IPR, 0.5) * seed.iprMultiplier * chiploadPerfMultiplier(50),
      6,
    );
    expect(input.unitPower_hpMinIn3).toBe(al.unitPower);
    expect(input.kc_nPerMm2).toBe(al.kc);
  });

  it('carbide window is faster than HSS; performance raises SFM and IPR', () => {
    const hss = resolveDrillingInput({ material: al, drillDiameter_in: 0.5 });
    const carbide = resolveDrillingInput({
      material: al, drillDiameter_in: 0.5, drillMaterial: 'carbide',
    });
    expect(carbide.sfm).toBeGreaterThan(hss.sfm);
    const slow = resolveDrillingInput({ material: al, drillDiameter_in: 0.5, performance: 0 });
    const fast = resolveDrillingInput({ material: al, drillDiameter_in: 0.5, performance: 100 });
    expect(fast.sfm).toBeGreaterThan(slow.sfm);
    expect(fast.ipr).toBeGreaterThan(slow.ipr);
  });

  it('plumbs machine efficiency + RPM ceiling through to a clamped result', () => {
    const machine = getMachine('mill-hobby-1hp')!;
    const r = calculateDrilling({
      material: al, drillDiameter_in: 0.0625, drillMaterial: 'carbide',
      performance: 100, machine,
    });
    // Tiny carbide drill in aluminum wants far more RPM than any seed machine has.
    expect(r.rpmClamped).toBe(true);
    expect(r.rpm).toBeLessThanOrEqual(machine.maxRpm);
  });
});

describe('resolveTurningInput', () => {
  it('rough is heavier than finish at the same performance', () => {
    const rough = resolveTurningInput({ material: al, workpieceDiameter_in: 2, op: 'rough' });
    const finish = resolveTurningInput({ material: al, workpieceDiameter_in: 2, op: 'finish' });
    expect(rough.ipr).toBeGreaterThan(finish.ipr);
    expect(rough.doc_in).toBeGreaterThan(finish.doc_in);
    expect(rough.sfm).toBeCloseTo(finish.sfm, 6); // speed window is shared
  });

  it('HSS tooling derives SFM × 0.35; explicit ipr/doc overrides win', () => {
    const c = resolveTurningInput({ material: al, workpieceDiameter_in: 2 });
    const h = resolveTurningInput({ material: al, workpieceDiameter_in: 2, insertMaterial: 'hss' });
    expect(h.sfm).toBeCloseTo(c.sfm * 0.35, 6);
    const o = resolveTurningInput({
      material: al, workpieceDiameter_in: 2, ipr: 0.0042, doc_in: 0.033,
    });
    expect(o.ipr).toBe(0.0042);
    expect(o.doc_in).toBe(0.033);
  });
});

describe('integration sweep — every material × drill/turn stays finite', () => {
  const assertFinite = (r: Record<string, unknown>, label: string) => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') {
        expect(Number.isFinite(v), `${label} → ${k}`).toBe(true);
      }
    }
  };

  it(`drilling: ${MATERIALS.length} materials × 2 drill materials × 4 Ø × 3 perf`, () => {
    for (const material of MATERIALS) {
      for (const drillMaterial of ['hss', 'carbide'] as const) {
        for (const d of [0.0625, 0.25, 0.5, 1.0]) {
          for (const performance of [0, 50, 100]) {
            const r = computeDrilling(resolveDrillingInput({
              material, drillDiameter_in: d, drillMaterial,
              holeDepth_in: d * 4, performance,
            }));
            assertFinite(
              r as unknown as Record<string, unknown>,
              `${material.id} ${drillMaterial} Ø${d} p${performance}`,
            );
          }
        }
      }
    }
  });

  it(`turning: ${MATERIALS.length} materials × 2 ops × 3 Ø × 3 perf`, () => {
    for (const material of MATERIALS) {
      for (const op of ['rough', 'finish'] as const) {
        for (const d of [0.25, 1.0, 4.0]) {
          for (const performance of [0, 50, 100]) {
            const r = computeTurning(resolveTurningInput({
              material, workpieceDiameter_in: d, op, noseRadius_in: 0.0312, performance,
            }));
            assertFinite(
              r as unknown as Record<string, unknown>,
              `${material.id} ${op} Ø${d} p${performance}`,
            );
          }
        }
      }
    }
  });

  it('convenience wrappers agree with compute(resolve(...))', () => {
    const rd = calculateDrilling({ material: al, drillDiameter_in: 0.5, holeDepth_in: 2 });
    expect(rd).toEqual(computeDrilling(resolveDrillingInput({
      material: al, drillDiameter_in: 0.5, holeDepth_in: 2,
    })));
    const rt = calculateTurning({ material: al, workpieceDiameter_in: 2 });
    expect(rt).toEqual(computeTurning(resolveTurningInput({ material: al, workpieceDiameter_in: 2 })));
  });
});
