import { useMemo, useState } from 'react';
import { searchMachinePresets } from '../data';
import { useCalcStore } from '../store/useCalcStore';
import { useLibraryStore, uid } from '../store/useLibraryStore';

/**
 * Phase 7b — searchable preset picker: "start from preset → edit".
 * Adopting a preset copies it into the user's machine library (so it can be
 * edited/deleted like any user machine) and selects it.
 */
export function MachinePresetPicker() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const saveMachine = useLibraryStore((s) => s.saveMachine);
  const setMachine = useCalcStore((s) => s.setMachine);

  const matches = useMemo(() => searchMachinePresets(query).slice(0, 6), [query]);

  return (
    <div className="mt-2 border-t border-hairline pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="engraved text-[10px] text-ink-3 transition-colors hover:text-ink"
      >
        {open ? '▾' : '▸'} Start from a preset…
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          <input
            className="field-input"
            placeholder="Search presets (Tormach, Haas, router…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search machine presets"
          />
          <ul className="space-y-0.5">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  className="w-full rounded px-2 py-1 text-left font-mono text-[11px] text-ink-2 transition-colors hover:bg-machined-hi hover:text-ink"
                  onClick={() => {
                    const copy = { ...p, id: uid('machine'), name: p.name };
                    saveMachine(copy);
                    setMachine(copy.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {p.name}
                  <span className="ml-2 text-ink-3">
                    {p.maxPower_hp} hp · {p.maxRpm.toLocaleString()} rpm
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-1 font-mono text-[11px] text-ink-3">No presets match.</li>
            )}
          </ul>
          <p className="font-mono text-[10px] leading-relaxed text-ink-3">
            Presets are approximate public specs — verify against your machine, then edit in
            your library.
          </p>
        </div>
      )}
    </div>
  );
}
