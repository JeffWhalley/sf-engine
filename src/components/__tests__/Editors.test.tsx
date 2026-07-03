// @vitest-environment jsdom
/** Backlog — full tool & machine editors save into the user library. */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ToolEditor } from '../ToolEditor';
import { MachineEditor } from '../MachineEditor';
import { useCalcStore } from '../../store/useCalcStore';
import { useLibraryStore } from '../../store/useLibraryStore';

afterEach(cleanup);
beforeEach(() => {
  useCalcStore.getState().setTool('em-flat-050-4fl-carbide');
  useCalcStore.getState().setMachine('mill-vmc-20hp');
});

describe('ToolEditor', () => {
  it('duplicate & edit a seed tool → new user tool selected, all fields kept', () => {
    render(<ToolEditor />);
    fireEvent.click(screen.getByText(/duplicate & edit/i));
    const name = screen.getByLabelText('Tool name');
    fireEvent.change(name, { target: { value: 'My 1/2 rougher' } });
    fireEvent.click(screen.getByText('Save tool'));
    const st = useCalcStore.getState();
    expect(st.toolId).toMatch(/^tool:/);
    const saved = useLibraryStore.getState().userTools.find((t) => t.id === st.toolId)!;
    expect(saved.name).toBe('My 1/2 rougher');
    expect(saved.diameter_in).toBe(0.5);
    expect(saved.shankDiameter_in).toBe(0.5);
    useLibraryStore.getState().deleteTool(saved.id);
  });

  it('non-bull tools drop cornerRadius on save', () => {
    render(<ToolEditor />);
    fireEvent.click(screen.getByText(/duplicate & edit/i));
    fireEvent.click(screen.getByText('Save tool'));
    const saved = useLibraryStore.getState().userTools.at(-1)!;
    expect(saved.type).toBe('flatEndmill');
    expect(saved.cornerRadius_in).toBeUndefined();
    useLibraryStore.getState().deleteTool(saved.id);
  });
});

describe('MachineEditor', () => {
  it('duplicate & edit a seed machine with a discrete speed list', () => {
    render(<MachineEditor />);
    fireEvent.click(screen.getByText(/duplicate & edit/i));
    fireEvent.change(screen.getByLabelText('Machine name'), { target: { value: 'My VMC' } });
    fireEvent.change(screen.getByLabelText('Discrete RPMs'), { target: { value: '500, 1000, 8000' } });
    fireEvent.click(screen.getByText('Save machine'));
    const st = useCalcStore.getState();
    expect(st.machineId).toMatch(/^machine:/);
    const saved = useLibraryStore.getState().userMachines.find((m) => m.id === st.machineId)!;
    expect(saved.name).toBe('My VMC');
    expect(saved.discreteRpms).toEqual([500, 1000, 8000]);
    useLibraryStore.getState().deleteMachine(saved.id);
  });

  it('rejects a junk speed list instead of saving garbage', () => {
    render(<MachineEditor />);
    fireEvent.click(screen.getByText(/duplicate & edit/i));
    fireEvent.change(screen.getByLabelText('Discrete RPMs'), { target: { value: '500, banana' } });
    const before = useLibraryStore.getState().userMachines.length;
    fireEvent.click(screen.getByText('Save machine'));
    expect(useLibraryStore.getState().userMachines.length).toBe(before); // not saved
    expect(screen.getByLabelText('Discrete RPMs')).toHaveClass('invalid');
  });
});

describe('Backlog — per-field unit selection', () => {
  it('clicking the unit suffix flips just that field; canonical stays inches', async () => {
    const { LengthField } = await import('../LengthField');
    useCalcStore.getState().setUnitSystem('imperial');
    let committed = -1;
    render(
      <LengthField fieldId="test.len" value_in={1} onCommit_in={(v) => { committed = v; }} />,
    );
    const input = screen.getByRole('spinbutton');
    expect((input as HTMLInputElement).value).toBe('1.000');
    fireEvent.click(screen.getByTitle(/switch this field/i)); // → mm
    expect(useCalcStore.getState().fieldUnits['test.len']).toBe('metric');
    cleanup();
    render(
      <LengthField fieldId="test.len" value_in={1} onCommit_in={(v) => { committed = v; }} />,
    );
    const mmInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(mmInput.value).toBe('25.40'); // same canonical inch shown in mm
    fireEvent.change(mmInput, { target: { value: '12.7' } });
    expect(committed).toBeCloseTo(0.5, 9); // commits back in inches
  });

  it('global unit toggle clears per-field overrides', () => {
    useCalcStore.getState().setFieldUnit('x', 'metric');
    expect(useCalcStore.getState().fieldUnits['x']).toBe('metric');
    useCalcStore.getState().setUnitSystem('metric');
    expect(useCalcStore.getState().fieldUnits).toEqual({});
    useCalcStore.getState().setUnitSystem('imperial');
  });
});

describe('regression — app renders with a user-library machine selected', () => {
  it('saving a custom machine and selecting it does not blank the page', async () => {
    const { default: App } = await import('../../App');
    const machine = {
      ...useLibraryStore.getState().userMachines[0] ?? {
        id: 'machine:test-custom',
        name: 'My Custom Mill',
        maxRpm: 8000, minRpm: 100, maxPower_hp: 5, efficiency: 0.8, maxFeed_ipm: 200,
      },
      id: 'machine:test-custom',
      name: 'My Custom Mill',
    };
    useLibraryStore.getState().saveMachine(machine);
    useCalcStore.getState().setMachine('machine:test-custom');
    render(<App />);
    // Results panel renders (page not blank) and shows the custom machine's specs
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getAllByText(/my custom mill/i).length).toBeGreaterThan(0);
    useLibraryStore.getState().deleteMachine('machine:test-custom');
    useCalcStore.getState().setMachine('mill-vmc-20hp');
  });
});
