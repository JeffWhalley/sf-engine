import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  useCalcStore, buildSelection, buildDrillingSelection, buildTurningSelection, effectiveTool,
} from '../store/useCalcStore';
import {
  calculateWithLimits, calculateDrilling, calculateTurning, getMaterial, getMachine,
} from '../data';
import { resolveMachine } from '../store/useLibraryStore';
import { buildWarnings } from '../ui/warnings';
import { buildShareUrl } from '../lib/appShare';
import { useLicenseStore, isPro } from '../store/useLicenseStore';
import {
  formatResult, formatDrillingResult, formatTurningResult, lengthToDisplay, lengthUnit, fmt,
} from '../ui/format';
import type { Reading } from '../ui/format';

function SheetRow({ label, reading }: { label: string; reading: Reading }) {
  return (
    <div className="flex justify-between border-b border-neutral-200 py-1 text-[12px]">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono">
        {reading.value} <span className="text-neutral-400">{reading.unit}</span>
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 border-b-2 border-neutral-800 pb-0.5 text-[11px] font-bold uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Phase 8 T2 — printable one-page setup sheet of the current state.
 * PDF via the browser's print dialog (no server-side PDF).
 */
export function SetupSheet({ onBack }: { onBack: () => void }) {
  const state = useCalcStore();
  const pro = isPro(useLicenseStore());
  const sys = state.unitSystem;
  const u = lengthUnit(sys);
  const material = getMaterial(state.materialId)!;
  const machine = resolveMachine(state.machineId) ?? getMachine('mill-vmc-20hp')!;
  const tool = effectiveTool(state);

  const shareUrl = useMemo(
    () => buildShareUrl(state.snapshot(), `${location.origin}${location.pathname}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.materialId, state.toolId, state.machineId, state.operation, state.drill, state.turn,
     state.ae_in, state.ap_in, state.performance, state.overrides, state.unitSystem],
  );

  const [qrSvg, setQrSvg] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(shareUrl, { type: 'svg', margin: 1, width: 110 })
      .then((svg) => { if (alive) setQrSvg(svg); })
      .catch(() => { if (alive) setQrSvg(''); });
    return () => { alive = false; };
  }, [shareUrl]);

  const body = useMemo(() => {
    try {
      if (state.operation === 'drilling') {
        const r = calculateDrilling(buildDrillingSelection(state));
        const f = formatDrillingResult(r, sys);
        return {
          geometry: [
            ['Drill Ø', `${fmt(lengthToDisplay(state.drill.diameter_in, sys), 3)} ${u} (${state.drill.material.toUpperCase()})`],
            ['Hole depth', state.drill.holeDepth_in > 0 ? `${fmt(lengthToDisplay(state.drill.holeDepth_in, sys), 3)} ${u}` : 'through'],
          ] as [string, string][],
          readings: [
            ['Spindle', f.rpm], ['Feed', f.feed], ['MRR', f.mrr],
            ['Power (motor)', f.powerAtMotor], ['Torque', f.torque],
            ...(f.thrust ? [['Thrust (est. ±50%)', f.thrust] as [string, Reading]] : []),
            ...(f.peckDepth ? [['Peck depth', f.peckDepth] as [string, Reading]] : []),
          ] as [string, Reading][],
          warnings: [...r.warnings, r.peck.note],
        };
      }
      if (state.operation === 'turning') {
        const r = calculateTurning(buildTurningSelection(state));
        const f = formatTurningResult(r, sys);
        return {
          geometry: [
            ['Workpiece Ø', `${fmt(lengthToDisplay(state.turn.workpieceDiameter_in, sys), 3)} ${u}`],
            ['Pass', state.turn.op],
            ['Nose radius', `${fmt(lengthToDisplay(state.turn.noseRadius_in, sys), 4)} ${u}`],
          ] as [string, string][],
          readings: [
            ['Spindle', f.rpm], ['Feed', f.feed], ['Surface speed (achieved)', f.achievedSfm],
            ['MRR', f.mrr], ['Power (motor)', f.powerAtMotor], ['Torque', f.torque],
            ...(f.ra ? [['Theoretical finish', f.ra] as [string, Reading]] : []),
          ] as [string, Reading][],
          warnings: r.warnings,
        };
      }
      const limited = calculateWithLimits(buildSelection(state), machine);
      const f = formatResult(limited.result, sys);
      const advisories = buildWarnings(limited, { machine, tool, ap_in: state.ap_in, sys });
      return {
        geometry: [
          ['Tool', `${tool.name} — Ø${fmt(lengthToDisplay(tool.diameter_in, sys), 3)} ${u}, ${tool.flutes} fl, stickout ${fmt(lengthToDisplay(tool.stickout_in, sys), 2)} ${u}`],
          ['WOC (ae)', `${fmt(lengthToDisplay(state.ae_in, sys), 3)} ${u}`],
          ['DOC (ap)', `${fmt(lengthToDisplay(state.ap_in, sys), 3)} ${u}`],
        ] as [string, string][],
        readings: [
          ['Spindle', f.rpm], ['Feed', f.feed], ['Chip load', f.chipload], ['SFM', f.sfm],
          ['MRR', f.mrr], ['Power (motor)', f.motorPower], ['Torque', f.torque],
          ['Deflection', f.deflection],
        ] as [string, Reading][],
        warnings: advisories.map((a) => a.message),
      };
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, machine, tool, sys, u]);

  return (
    <div className="sheet mx-auto max-w-[7.5in] bg-white p-8 text-neutral-900">
      <div className="no-print mb-4 flex gap-2">
        <button onClick={onBack} className="rounded border border-neutral-300 px-3 py-1 text-[12px]">
          ← Back to calculator
        </button>
        <button onClick={() => window.print()} className="rounded border border-neutral-300 px-3 py-1 text-[12px]">
          Print / Save as PDF
        </button>
      </div>

      <header className="mb-4 flex items-start justify-between gap-4 border-b-4 border-neutral-900 pb-2">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide">Setup Sheet</h1>
          <p className="font-mono text-[11px] text-neutral-500">
            {new Date().toLocaleDateString()} · {state.operation} · Feeds &amp; Speeds
          </p>
        </div>
        {qrSvg && (
          <div
            className="h-[82px] w-[82px] shrink-0"
            aria-label="QR code of the share link"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
      </header>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <Section title="Material">
          <p className="py-1 text-[13px]">{material.name}</p>
          <p className="font-mono text-[11px] text-neutral-500">
            ISO {material.isoGroup} · unit power {material.unitPower} hp·min/in³
          </p>
        </Section>
        <Section title="Machine">
          <p className="py-1 text-[13px]">{machine.name}</p>
          <p className="font-mono text-[11px] text-neutral-500">
            {machine.maxPower_hp} hp · {machine.minRpm.toLocaleString()}–{machine.maxRpm.toLocaleString()} rpm
            {machine.taper ? ` · ${machine.taper}` : ''}
          </p>
        </Section>

        <Section title="Cut geometry">
          {body?.geometry.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-neutral-200 py-1 text-[12px]">
              <span className="text-neutral-500">{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 text-[12px]">
            <span className="text-neutral-500">Aggressiveness</span>
            <span className="font-mono">{state.performance}%</span>
          </div>
        </Section>

        <Section title="Parameters">
          {body?.readings.map(([k, r]) => <SheetRow key={k} label={k} reading={r} />)}
        </Section>
      </div>

      {body && body.warnings.length > 0 && (
        <div className="mt-4">
          <Section title="Notes & warnings">
            <ul className="list-disc pl-4 text-[11px] leading-relaxed">
              {body.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </Section>
        </div>
      )}

      <footer className="mt-6 border-t border-neutral-300 pt-2">
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Computed values are conservative starting points, not guarantees. Verify against
          manufacturer data and machine condition before cutting. Tool-life and thrust figures
          are estimates only.
        </p>
        <p className="mt-1 break-all font-mono text-[9px] text-neutral-400">{shareUrl}</p>
        {!pro && (
          <p className="mt-1 text-[10px] text-neutral-400">Made with Feeds &amp; Speeds</p>
        )}
      </footer>
    </div>
  );
}
