import { useState } from 'react';
import type { Machine } from '../data';
import { useCalcStore } from '../store/useCalcStore';
import { useLibraryStore, uid, resolveMachine } from '../store/useLibraryStore';
import { getMachine } from '../data';
import { Field, Select } from './Field';
import { NumberField } from './NumberField';

const RIGIDITY: { value: string; label: string }[] = [
  { value: 'light', label: 'Light (benchtop/router)' },
  { value: 'medium', label: 'Medium (knee mill)' },
  { value: 'rigid', label: 'Rigid (VMC)' },
];

/**
 * Backlog — full machine editor. Seed machines are immutable: editing one
 * saves a copy into the user library ("duplicate & edit"); user machines are
 * updated in place. Discrete RPMs entered as a comma list.
 */
export function MachineEditor() {
  const machineId = useCalcStore((s) => s.machineId);
  const setMachine = useCalcStore((s) => s.setMachine);
  const userMachines = useLibraryStore((s) => s.userMachines);
  const saveMachine = useLibraryStore((s) => s.saveMachine);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Machine | null>(null);
  const [rpmList, setRpmList] = useState('');
  const [rpmListInvalid, setRpmListInvalid] = useState(false);

  const isUserMachine = userMachines.some((m) => m.id === machineId);

  const begin = () => {
    const cur = resolveMachine(machineId) ?? getMachine('mill-vmc-20hp')!;
    const d = isUserMachine ? { ...cur } : { ...cur, id: uid('machine'), name: `${cur.name} (copy)` };
    setDraft(d);
    setRpmList(d.discreteRpms?.join(', ') ?? '');
    setRpmListInvalid(false);
    setOpen(true);
  };

  const parseRpms = (raw: string): number[] | null | undefined => {
    const t = raw.trim();
    if (t === '') return undefined; // continuously variable
    const parts = t.split(/[,\s]+/).map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
    return [...parts].sort((a, b) => a - b);
  };

  const commit = () => {
    if (!draft) return;
    const rpms = parseRpms(rpmList);
    if (rpms === null) {
      setRpmListInvalid(true);
      return;
    }
    const clean: Machine = {
      ...draft,
      name: draft.name.trim() || 'Custom machine',
      minRpm: Math.min(draft.minRpm, draft.maxRpm),
      maxRpm: Math.max(draft.minRpm, draft.maxRpm),
      efficiency: Math.min(1, Math.max(0.05, draft.efficiency)),
      discreteRpms: rpms,
      taper: draft.taper?.trim() || undefined,
    };
    saveMachine(clean);
    setMachine(clean.id);
    setOpen(false);
  };

  const num = (label: string, key: keyof Machine, unit: string, digits = 0, step = 1) => (
    <Field label={label}>
      <NumberField
        value={(draft![key] as number) ?? 0}
        unit={unit}
        digits={digits}
        step={step}
        onCommit={(v) => setDraft((d) => d && { ...d, [key]: v })}
      />
    </Field>
  );

  if (!open || !draft) {
    return (
      <button onClick={begin} className="engraved mt-1.5 text-[10px] text-ink-3 transition-colors hover:text-ink">
        ▸ {isUserMachine ? 'Edit machine…' : 'Duplicate & edit…'}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2.5 rounded border border-hairline bg-machined-hi/40 p-2.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">{isUserMachine ? 'Edit machine' : 'New machine from current'}</span>
        <span className="font-mono text-[10px] text-ink-3">saved to your library</span>
      </div>

      <Field label="Name">
        <input className="field-input" value={draft.name} aria-label="Machine name"
          onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        {num('Max RPM', 'maxRpm', 'rpm')}
        {num('Min RPM', 'minRpm', 'rpm')}
        {num('Base RPM', 'baseRpm', 'rpm')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {num('Power', 'maxPower_hp', 'hp', 1, 0.5)}
        {num('Efficiency', 'efficiency', '0–1', 2, 0.05)}
        {num('Max feed', 'maxFeed_ipm', 'ipm')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {num('Max torque', 'maxTorque_lbft', 'lb·ft', 1, 0.5)}
        <Field label="Rigidity">
          <Select value={draft.rigidity ?? 'medium'} options={RIGIDITY}
            onChange={(v) => setDraft((d) => d && { ...d, rigidity: v as Machine['rigidity'] })} />
        </Field>
        <Field label="Taper">
          <input className="field-input" value={draft.taper ?? ''} aria-label="Taper"
            onChange={(e) => setDraft((d) => d && { ...d, taper: e.target.value })} />
        </Field>
      </div>

      <Field label="Fixed speeds" hint="comma list; empty = variable">
        <input
          className={`field-input ${rpmListInvalid ? 'invalid' : ''}`}
          value={rpmList}
          aria-label="Discrete RPMs"
          placeholder="e.g. 60, 290, 660, 1200, 2720"
          onChange={(e) => { setRpmList(e.target.value); setRpmListInvalid(false); }}
        />
      </Field>

      <div className="flex gap-2">
        <button onClick={commit}
          className="rounded bg-accent/20 px-3 py-1 font-display text-[11px] uppercase tracking-wider text-accent">
          Save machine
        </button>
        <button onClick={() => setOpen(false)}
          className="rounded px-3 py-1 font-display text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
