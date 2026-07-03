import { useEffect, useMemo, useRef, useState } from 'react';
import { getMaterial, searchMaterials } from '../data';
import type { Material } from '../data';
import { useCalcStore } from '../store/useCalcStore';
import { Field } from './Field';

const ISO_NAMES: Record<string, string> = {
  P: 'Steel',
  M: 'Stainless',
  K: 'Cast iron',
  N: 'Non-ferrous',
  S: 'Superalloy',
  H: 'Hardened',
};
const ISO_ORDER = ['N', 'P', 'M', 'K', 'S', 'H'];

/** Backlog item — searchable material combobox (replaces the grouped select). */
export function MaterialSelect() {
  const id = useCalcStore((s) => s.materialId);
  const setMaterial = useCalcStore((s) => s.setMaterial);
  const mat = getMaterial(id)!;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const found = searchMaterials(query);
    // stable ISO-group ordering, like the old grouped select
    return ISO_ORDER.flatMap((iso) => found.filter((m) => m.isoGroup === iso));
  }, [query]);

  useEffect(() => setActive(0), [query, open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (m: Material) => {
    setMaterial(m.id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  let lastGroup = '';
  return (
    <Field label="Material" hint={`${ISO_NAMES[mat.isoGroup]} · ISO ${mat.isoGroup}`}>
      <div ref={rootRef} className="relative">
        <input
          className="field-input"
          role="combobox"
          aria-expanded={open}
          aria-label="Material"
          placeholder={mat.name}
          value={open ? query : mat.name}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-3">
          ▾
        </span>
        {open && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded border border-hairline bg-machined shadow-xl"
          >
            {matches.length === 0 && (
              <li className="px-2.5 py-1.5 font-mono text-[11px] text-ink-3">No materials match.</li>
            )}
            {matches.map((m, i) => {
              const header = m.isoGroup !== lastGroup ? ISO_NAMES[m.isoGroup] : null;
              lastGroup = m.isoGroup;
              return (
                <li key={m.id} role="option" aria-selected={m.id === id}>
                  {header && (
                    <div className="engraved bg-machined-hi/50 px-2.5 py-1 text-[9px]">{header}</div>
                  )}
                  <button
                    className={`w-full px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                      i === active ? 'bg-machined-hi text-accent' : 'text-ink-2 hover:bg-machined-hi'
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(m)}
                  >
                    {m.name}
                    {m.id === id && <span className="ml-1.5 text-accent">●</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {mat.notes && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{mat.notes}</p>}
    </Field>
  );
}
