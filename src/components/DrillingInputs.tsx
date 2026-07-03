import { useCalcStore } from '../store/useCalcStore';
import type { DrillMaterial } from '../data';
import { Field } from './Field';
import { LengthField } from './LengthField';

const DRILL_MATERIALS: { id: DrillMaterial; label: string }[] = [
  { id: 'hss', label: 'HSS' },
  { id: 'carbide', label: 'Carbide' },
];

/** Phase 7 T4 — drilling geometry (drill Ø, drill material, hole depth). */
export function DrillingInputs() {
  const drill = useCalcStore((s) => s.drill);
  const setDrill = useCalcStore((s) => s.setDrill);
  const ratio = drill.holeDepth_in > 0 ? drill.holeDepth_in / drill.diameter_in : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">Drill material</span>
        <div className="inset flex p-0.5">
          {DRILL_MATERIALS.map((m) => {
            const active = m.id === drill.material;
            return (
              <button
                key={m.id}
                onClick={() => setDrill({ material: m.id })}
                className={`rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider transition-colors ${
                  active ? 'bg-machined-hi text-accent' : 'text-ink-3 hover:bg-machined-hi hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Drill diameter">
          <LengthField fieldId="drill.d" value_in={drill.diameter_in}
            onCommit_in={(v) => setDrill({ diameter_in: v })} />
        </Field>
        <Field label="Hole depth" hint={ratio > 0 ? `${ratio.toFixed(1)}×D` : 'through'}>
          <LengthField fieldId="drill.depth" value_in={drill.holeDepth_in} minExclusive={-1}
            onCommit_in={(v) => setDrill({ holeDepth_in: Math.max(0, v) })} />
        </Field>
      </div>
    </div>
  );
}
