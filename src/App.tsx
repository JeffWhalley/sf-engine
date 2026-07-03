import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCalcStore, buildSelection, buildDrillingSelection, buildTurningSelection, effectiveTool } from './store/useCalcStore';
import { resolveMachine } from './store/useLibraryStore';
import { useLicenseStore } from './store/useLicenseStore';
import { calculateWithLimits, calculateDrilling, calculateTurning, activeMfrOverride, getMachine, type LimitedResult } from './data';
import type { DrillingResult, TurningResult } from './engine';
import { buildWarnings } from './ui/warnings';
import { parseAppHash, buildShareUrl, type AppRoute } from './lib/appShare';
import { SetupSheet } from './components/SetupSheet';
import { SweepChart } from './components/SweepChart';
import { ToolLifePanel } from './components/ToolLifePanel';
import { MachineCurveChart } from './components/MachineCurveChart';
import { UpdateToast } from './components/UpdateToast';
import { millingCopyText, drillingCopyText, turningCopyText } from './ui/copyText';
import { getMaterial } from './data';
import { DisclaimerBanner, UnitToggle } from './components/DisclaimerBanner';
import { MaterialSelect } from './components/MaterialSelect';
import { ToolPanel } from './components/ToolPanel';
import { MachineSelect } from './components/MachineSelect';
import { GeometryInputs } from './components/GeometryInputs';
import { PerformanceSlider } from './components/PerformanceSlider';
import { LibraryPanel } from './components/LibraryPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { OperationSelect } from './components/OperationSelect';
import { DrillingInputs } from './components/DrillingInputs';
import { TurningInputs } from './components/TurningInputs';
import { DrillingResults } from './components/DrillingResults';
import { TurningResults } from './components/TurningResults';

function Panel({ children }: { children: ReactNode }) {
  return <div className="panel space-y-3 p-3.5">{children}</div>;
}

