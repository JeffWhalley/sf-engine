import { useCalcStore } from '../store/useCalcStore';
import type { TurningOp } from '../data';
import { Field } from './Field';
import { LengthField } from './LengthField';

const OPS: { id: TurningOp; label: string }[] = [
  { id: 'rough', label: 'Rough' },
  { id: 'finish', label: 'Finish' },
];

/** Phase 7 T4 — turning geometry (workpiece Ø, rough/finish, nose radius). */
export function TurningInputs() {
  const turn = useCalcStore((s) => s.turn);
  const setTurn = useCalcStore((s) => s.setTurn);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">Pass type</span>
        <div className="inset flex p-0.5">
          {OPS.map((o) => {
            const active = o.id === turn.op;
            return (
              <button
                key={o.id}
                onClick={() => setTurn({ op: o.id })}
                className={`rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider transition-colors ${
                  active ? 'bg-machined-hi text-accent' : 'text-ink-3 hover:bg-machined-hi hover:text-ink'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Workpiece diameter">
          <LengthField fieldId="turn.d" value_in={turn.workpieceDiameter_in}
            onCommit_in={(v) => setTurn({ workpieceDiameter_in: v })} />
        </Field>
        <Field label="Nose radius">
          <LengthField fieldId="turn.nose" value_in={turn.noseRadius_in} imperialDigits={4} metricDigits={3}
            onCommit_in={(v) => setTurn({ noseRadius_in: v })} />
        </Field>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-ink-3">
        Feed/rev and depth of cut are seeded from the material's window for the
        selected pass type and the performance slider.
      </p>
    </div>
  );
}
