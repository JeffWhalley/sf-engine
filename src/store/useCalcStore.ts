/**
 * Calculator state. Holds the user's selections in canonical units (inches,
 * 0..100 performance) and exposes a builder that produces a data-layer
 * MillingSelection. Components never recompute formulas — they read this state
 * and call calculate() (see App.tsx).
 */

import { create } from 'zustand';
import {
  getMaterial, getTool, getMachine, suggestEngagement, fitEngagement,
  type MillingSelection, type CuttingStrategy,
  type DrillingSelection, type TurningSelection,
  type DrillMaterial, type TurningOp,
} from '../data';
import { resolveTool, resolveMachine, type JobSnapshot } from './useLibraryStore';
import type { UnitSystem } from '../ui/format';

export type Operation = 'milling' | 'drilling' | 'turning';

export interface DrillGeometry {
  diameter_in: number;
  material: DrillMaterial;
  /** 0 = through/unknown (skips peck advice). */
  holeDepth_in: number;
}

export interface TurnGeometry {
  workpieceDiameter_in: number;
  op: TurningOp;
  noseRadius_in: number;
}

interface ToolOverrides {
  diameter_in?: number;
  flutes?: number;
  stickout_in?: number;
}

export interface CalcState {
  materialId: string;
  toolId: string;
  machineId: string;
  overrides: ToolOverrides;
  ae_in: number;
  ap_in: number;
  performance: number;
  unitSystem: UnitSystem;
  /** Phase 8 T4 — engagement preset last applied; null after manual ae/ap edits. */
  strategy: CuttingStrategy | null;
  /** Backlog — per-field display-unit overrides (field id → unit system). */
  fieldUnits: Record<string, UnitSystem>;
  /** Phase 7 T4 — active operation. Material/machine are shared across modes. */
  operation: Operation;
  drill: DrillGeometry;
  turn: TurnGeometry;

  setOperation: (op: Operation) => void;
  setDrill: (patch: Partial<DrillGeometry>) => void;
  setTurn: (patch: Partial<TurnGeometry>) => void;
  setMaterial: (id: string) => void;
  setTool: (id: string) => void;
  setMachine: (id: string) => void;
  setOverride: (patch: ToolOverrides) => void;
  setAe: (v: number) => void;
  setAp: (v: number) => void;
  setPerformance: (v: number) => void;
  setUnitSystem: (s: UnitSystem) => void;
  /** Override one field's display unit; pass the current global system to clear. */
  setFieldUnit: (fieldId: string, sys: UnitSystem) => void;
  applyStrategy: (s: CuttingStrategy) => void;
  /** Solve axial depth so motor power ≈ available power (holds WOC). */
  maximizeDoc: () => void;
  /** Solve radial width so motor power ≈ available power (holds DOC). */
  maximizeWoc: () => void;
  /** Capture the full working setup (for saving a job). */
  snapshot: () => JobSnapshot;
  /** Restore a saved setup. */
  loadSnapshot: (snap: JobSnapshot) => void;
  /** Select a tool id without disturbing the current geometry (used after saving). */
  adoptTool: (id: string) => void;
}

const DEFAULT_MATERIAL = 'al-6061';
const DEFAULT_TOOL = 'em-flat-050-4fl-carbide';
const DEFAULT_MACHINE = 'mill-vmc-20hp';

const initialEngagement = (() => {
  const tool = getTool(DEFAULT_TOOL)!;
  return suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);
})();

