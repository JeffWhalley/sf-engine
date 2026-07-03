// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { calculate, getMaterial, getTool } from '../../data';
import { EngagementScope } from '../EngagementScope';

afterEach(cleanup);

const AL = getMaterial('al-6061')!;
const FLAT = getTool('em-flat-050-4fl-carbide')!;
const BALL = getTool('em-ball-050-2fl-carbide')!;

describe('EngagementScope surfaces the advanced physics', () => {
  it('shows radial engagement percent and a chip-thinning multiplier', () => {
    const r = calculate({ material: AL, tool: FLAT, ae_in: 0.05, ap_in: 0.5, performance: 50 });
    render(<EngagementScope result={r} tool={FLAT} ae_in={0.05} sys="imperial" />);
    expect(screen.getByText('10')).toBeInTheDocument(); // 0.05 / 0.5 = 10% of Ø
    expect(screen.getByText('×1.67')).toBeInTheDocument(); // radial thinning factor
  });

  it('flags effective-diameter tip engagement for a ball tool at shallow DOC', () => {
    const r = calculate({ material: AL, tool: BALL, ae_in: 0.1, ap_in: 0.05, performance: 50 });
    render(<EngagementScope result={r} tool={BALL} ae_in={0.1} sys="imperial" />);
    expect(screen.getByText(/effective Ø/i)).toBeInTheDocument();
  });
});

describe('Phase 9 T1 — reduced-motion fallback', () => {
  it('renders flutes statically (no rotation transform) when matchMedia is unavailable', async () => {
    const { computeMilling } = await import('../../engine');
    const { VECTOR_A } = await import('../../engine/__tests__/vectors');
    const { getTool, calculate, getMaterial } = await import('../../data');
    void calculate; void getMaterial;
    const tool = getTool('em-flat-050-4fl-carbide')!;
    const result = computeMilling(VECTOR_A.input);
    const { EngagementScope } = await import('../EngagementScope');
    const { render: r, screen: sc } = await import('@testing-library/react');
    r(<EngagementScope result={result} tool={tool} ae_in={VECTOR_A.input.ae_in} sys="imperial" />);
    const g = sc.getByTestId('flutes');
    // jsdom has no matchMedia → treated as reduced motion → no rAF transform.
    await new Promise((res) => setTimeout(res, 50));
    expect(g.getAttribute('transform')).toBeNull();
    expect(g.querySelectorAll('line')).toHaveLength(tool.flutes);
  });
});
