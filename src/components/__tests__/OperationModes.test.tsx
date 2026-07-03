// @vitest-environment jsdom
/**
 * Phase 7 T4 — operation switcher.
 * AC: mode switch preserves material/machine selection; documented drill/turn
 * examples reproduce on screen (golden vectors D-A and T-A).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import App from '../../App';
import { useCalcStore } from '../../store/useCalcStore';
import { computeDrilling, computeTurning } from '../../engine';
import { DrillingResults } from '../DrillingResults';
import { TurningResults } from '../TurningResults';

afterEach(cleanup);
beforeEach(() => {
  const s = useCalcStore.getState();
  s.setOperation('milling');
  s.setMaterial('al-6061');
  s.setMachine('mill-vmc-20hp');
  s.setDrill({ diameter_in: 0.25, material: 'hss', holeDepth_in: 0.75 });
  s.setPerformance(50);
});

describe('mode switching (store)', () => {
  it('preserves material and machine across mode switches', () => {
    const s = useCalcStore.getState();
    s.setMaterial('steel-1018');
    s.setMachine('mill-hobby-1hp');
    s.setOperation('drilling');
    expect(useCalcStore.getState().materialId).toBe('steel-1018');
    expect(useCalcStore.getState().machineId).toBe('mill-hobby-1hp');
    useCalcStore.getState().setOperation('turning');
    expect(useCalcStore.getState().materialId).toBe('steel-1018');
    useCalcStore.getState().setOperation('milling');
    expect(useCalcStore.getState().machineId).toBe('mill-hobby-1hp');
  });

  it('snapshot round-trips the operation mode and per-mode geometry', () => {
    const s = useCalcStore.getState();
    s.setOperation('turning');
    s.setTurn({ workpieceDiameter_in: 3.5, op: 'finish' });
    const snap = useCalcStore.getState().snapshot();
    useCalcStore.getState().setOperation('milling');
    useCalcStore.getState().setTurn({ workpieceDiameter_in: 1, op: 'rough' });
    useCalcStore.getState().loadSnapshot(snap);
    expect(useCalcStore.getState().operation).toBe('turning');
    expect(useCalcStore.getState().turn.workpieceDiameter_in).toBe(3.5);
    expect(useCalcStore.getState().turn.op).toBe('finish');
  });

  it('legacy snapshots (no operation field) load as milling', () => {
    const snap = useCalcStore.getState().snapshot();
    delete (snap as unknown as Record<string, unknown>).operation;
    delete (snap as unknown as Record<string, unknown>).drill;
    delete (snap as unknown as Record<string, unknown>).turn;
    useCalcStore.getState().setOperation('drilling');
    useCalcStore.getState().loadSnapshot(snap);
    expect(useCalcStore.getState().operation).toBe('milling');
  });
});

describe('Golden Vector D-A reproduces on screen (documented in drilling.ts header)', () => {
  it('shows RPM 1,910 and feed 15.28 for the documented inputs', () => {
    const r = computeDrilling({
      sfm: 250, diameter_in: 0.5, ipr: 0.008, holeDepth_in: 2.0,
      unitPower_hpMinIn3: 0.25, kc_nPerMm2: 700,
    });
    render(<DrillingResults result={r} sys="imperial" />);
    expect(screen.getByText('1,910')).toBeInTheDocument(); // 1909.86 rounds
    expect(screen.getByText('15.28')).toBeInTheDocument();
    expect(screen.getAllByText(/peck/i).length).toBeGreaterThan(0); // 4×D → peck advice
  });
});

describe('Golden Vector T-A reproduces on screen (documented in turning.ts header)', () => {
  it('shows RPM 764 and feed 7.64 for the documented inputs', () => {
    const r = computeTurning({
      sfm: 400, workpieceDiameter_in: 2.0, ipr: 0.01, doc_in: 0.1,
      noseRadius_in: 1 / 32, unitPower_hpMinIn3: 1.0,
    });
    render(<TurningResults result={r} sys="imperial" />);
    expect(screen.getByText('764')).toBeInTheDocument(); // 763.94 rounds
    expect(screen.getByText('7.64')).toBeInTheDocument();
  });
});

describe('App integration — switching to Drill mode swaps inputs and results', () => {
  it('clicking Drill shows drilling inputs and the resolved default readout', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Drill' }));
    expect(screen.getByText('Drill diameter')).toBeInTheDocument();
    // al-6061 (N group) HSS window 200–300 @ perf 50 → SFM 250 on Ø0.25
    // rpm = 12·250 / (π·0.25) = 3819.7 → "3,820"
    expect(screen.getByText('3,820')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Turn' }));
    expect(screen.getByText('Workpiece diameter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Mill' }));
    expect(screen.getByText('Width of cut')).toBeInTheDocument();
  });
});

describe('Phase 8 T3 — manufacturer badge', () => {
  it('shows "Using <brand> data" for a branded tool and hides it otherwise', () => {
    useCalcStore.getState().setTool('em-flat-0375-3fl-carbide-alu');
    render(<App />);
    expect(screen.getByText(/using example tooling data/i)).toBeInTheDocument();
    cleanup();
    useCalcStore.getState().setTool('em-flat-050-4fl-carbide');
    render(<App />);
    expect(screen.queryByText(/using .* data/i)).not.toBeInTheDocument();
  });
});
