import { useMemo } from 'react';
import { useCalcStore, effectiveTool, buildSelection } from '../store/useCalcStore';
import { calculateWithLimits, suggestEngagement, getMachine } from '../data';
import { resolveMachine } from '../store/useLibraryStore';
import { fmt } from '../ui/format';
import type { CuttingStrategy } from '../data';
import { Field } from './Field';
import { LengthField } from './LengthField';
import { NumberField } from './NumberField';

const STRATEGIES: { id: CuttingStrategy; label: string }[] = [
  { id: 'slot', label: 'Slot' },
  { id: 'profile', label: 'Profile' },
  { id: 'hsm', label: 'HSM' },
];

export function GeometryInputs() {
  const state = useCalcStore();
  const tool = effectiveTool(state);
  const wocPct = (state.ae_in / tool.diameter_in) * 100;

  // Phase 8 T4 — MRR gain of HSM vs the profile baseline (same tool/perf, clamped).
  const hsmGain = useMemo(() => {
    if (state.strategy !== 'hsm') return null;
    try {
      const machine = resolveMachine(state.machineId) ?? getMachine('mill-vmc-20hp')!;
      const hsm = calculateWithLimits(buildSelection(state), machine).result;
      const eng = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);
      const profile = calculateWithLimits(
        { ...buildSelection(state), ae_in: eng.ae_in, ap_in: eng.ap_in, hsm: false },
        machine,
      ).result;
      if (profile.mrr_in3min <= 0) return null;
      return {
        pct: (hsm.mrr_in3min / profile.mrr_in3min - 1) * 100,
        hsmPower: hsm.motorPower_hp,
        profilePower: profile.motorPower_hp,
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.strategy, state.materialId, state.toolId, state.machineId, state.overrides,
      state.ae_in, state.ap_in, state.performance]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="engraved text-[10px]">Engagement preset</span>
        <div className="inset flex p-0.5">
          {STRATEGIES.map((s) => {
            const active = state.strategy === s.id;
            return (
              <button
                key={s.id}
                onClick={() => state.applyStrategy(s.id)}
                className={`rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider transition-colors ${
                  active ? 'bg-machined-hi text-accent' : 'text-ink-3 hover:bg-machined-hi hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {state.strategy === 'hsm' && (
        <div className="rounded bg-machined-hi/60 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-2">
          <span className="text-accent">HSM mode:</span> SFM boosted 1.5× for light radial
          engagement{hsmGain && Number.isFinite(hsmGain.pct) && (
            <> · MRR {hsmGain.pct >= 0 ? '+' : ''}{fmt(hsmGain.pct, 0)}% vs. profile at
            {' '}{fmt(hsmGain.hsmPower, 2)} hp (profile {fmt(hsmGain.profilePower, 2)} hp)</>
          )}. Requires an adaptive / trochoidal toolpath in your CAM — conventional offset
          passes will overload the tool in corners.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Width of cut" hint={`${wocPct.toFixed(0)}% Ø`}>
          <LengthField fieldId="geom.ae" value_in={state.ae_in} imperialDigits={4}
            onCommit_in={state.setAe} />
        </Field>
        <Field label="Depth of cut">
          <LengthField fieldId="geom.ap" value_in={state.ap_in} imperialDigits={4}
            onCommit_in={state.setAp} />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="engraved text-[10px]">Manual feed</span>
        <div className="flex items-center gap-2">
          {state.feedOverride_ipm != null && (
            <div className="relative w-28">
              <NumberFeed />
            </div>
          )}
          <button
            onClick={() =>
              state.setFeedOverride(state.feedOverride_ipm != null ? null : 20)
            }
            className={`rounded px-2.5 py-1 font-display text-[11px] uppercase tracking-wider transition-colors ${
              state.feedOverride_ipm != null
                ? 'bg-accent/20 text-accent'
                : 'border border-hairline text-ink-3 hover:text-ink'
            }`}
            title="Lock the feed to your own number; chip load is derived from it and Max DOC/WOC size the cut to fit"
          >
            {state.feedOverride_ipm != null ? 'Locked' : 'Off'}
          </button>
        </div>
      </div>
      {state.feedOverride_ipm != null && (
        <p className="font-mono text-[10px] leading-relaxed text-ink-3">
          Feed is yours; chip load is derived from it. Use Max DOC / Max WOC below to size the
          cut to available power, and watch the deflection & chip-load warnings.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="engraved text-[10px]">Fit to power</span>
        <button
          onClick={state.maximizeDoc}
          className="rounded border border-hairline bg-machined px-2.5 py-1 font-display text-[11px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent hover:text-ink"
          title="Solve depth of cut so spindle load ≈ available power (holds width)"
        >
          Max DOC
        </button>
        <button
          onClick={state.maximizeWoc}
          className="rounded border border-hairline bg-machined px-2.5 py-1 font-display text-[11px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent hover:text-ink"
          title="Solve width of cut so spindle load ≈ available power (holds depth)"
        >
          Max WOC
        </button>
      </div>
    </div>
  );
}

/** Manual-feed input: in/min (imperial) or mm/min (metric); canonical in/min. */
function NumberFeed() {
  const feed = useCalcStore((s) => s.feedOverride_ipm)!;
  const setFeedOverride = useCalcStore((s) => s.setFeedOverride);
  const sys = useCalcStore((s) => s.unitSystem);
  const metric = sys === 'metric';
  return (
    <NumberField
      value={metric ? feed * 25.4 : feed}
      unit={metric ? 'mm/min' : 'in/min'}
      digits={metric ? 0 : 1}
      step={metric ? 10 : 1}
      onCommit={(v) => setFeedOverride(metric ? v / 25.4 : v)}
    />
  );
}
