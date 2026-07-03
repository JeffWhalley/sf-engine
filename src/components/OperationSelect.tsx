import { useCalcStore, type Operation } from '../store/useCalcStore';

const OPS: { id: Operation; label: string }[] = [
  { id: 'milling', label: 'Mill' },
  { id: 'drilling', label: 'Drill' },
  { id: 'turning', label: 'Turn' },
];

/** Phase 7 T4 — operation mode switcher. Material & machine survive switches. */
export function OperationSelect() {
  const operation = useCalcStore((s) => s.operation);
  const setOperation = useCalcStore((s) => s.setOperation);
  return (
    <div className="inset flex p-0.5" role="tablist" aria-label="Operation">
      {OPS.map((o) => {
        const active = o.id === operation;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => setOperation(o.id)}
            className={`rounded px-3 py-1 font-display text-[12px] uppercase tracking-wider transition-colors ${
              active
                ? 'bg-machined-hi text-accent'
                : 'text-ink-3 hover:bg-machined-hi hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
