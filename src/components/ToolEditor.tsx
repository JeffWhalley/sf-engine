import { useState } from 'react';
import type { Tool } from '../data';
import type { ToolType, ToolMaterial } from '../engine';
import type { Coating } from '../data';
import { useCalcStore, effectiveTool } from '../store/useCalcStore';
import { useLibraryStore, uid } from '../store/useLibraryStore';
import { Field, Select } from './Field';
import { NumberField } from './NumberField';
import { lengthFromDisplay, lengthToDisplay, lengthUnit } from '../ui/format';

const TYPES: { value: ToolType; label: string }[] = [
  { value: 'flatEndmill', label: 'Flat endmill' },
  { value: 'ballEndmill', label: 'Ball endmill' },
  { value: 'bullEndmill', label: 'Bull endmill' },
  { value: 'drill', label: 'Drill' },
  { value: 'faceMill', label: 'Face mill' },
  { value: 'highFeedMill', label: 'High-feed mill' },
  { value: 'chamfer', label: 'Chamfer' },
  { value: 'reamer', label: 'Reamer' },
  { value: 'tap', label: 'Tap' },
];
const MATERIALS: { value: ToolMaterial; label: string }[] = [
  { value: 'hss', label: 'HSS' },
  { value: 'cobalt', label: 'Cobalt (M42)' },
  { value: 'carbide', label: 'Carbide' },
  { value: 'carbideCoated', label: 'Carbide, coated' },
];
const COATINGS: { value: Coating; label: string }[] = [
  { value: 'none', label: 'Uncoated' },
  { value: 'tin', label: 'TiN' },
  { value: 'tialn', label: 'TiAlN' },
  { value: 'altin', label: 'AlTiN' },
  { value: 'dlc', label: 'DLC' },
];

/**
 * Backlog — full tool editor. Edits every Tool field; saves as a NEW user
 * tool (seed tools are immutable) or updates an existing user tool in place.
 */
export function ToolEditor() {
  const state = useCalcStore();
  const sys = state.unitSystem;
  const u = lengthUnit(sys);
  const userTools = useLibraryStore((s) => s.userTools);
  const saveTool = useLibraryStore((s) => s.saveTool);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Tool | null>(null);

  const isUserTool = userTools.some((t) => t.id === state.toolId);

  const begin = () => {
    const cur = effectiveTool(state);
    setDraft(
      isUserTool
        ? { ...cur }
        : { ...cur, id: uid('tool'), name: `${cur.name} (copy)` },
    );
    setOpen(true);
  };

  const commit = () => {
    if (!draft) return;
    const clean: Tool = {
      ...draft,
      name: draft.name.trim() || 'Custom tool',
      brand: draft.brand?.trim() || undefined,
      series: draft.series?.trim() || undefined,
      cornerRadius_in: draft.type === 'bullEndmill' ? draft.cornerRadius_in : undefined,
    };
    saveTool(clean);
    state.adoptTool(clean.id);
    setOpen(false);
  };

  const num = (label: string, key: keyof Tool, digits = 3, step = 0.01, isLength = true) => (
    <Field label={label}>
      <NumberField
        value={isLength ? lengthToDisplay((draft![key] as number) ?? 0, sys) : ((draft![key] as number) ?? 0)}
        unit={isLength ? u : ''}
        digits={digits}
        step={step}
        onCommit={(v) =>
          setDraft((d) => d && { ...d, [key]: isLength ? lengthFromDisplay(v, sys) : v })
        }
      />
    </Field>
  );

  if (!open || !draft) {
    return (
      <button
        onClick={begin}
        className="engraved text-[10px] text-ink-3 transition-colors hover:text-ink"
      >
        ▸ {isUserTool ? 'Edit tool…' : 'Duplicate & edit…'}
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded border border-hairline bg-machined-hi/40 p-2.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">{isUserTool ? 'Edit tool' : 'New tool from current'}</span>
        <span className="font-mono text-[10px] text-ink-3">saved to your crib</span>
      </div>

      <Field label="Name">
        <input
          className="field-input"
          value={draft.name}
          aria-label="Tool name"
          onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Type">
          <Select value={draft.type} options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(v) => setDraft((d) => d && { ...d, type: v as ToolType })} />
        </Field>
        <Field label="Material">
          <Select value={draft.material} options={MATERIALS.map((m) => ({ value: m.value, label: m.label }))}
            onChange={(v) => setDraft((d) => d && { ...d, material: v as ToolMaterial })} />
        </Field>
        <Field label="Coating">
          <Select value={draft.coating} options={COATINGS.map((c) => ({ value: c.value, label: c.label }))}
            onChange={(v) => setDraft((d) => d && { ...d, coating: v as Coating })} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {num('Diameter', 'diameter_in', sys === 'metric' ? 2 : 4, 0.001)}
        <Field label="Flutes">
          <NumberField value={draft.flutes} unit="fl" digits={0} step={1}
            onCommit={(v) => setDraft((d) => d && { ...d, flutes: Math.max(1, Math.round(v)) })} />
        </Field>
        {draft.type === 'bullEndmill'
          ? num('Corner radius', 'cornerRadius_in', 4, 0.001)
          : <div />}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {num('Flute length', 'fluteLength_in')}
        {num('OAL', 'overallLength_in')}
        {num('Shank Ø', 'shankDiameter_in')}
        {num('Stickout', 'stickout_in')}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Helix (°)">
          <NumberField value={draft.helixAngle_deg ?? 30} unit="°" digits={0} step={1}
            onCommit={(v) => setDraft((d) => d && { ...d, helixAngle_deg: v })} />
        </Field>
        <Field label="Brand">
          <input className="field-input" value={draft.brand ?? ''} aria-label="Brand"
            placeholder="(for mfr data)"
            onChange={(e) => setDraft((d) => d && { ...d, brand: e.target.value })} />
        </Field>
        <Field label="Series">
          <input className="field-input" value={draft.series ?? ''} aria-label="Series"
            onChange={(e) => setDraft((d) => d && { ...d, series: e.target.value })} />
        </Field>
      </div>

      <div className="flex gap-2">
        <button onClick={commit}
          className="rounded bg-accent/20 px-3 py-1 font-display text-[11px] uppercase tracking-wider text-accent">
          Save tool
        </button>
        <button onClick={() => setOpen(false)}
          className="rounded px-3 py-1 font-display text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
