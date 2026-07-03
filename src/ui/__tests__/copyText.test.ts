/** PLAN §8.3 — copy-results text. */
import { describe, it, expect } from 'vitest';
import { millingCopyText, drillingCopyText, turningCopyText } from '../copyText';
import { getMaterial, getTool, getMachine, calculateWithLimits,
  calculateDrilling, calculateTurning } from '../../data';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const machine = getMachine('mill-vmc-20hp')!;

describe('copy text builders', () => {
  it('milling text carries the key readings, context and share URL', () => {
    const limited = calculateWithLimits({ material, tool, ae_in: 0.2, ap_in: 0.5, performance: 50 }, machine);
    const text = millingCopyText({
      limited, material, tool, machine, ae_in: 0.2, ap_in: 0.5,
      performance: 50, sys: 'imperial', shareUrl: 'https://x.test/#v1.abc',
    });
    expect(text).toContain('MILLING — 6061-T6 Aluminum');
    expect(text).toContain(`RPM: ${Math.round(limited.result.rpm).toLocaleString('en-US')}`);
    expect(text).toContain('Feed:');
    expect(text).toContain('verify against tool manufacturer data');
    expect(text.endsWith('https://x.test/#v1.abc')).toBe(true);
  });

  it('drilling text includes peck note; turning text includes surface speed', () => {
    const dr = calculateDrilling({ material, drillDiameter_in: 0.25, holeDepth_in: 1.5, machine });
    const dText = drillingCopyText({
      result: dr, material, drillDiameter_in: 0.25, drillMaterial: 'hss',
      machine, sys: 'imperial',
    });
    expect(dText).toContain('DRILLING');
    expect(dText).toContain(dr.peck.note);
    const tr = calculateTurning({ material, workpieceDiameter_in: 2, machine });
    const tText = turningCopyText({
      result: tr, material, workpieceDiameter_in: 2, op: 'rough', machine, sys: 'metric',
    });
    expect(tText).toContain('TURNING (rough)');
    expect(tText).toContain('Surface speed:');
    expect(tText).toContain('m/min');
  });
});
