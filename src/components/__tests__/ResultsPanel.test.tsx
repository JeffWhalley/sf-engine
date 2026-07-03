// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { computeMilling } from '../../engine';
import { VECTOR_A } from '../../engine/__tests__/vectors';
import { getMachine, getTool, type LimitedResult } from '../../data';
import { ResultsPanel } from '../ResultsPanel';

afterEach(cleanup);

const machine = getMachine('mill-vmc-20hp')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const result = computeMilling(VECTOR_A.input);
const limited: LimitedResult = {
  result,
  unclamped: result,
  clampedRpm: false,
  clampedFeed: false,
  clampedPower: false,
  demandedPower_hp: 0.94,
  feedLocked: false,
  rpmSolvedForChipload: false,
  availablePower_hp: machine.maxPower_hp,
  performanceCappedTo: null,
};

describe('ResultsPanel renders engine output (Vector A reproduces on screen)', () => {
  it('shows the documented RPM and feed in the readout', () => {
    render(
      <ResultsPanel limited={limited} machine={machine} tool={tool} ae_in={VECTOR_A.input.ae_in} sys="imperial" warnings={[]} />,
    );
    expect(screen.getByText('4,584')).toBeInTheDocument();
    expect(screen.getByText('91.67')).toBeInTheDocument();
    expect(screen.getByText('in/min')).toBeInTheDocument();
  });

  it('renders metric without crashing and switches the feed unit', () => {
    render(
      <ResultsPanel limited={limited} machine={machine} tool={tool} ae_in={VECTOR_A.input.ae_in} sys="metric" warnings={[]} />,
    );
    expect(screen.getByText('4,584')).toBeInTheDocument();
    expect(screen.getByText('mm/min')).toBeInTheDocument();
  });
});