export default function App() {
  const state = useCalcStore();

  // Phase 8 — hash routing + shared-state deep links (#v1.… / #sheet.v1.…)
  const [route, setRoute] = useState<AppRoute>('app');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void useLicenseStore.getState().restore();
    const apply = () => {
      const parsed = parseAppHash(location.hash);
      if (parsed.snapshot) useCalcStore.getState().loadSnapshot(parsed.snapshot);
      setRoute(parsed.route);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const [copiedResults, setCopiedResults] = useState(false);
  const copyResults = () => {
    const s2 = useCalcStore.getState();
    const material = getMaterial(s2.materialId)!;
    const url = buildShareUrl(s2.snapshot(), `${location.origin}${location.pathname}`);
    let text: string | null = null;
    if (s2.operation === 'milling' && limited) {
      text = millingCopyText({
        limited, material, tool, machine,
        ae_in: s2.ae_in, ap_in: s2.ap_in, performance: s2.performance,
        sys: s2.unitSystem, shareUrl: url,
      });
    } else if (s2.operation === 'drilling' && drillResult) {
      text = drillingCopyText({
        result: drillResult, material, drillDiameter_in: s2.drill.diameter_in,
        drillMaterial: s2.drill.material, machine, sys: s2.unitSystem, shareUrl: url,
      });
    } else if (s2.operation === 'turning' && turnResult) {
      text = turningCopyText({
        result: turnResult, material, workpieceDiameter_in: s2.turn.workpieceDiameter_in,
        op: s2.turn.op, machine, sys: s2.unitSystem, shareUrl: url,
      });
    }
    if (!text) return;
    const done = () => { setCopiedResults(true); setTimeout(() => setCopiedResults(false), 1500); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  };

  const copyShareLink = () => {
    const url = buildShareUrl(useCalcStore.getState().snapshot(), `${location.origin}${location.pathname}`);
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, done);
    else done();
  };
  // resolveMachine knows user-library machines too; getMachine only knows seeds.
  const machine = resolveMachine(state.machineId) ?? getMachine('mill-vmc-20hp')!;
  const selection = useMemo(
    () => buildSelection(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.materialId,
      state.toolId,
      state.machineId,
      state.overrides,
      state.ae_in,
      state.ap_in,
      state.performance,
      state.strategy, // hsm flag lives on the selection
      state.feedOverride_ipm, // manual feed lock
    ],
  );

  const lastGood = useRef<LimitedResult | null>(null);
  const limited = useMemo(() => {
    try {
      const l = calculateWithLimits(selection, machine);
      lastGood.current = l;
      return l;
    } catch {
      return lastGood.current;
    }
  }, [selection, machine]);

  const lastDrill = useRef<DrillingResult | null>(null);
  const drillResult = useMemo(() => {
    if (state.operation !== 'drilling') return null;
    try {
      const r = calculateDrilling(buildDrillingSelection(state));
      lastDrill.current = r;
      return r;
    } catch {
      return lastDrill.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.operation, state.materialId, state.machineId, state.drill, state.performance]);

  const lastTurn = useRef<TurningResult | null>(null);
  const turnResult = useMemo(() => {
    if (state.operation !== 'turning') return null;
    try {
      const r = calculateTurning(buildTurningSelection(state));
      lastTurn.current = r;
      return r;
    } catch {
      return lastTurn.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.operation, state.materialId, state.machineId, state.turn, state.performance]);

  const tool = effectiveTool(state);
  const warnings = useMemo(
    () =>
      limited
        ? buildWarnings(limited, { machine, tool, ap_in: state.ap_in, sys: state.unitSystem })
        : [],
    [limited, machine, tool, state.ap_in, state.unitSystem],
  );

  if (route === 'sheet') {
    return (
      <SetupSheet
        onBack={() => {
          location.hash = '';
          setRoute('app');
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <UpdateToast />
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-sm bg-accent" />
            <h1 className="font-display text-2xl font-bold uppercase tracking-[0.12em] text-ink">
              Feeds &amp; Speeds
            </h1>
          </div>
          <p className="mt-0.5 pl-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3">
            Milling console
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OperationSelect />
          <UnitToggle />
          <div className="inset flex p-0.5">
            <button
              onClick={copyShareLink}
              className="rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider text-ink-3 transition-colors hover:bg-machined-hi hover:text-ink"
              title="Copy a link that reproduces this exact setup"
            >
              {copied ? 'Copied ✓' : 'Share'}
            </button>
            <button
              onClick={copyResults}
              className="rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider text-ink-3 transition-colors hover:bg-machined-hi hover:text-ink"
              title="Copy the current numbers as plain text"
            >
              {copiedResults ? 'Copied ✓' : 'Copy'}
            </button>
            <button
              onClick={() => { location.hash = 'sheet'; }}
              className="rounded px-2.5 py-1 font-display text-[12px] uppercase tracking-wider text-ink-3 transition-colors hover:bg-machined-hi hover:text-ink"
              title="Printable one-page setup sheet"
            >
              Sheet
            </button>
          </div>
        </div>
      </header>

      <DisclaimerBanner />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-4">
          <Panel>
            <MaterialSelect />
            {state.operation === 'milling' && (
              <div className="border-t border-hairline pt-3">
                <ToolPanel />
              </div>
            )}
          </Panel>
          <Panel>
            <MachineSelect />
          </Panel>
          <Panel>
            {state.operation === 'milling' && <GeometryInputs />}
            {state.operation === 'drilling' && <DrillingInputs />}
            {state.operation === 'turning' && <TurningInputs />}
            <div className="border-t border-hairline pt-3">
              <PerformanceSlider />
            </div>
          </Panel>
          <Panel>
            <LibraryPanel />
          </Panel>
        </div>

        {/* Results */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex items-center gap-2">
            <span className="engraved text-[11px]">Recommended</span>
            <span className="h-px flex-1 bg-hairline" />
            {state.operation === 'milling' && activeMfrOverride(selection) && (
              <span
                className="rounded bg-ok/15 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-ok"
                title="Speeds & feeds come from this manufacturer's table, not generic seed data"
              >
                Using {tool.brand} data
              </span>
            )}
          </div>
          {state.operation === 'milling' && limited && (
            <ResultsPanel
              limited={limited}
              machine={machine}
              tool={tool}
              ae_in={state.ae_in}
              sys={state.unitSystem}
              warnings={warnings}
            />
          )}
          {state.operation === 'drilling' && drillResult && (
            <DrillingResults result={drillResult} sys={state.unitSystem} />
          )}
          {state.operation === 'turning' && turnResult && (
            <TurningResults result={turnResult} sys={state.unitSystem} />
          )}

          <div className="mt-4 space-y-4">
            {state.operation === 'milling' && <SweepChart />}
            {state.operation === 'milling' && limited && (
              <MachineCurveChart rpm={limited.result.rpm} motorHp={limited.result.motorPower_hp} />
            )}
            {state.operation === 'milling' && limited && (
              <ToolLifePanel achievedSfm={limited.result.sfm} />
            )}
            {state.operation === 'drilling' && drillResult && (
              <ToolLifePanel
                achievedSfm={(drillResult.rpm * Math.PI * state.drill.diameter_in) / 12}
              />
            )}
            {state.operation === 'turning' && turnResult && (
              <ToolLifePanel achievedSfm={turnResult.achievedSfm} />
            )}
          </div>
        </div>
      </div>

      <footer className="mt-8 border-t border-hairline pt-3 font-mono text-[10px] leading-relaxed text-ink-3">
        Speed and feed are clamped to the selected machine's limits; the readout shows the
        achievable values (with the requested value beneath when capped). Seed data are
        conservative starting points — verify against manufacturer data.
      </footer>
    </div>
  );
}
