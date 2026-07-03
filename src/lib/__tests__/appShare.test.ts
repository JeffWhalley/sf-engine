/**
 * Phase 8 — app share glue. AC: a share URL from machine A reproduces
 * identical outputs on machine B (golden round-trip through the calculator).
 */
import { describe, it, expect } from 'vitest';
import { buildShareUrl, buildSheetUrl, parseAppHash } from '../appShare';
import type { JobSnapshot } from '../../store/useLibraryStore';
import { getMaterial, getTool, getMachine, calculateWithLimits } from '../../data';

const SNAP: JobSnapshot = {
  materialId: 'steel-1018',
  toolId: 'em-flat-050-4fl-carbide',
  machineId: 'mill-hobby-1hp',
  overrides: { stickout_in: 2.25 },
  ae_in: 0.15,
  ap_in: 0.4,
  performance: 65,
  unitSystem: 'metric',
  operation: 'milling',
  drill: { diameter_in: 0.25, material: 'hss', holeDepth_in: 0.75 },
  turn: { workpieceDiameter_in: 2, op: 'rough', noseRadius_in: 1 / 32 },
};

const BASE = 'https://app.example.com/';

describe('share URL round trip', () => {
  it('encode → parse returns the identical snapshot', () => {
    const url = buildShareUrl(SNAP, BASE);
    expect(url.startsWith(`${BASE}#v1.`)).toBe(true);
    const parsed = parseAppHash(new URL(url).hash);
    expect(parsed.route).toBe('app');
    expect(parsed.snapshot).toEqual(SNAP);
  });

  it('sheet URL routes to the sheet with the same state', () => {
    const url = buildSheetUrl(SNAP, BASE);
    expect(url.includes('#sheet.v1.')).toBe(true);
    const parsed = parseAppHash(new URL(url).hash);
    expect(parsed.route).toBe('sheet');
    expect(parsed.snapshot).toEqual(SNAP);
  });

  it('AC golden: decoded snapshot reproduces identical calculator outputs', () => {
    const url = buildShareUrl(SNAP, BASE);
    const restored = parseAppHash(new URL(url).hash).snapshot!;
    const build = (snap: JobSnapshot) => {
      const tool = getTool(snap.toolId)!;
      return calculateWithLimits(
        {
          material: getMaterial(snap.materialId)!,
          tool: { ...tool, stickout_in: snap.overrides.stickout_in ?? tool.stickout_in },
          ae_in: snap.ae_in,
          ap_in: snap.ap_in,
          performance: snap.performance,
        },
        getMachine(snap.machineId)!,
      );
    };
    // "Machine A" (original) and "machine B" (restored from URL) — identical.
    expect(build(restored)).toEqual(build(SNAP));
  });
});

describe('parseAppHash robustness', () => {
  it('empty / plain-anchor / bare-sheet fragments', () => {
    expect(parseAppHash('')).toEqual({ route: 'app' });
    expect(parseAppHash('#some-anchor')).toEqual({ route: 'app' });
    expect(parseAppHash('#sheet')).toEqual({ route: 'sheet' });
  });

  it('corrupt payload yields a friendly error, never throws', () => {
    const p = parseAppHash('#v1.%%%not-base64%%%');
    expect(p.route).toBe('app');
    expect(p.snapshot).toBeUndefined();
    expect(p.error).toMatch(/damaged|truncated/i);
  });

  it('future version yields the upgrade message', () => {
    const p = parseAppHash('#v9.AAAA');
    expect(p.error).toMatch(/newer version/i);
  });

  it('valid codec payload that is not a setup is rejected politely', () => {
    const url = buildShareUrl({ hello: 'world' } as unknown as JobSnapshot, BASE);
    const p = parseAppHash(new URL(url).hash);
    expect(p.snapshot).toBeUndefined();
    expect(p.error).toMatch(/not a valid setup/i);
  });
});
