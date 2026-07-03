import { TOOLS } from '../data';
import { useCalcStore, effectiveTool } from '../store/useCalcStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { Field, Select, type Option } from './Field';
import { NumberField } from './NumberField';
import { ToolEditor } from './ToolEditor';
import { LengthField } from './LengthField';
import { lengthToDisplay, lengthUnit } from '../ui/format';

const TYPE_LABEL: Record<string, string> = {
  flatEndmill: 'Flat',
  ballEndmill: 'Ball',
  bullEndmill: 'Bull',
  drill: 'Drill',
  faceMill: 'Face',
  highFeedMill: 'High-feed',
  chamfer: 'Chamfer',
  reamer: 'Reamer',
  tap: 'Tap',
};

export function ToolPanel() {
  const state = useCalcStore();
  const userTools = useLibraryStore((s) => s.userTools);
  const tool = effectiveTool(state);
  const sys = state.unitSystem;
  const u = lengthUnit(sys);

  const options: Option[] = [
    ...TOOLS.map((t) => ({ value: t.id, label: t.name })),
    ...userTools.map((t) => ({ value: t.id, label: `★ ${t.name}` })),
  ];

  return (
    <div className="space-y-2.5">
      <Field label="Tool" hint={`${TYPE_LABEL[tool.type] ?? tool.type} · ${tool.coating}`}>
        <Select value={state.toolId} options={options} onChange={state.setTool} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Diameter">
          <LengthField fieldId="tool.d" value_in={tool.diameter_in} imperialDigits={4}
            onCommit_in={(v) => state.setOverride({ diameter_in: v })} />
        </Field>
        <Field label="Flutes">
          <NumberField
            value={tool.flutes}
            unit="fl"
            digits={0}
            step={1}
            onCommit={(v) => state.setOverride({ flutes: Math.max(1, Math.round(v)) })}
          />
        </Field>
        <Field label="Stickout">
          <LengthField fieldId="tool.stickout" value_in={tool.stickout_in} metricDigits={1}
            onCommit_in={(v) => state.setOverride({ stickout_in: v })} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-3">
        <span>LOC {lengthToDisplay(tool.fluteLength_in, sys).toFixed(sys === 'metric' ? 1 : 3)} {u}</span>
        <span>{tool.material}</span>
        {tool.cornerRadius_in != null && (
          <span>rad {lengthToDisplay(tool.cornerRadius_in, sys).toFixed(sys === 'metric' ? 2 : 4)} {u}</span>
        )}
        {tool.helixAngle_deg != null && <span>{tool.helixAngle_deg}° helix</span>}
      </div>

      <ToolEditor />
    </div>
  );
}
