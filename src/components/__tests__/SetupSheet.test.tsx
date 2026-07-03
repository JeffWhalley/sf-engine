// @vitest-environment jsdom
/** Phase 8 T2 — setup sheet renders the current state (one printable page). */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { SetupSheet } from '../SetupSheet';
import { useCalcStore } from '../../store/useCalcStore';

afterEach(cleanup);
beforeEach(() => {
  const s = useCalcStore.getState();
  s.setOperation('milling');
  s.setMaterial('al-6061');
  s.setTool('em-flat-050-4fl-carbide');
  s.setMachine('mill-vmc-20hp');
  s.setPerformance(50);
  s.setUnitSystem('imperial');
});

describe('SetupSheet', () => {
  it('renders material, machine, parameters, disclaimer, share URL and QR', async () => {
    render(<SetupSheet onBack={() => {}} />);
    expect(screen.getByText('Setup Sheet')).toBeInTheDocument();
    expect(screen.getByText(/6061/)).toBeInTheDocument();
    expect(screen.getByText(/Industrial VMC/)).toBeInTheDocument();
    expect(screen.getByText('Spindle')).toBeInTheDocument();
    expect(screen.getByText(/conservative starting points/i)).toBeInTheDocument();
    expect(screen.getByText(/#v1\./)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('QR code of the share link')).toBeInTheDocument(),
    );
    expect(screen.getByText(/made with/i)).toBeInTheDocument();
  });

  it('drilling mode renders drill geometry instead of milling rows', () => {
    useCalcStore.getState().setOperation('drilling');
    render(<SetupSheet onBack={() => {}} />);
    expect(screen.getByText('Drill Ø')).toBeInTheDocument();
    expect(screen.queryByText('WOC (ae)')).not.toBeInTheDocument();
  });
});
