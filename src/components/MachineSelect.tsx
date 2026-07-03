import { MACHINES, getMachine } from '../data';
import { useCalcStore } from '../store/useCalcStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { Field, Select, type Option } from './Field';
import { powerToDisplay, powerUnit } from '../ui/format';
import { MachinePresetPicker } from './MachinePresetPicker';
import { MachineEditor } from './MachineEditor';

export function MachineSelect() {
  const id = useCalcStore((s) => s.machineId);
  const sys = useCalcStore((s) => s.unitSystem);
  const setMachine = useCalcStore((s) => s.setMachine);
  const userMachines = useLibraryStore((s) => s.userMachines);
  const m = getMachine(id) ?? userMachines.find((x) => x.id === id) ?? MACHINES[0];

  const options: Option[] = [
    ...MACHINES.map((x) => ({ value: x.id, label: x.name })),
    ...userMachines.map((x) => ({ value: x.id, label: `★ ${x.name}` })),
  ];

  return (
    <Field label="Machine" hint={m.taper}>
      <Select value={id} options={options} onChange={setMachine} />
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-3">
        <span>{powerToDisplay(m.maxPower_hp, sys).toFixed(1)} {powerUnit(sys)}</span>
        <span>{m.minRpm.toLocaleString()}–{m.maxRpm.toLocaleString()} rpm</span>
        <span>≤{m.maxFeed_ipm} ipm</span>
        {m.rigidity && <span>{m.rigidity}</span>}
      </div>
      <MachineEditor />
      <MachinePresetPicker />
    </Field>
  );
}
