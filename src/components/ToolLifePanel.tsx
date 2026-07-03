import { useMemo, useState } from 'react';
import { useCalcStore, effectiveTool } from '../store/useCalcStore';
import { getMaterial } from '../data';
import {
  taylorClassFor, referenceSfm, estimateForSfm, DEFAULT_ASSUMPTIONS, type ShopAssumptions,
} from '../ui/toolLifeData';
import { fmt } from '../ui/format';
import { Field } from './Field';
import { NumberField } from './NumberField';

/**
 * Phase 9 T3 — Taylor tool-life + cost-per-part panel.
 * ESTIMATE ONLY: the giant caveat below is a launch requirement — keep it.
 */
export function ToolLifePanel({ achievedSfm }: { achievedSfm: number }) {
  const state = useCalcStore();
  const material = getMaterial(state.materialId)!;
  const tool = effectiveTool(state);
  const [a, setA] = useState<ShopAssumptions>(DEFAULT_ASSUMPTIONS);
  const patch = (p: Partial<ShopAssumptions>) => setA((cur) => ({ ...cur, ...p }));

  const est = useMemo(() => {
    try {
      const toolClass =
        state.operation === 'drilling'
          ? taylorClassFor(state.drill.material)
          : state.operation === 'turning'
            ? 'carbide'
            : taylorClassFor(tool.material);
      const ref = referenceSfm(material, state.operation, tool.material, state.drill.material);
      return estimateForSfm(achievedSfm, ref, toolClass, a);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievedSfm, material, state.operation, state.drill.material, tool.material, a]);

  return (
    <div className="panel space-y-2.5 p-3.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">Tool life &amp; cost per part</span>
        <span className="rounded bg-warn/15 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-warn">
          Estimate only
        </span>
      </div>

      {est && (
        <div className="grid grid-cols-2 gap-x-4 font-mono text-[12px]">
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">Est. life in cut</span>
            <span>{fmt(est.life.lifeMin, 0)} min</span>
          </div>
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">vs. reference</span>
            <span>{fmt(est.life.lifeRatio * 100, 0)}%</span>
          </div>
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">Parts per edge</span>
            <span>{est.cost.partsPerEdge}</span>
          </div>
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">Tool $/part</span>
            <span>${fmt(est.cost.toolCostPerPart, 2)}</span>
          </div>
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">Machine $/part</span>
            <span>${fmt(est.cost.machineCostPerPart, 2)}</span>
          </div>
          <div className="flex justify-between border-b border-dotted border-hairline py-1">
            <span className="text-ink-3">Total $/part</span>
            <span className="text-accent">${fmt(est.cost.totalCostPerPart, 2)}</span>
          </div>
        </div>
      )}
      {est?.cost.warnings.map((w, i) => (
        <p key={i} className="font-mono text-[10px] text-warn">▲ {w}</p>
      ))}

      <div className="grid grid-cols-4 gap-2">
        <Field label="Tool $">
          <NumberField value={a.toolCost} unit="$" digits={0} step={1} onCommit={(v) => patch({ toolCost: v })} />
        </Field>
        <Field label="Edges">
          <NumberField value={a.edgesPerTool} unit="×" digits={0} step={1} onCommit={(v) => patch({ edgesPerTool: Math.max(1, Math.round(v)) })} />
        </Field>
        <Field label="Cut min/part">
          <NumberField value={a.cutMinutesPerPart} unit="min" digits={1} step={0.5} onCommit={(v) => patch({ cutMinutesPerPart: v })} />
        </Field>
        <Field label="Rate $/hr">
          <NumberField value={a.machineRatePerHour} unit="$/h" digits={0} step={5} onCommit={(v) => patch({ machineRatePerHour: v })} />
        </Field>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-ink-3">
        Taylor-model extrapolation from class-typical constants — real life varies enormously
        with coating, coolant, chip evacuation and machine condition. Use for comparing
        settings, never for promising tool budgets.
      </p>
    </div>
  );
}