export const useCalcStore = create<CalcState>((set, get) => ({
  materialId: DEFAULT_MATERIAL,
  toolId: DEFAULT_TOOL,
  machineId: DEFAULT_MACHINE,
  overrides: {},
  ae_in: initialEngagement.ae_in,
  ap_in: initialEngagement.ap_in,
  performance: 50,
  unitSystem: 'imperial',
  strategy: 'profile',
  fieldUnits: {},
  operation: 'milling',
  drill: { diameter_in: 0.25, material: 'hss', holeDepth_in: 0.75 },
  turn: { workpieceDiameter_in: 2.0, op: 'rough', noseRadius_in: 1 / 32 },

  setOperation: (operation) => set({ operation }),
  setDrill: (patch) => set({ drill: { ...get().drill, ...patch } }),
  setTurn: (patch) => set({ turn: { ...get().turn, ...patch } }),

  setMaterial: (id) => set({ materialId: id }),

  setTool: (id) => {
    const tool = resolveTool(id);
    if (!tool) return;
    // new tool resets geometry overrides and re-suggests engagement for its size
    const eng = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);
    set({ toolId: id, overrides: {}, ae_in: eng.ae_in, ap_in: eng.ap_in });
  },

  setMachine: (id) => set({ machineId: id }),

  setOverride: (patch) => set({ overrides: { ...get().overrides, ...patch } }),

  setAe: (v) => set({ ae_in: v, strategy: null }),
  setAp: (v) => set({ ap_in: v, strategy: null }),
  setPerformance: (v) => set({ performance: Math.min(100, Math.max(0, v)) }),
  setUnitSystem: (s) => set({ unitSystem: s, fieldUnits: {} }), // global toggle resets per-field picks

  setFieldUnit: (fieldId, sys) =>
    set((st) => {
      const fieldUnits = { ...st.fieldUnits };
      if (sys === st.unitSystem) delete fieldUnits[fieldId];
      else fieldUnits[fieldId] = sys;
      return { fieldUnits };
    }),

  applyStrategy: (strategy) => {
    const s = get();
    const base = resolveTool(s.toolId) ?? getTool(DEFAULT_TOOL)!;
    const diameter = s.overrides.diameter_in ?? base.diameter_in;
    const eng = suggestEngagement(diameter, strategy, base.fluteLength_in);
    set({ ae_in: eng.ae_in, ap_in: eng.ap_in, strategy });
  },

  maximizeDoc: () => {
    const s = get();
    const machine = resolveMachine(s.machineId) ?? getMachine(DEFAULT_MACHINE)!;
    const { ap_in } = fitEngagement(buildSelection(s), machine, 'woc');
    set({ ap_in });
  },

  maximizeWoc: () => {
    const s = get();
    const machine = resolveMachine(s.machineId) ?? getMachine(DEFAULT_MACHINE)!;
    const { ae_in } = fitEngagement(buildSelection(s), machine, 'doc');
    set({ ae_in });
  },

  snapshot: () => {
    const s = get();
    return {
      materialId: s.materialId,
      toolId: s.toolId,
      machineId: s.machineId,
      overrides: s.overrides,
      ae_in: s.ae_in,
      ap_in: s.ap_in,
      performance: s.performance,
      unitSystem: s.unitSystem,
      operation: s.operation,
      drill: s.drill,
      turn: s.turn,
      strategy: s.strategy,
    };
  },

  loadSnapshot: (snap) =>
    set({
      materialId: snap.materialId,
      toolId: snap.toolId,
      machineId: snap.machineId,
      overrides: snap.overrides ?? {},
      ae_in: snap.ae_in,
      ap_in: snap.ap_in,
      performance: snap.performance,
      unitSystem: snap.unitSystem,
      operation: snap.operation ?? 'milling',
      strategy: snap.strategy !== undefined ? snap.strategy : null,
      drill: snap.drill ?? { diameter_in: 0.25, material: 'hss', holeDepth_in: 0.75 },
      turn: snap.turn ?? { workpieceDiameter_in: 2.0, op: 'rough', noseRadius_in: 1 / 32 },
    }),

  adoptTool: (id) => set({ toolId: id, overrides: {} }),
}));

/** Effective tool diameter/flutes/stickout after overrides. */
export function effectiveTool(state: CalcState) {
  const base = resolveTool(state.toolId) ?? getTool(DEFAULT_TOOL)!;
  return {
    ...base,
    diameter_in: state.overrides.diameter_in ?? base.diameter_in,
    flutes: state.overrides.flutes ?? base.flutes,
    stickout_in: state.overrides.stickout_in ?? base.stickout_in,
  };
}

/** Build a data-layer MillingSelection from current state. */
export function buildSelection(state: CalcState): MillingSelection {
  return {
    material: getMaterial(state.materialId)!,
    tool: effectiveTool(state),
    machine: resolveMachine(state.machineId) ?? getMachine(DEFAULT_MACHINE)!,
    ae_in: state.ae_in,
    ap_in: state.ap_in,
    performance: state.performance,
    hsm: state.strategy === 'hsm',
  };
}

/** Build a data-layer DrillingSelection from current state (Phase 7 T4). */
export function buildDrillingSelection(state: CalcState): DrillingSelection {
  return {
    material: getMaterial(state.materialId)!,
    drillDiameter_in: state.drill.diameter_in,
    drillMaterial: state.drill.material,
    holeDepth_in: state.drill.holeDepth_in > 0 ? state.drill.holeDepth_in : undefined,
    performance: state.performance,
    machine: resolveMachine(state.machineId) ?? getMachine(DEFAULT_MACHINE)!,
  };
}

/** Build a data-layer TurningSelection from current state (Phase 7 T4). */
export function buildTurningSelection(state: CalcState): TurningSelection {
  return {
    material: getMaterial(state.materialId)!,
    workpieceDiameter_in: state.turn.workpieceDiameter_in,
    op: state.turn.op,
    noseRadius_in: state.turn.noseRadius_in,
    performance: state.performance,
    machine: resolveMachine(state.machineId) ?? getMachine(DEFAULT_MACHINE)!,
  };
}
