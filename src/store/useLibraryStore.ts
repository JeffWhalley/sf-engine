/**
 * Library store (Phase 6). Holds user-saved tools, machines, and named jobs,
 * persisted via the storage wrapper. Also provides resolution helpers that let
 * the calc store find user items by id alongside the built-in seed data.
 *
 * Import direction: this store depends on `../data` only — NOT on the calc
 * store — so there's no import cycle. The calc store imports from here.
 */

import { create } from 'zustand';
import { TOOLS, MACHINES, getTool, getMachine, type Tool, type Machine } from '../data';
import { storage, isPersistent } from '../lib/storage';

/** Full snapshot of a working setup — everything needed to restore it. */
export interface JobSnapshot {
  materialId: string;
  toolId: string;
  machineId: string;
  overrides: { diameter_in?: number; flutes?: number; stickout_in?: number };
  ae_in: number;
  ap_in: number;
  performance: number;
  unitSystem: 'imperial' | 'metric';
  /** Phase 7 T4 — operation mode + per-mode geometry (older jobs omit these). */
  operation?: 'milling' | 'drilling' | 'turning';
  drill?: { diameter_in: number; material: 'hss' | 'carbide'; holeDepth_in: number };
  turn?: { workpieceDiameter_in: number; op: 'rough' | 'finish'; noseRadius_in: number };
  /** Phase 8 T4 — engagement preset in effect (null = manually edited). */
  strategy?: 'slot' | 'profile' | 'hsm' | null;
  /** Manual feed lock, in/min (null/absent = automatic). */
  feedOverride_ipm?: number | null;
  /** Solve RPM for chip load under the feed lock. */
  holdChipload?: boolean;
}

export interface Job {
  id: string;
  name: string;
  savedAt: number;
  snapshot: JobSnapshot;
}

interface Persisted {
  userTools: Tool[];
  userMachines: Machine[];
  jobs: Job[];
  /** Per-kind last-modified (ms) — drives cloud sync last-write-wins. */
  modifiedAt?: { tool: number; machine: number; job: number };
}

interface LibraryState extends Persisted {
  /** Required at runtime (Persisted keeps it optional for old saved data). */
  modifiedAt: { tool: number; machine: number; job: number };
  saveTool: (tool: Tool) => void;
  deleteTool: (id: string) => void;
  saveMachine: (machine: Machine) => void;
  deleteMachine: (id: string) => void;
  saveJob: (name: string, snapshot: JobSnapshot) => string;
  deleteJob: (id: string) => void;
  exportJSON: () => string;
  importJSON: (json: string) => { ok: boolean; error?: string };
  clearAll: () => void;
  /** Cloud sync: replace one kind's data with a newer remote copy. */
  adoptRemote: (kind: 'tool' | 'machine' | 'job', payload: unknown, updatedAt: number) => void;
}

const KEY = 'library';

function load(): Required<Persisted> {
  const p = storage.getJSON<Persisted>(KEY, { userTools: [], userMachines: [], jobs: [] });
  return { ...p, modifiedAt: p.modifiedAt ?? { tool: 0, machine: 0, job: 0 } };
}
function persist(p: Persisted): void {
  storage.setJSON(KEY, p);
}

let seq = 0;
export function uid(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ...load(),

  saveTool: (tool) =>
    set((s) => {
      const userTools = [...s.userTools.filter((t) => t.id !== tool.id), tool];
      const modifiedAt = { ...s.modifiedAt, tool: Date.now() };
      persist({ userTools, userMachines: s.userMachines, jobs: s.jobs, modifiedAt });
      return { userTools, modifiedAt };
    }),

  deleteTool: (id) =>
    set((s) => {
      const userTools = s.userTools.filter((t) => t.id !== id);
      const modifiedAt = { ...s.modifiedAt, tool: Date.now() };
      persist({ userTools, userMachines: s.userMachines, jobs: s.jobs, modifiedAt });
      return { userTools, modifiedAt };
    }),

  saveMachine: (machine) =>
    set((s) => {
      const userMachines = [...s.userMachines.filter((m) => m.id !== machine.id), machine];
      const modifiedAt = { ...s.modifiedAt, machine: Date.now() };
      persist({ userTools: s.userTools, userMachines, jobs: s.jobs, modifiedAt });
      return { userMachines, modifiedAt };
    }),

  deleteMachine: (id) =>
    set((s) => {
      const userMachines = s.userMachines.filter((m) => m.id !== id);
      const modifiedAt = { ...s.modifiedAt, machine: Date.now() };
      persist({ userTools: s.userTools, userMachines, jobs: s.jobs, modifiedAt });
      return { userMachines, modifiedAt };
    }),

  saveJob: (name, snapshot) => {
    const job: Job = { id: uid('job'), name: name.trim() || 'Untitled', savedAt: Date.now(), snapshot };
    set((s) => {
      const jobs = [...s.jobs, job];
      const modifiedAt = { ...s.modifiedAt, job: Date.now() };
      persist({ userTools: s.userTools, userMachines: s.userMachines, jobs, modifiedAt });
      return { jobs, modifiedAt };
    });
    return job.id;
  },

  deleteJob: (id) =>
    set((s) => {
      const jobs = s.jobs.filter((j) => j.id !== id);
      const modifiedAt = { ...s.modifiedAt, job: Date.now() };
      persist({ userTools: s.userTools, userMachines: s.userMachines, jobs, modifiedAt });
      return { jobs, modifiedAt };
    }),

  /** Cloud sync (Phase 11): apply a newer remote blob without re-bumping time. */
  adoptRemote: (kind, payload, updatedAt) =>
    set((s) => {
      const modifiedAt = { ...s.modifiedAt, [kind]: updatedAt };
      const patch =
        kind === 'tool'
          ? { userTools: payload as Tool[] }
          : kind === 'machine'
            ? { userMachines: payload as Machine[] }
            : { jobs: payload as Job[] };
      const next = { userTools: s.userTools, userMachines: s.userMachines, jobs: s.jobs, ...patch, modifiedAt };
      persist(next);
      return { ...patch, modifiedAt };
    }),

  exportJSON: () => {
    const { userTools, userMachines, jobs } = get();
    return JSON.stringify({ version: 1, userTools, userMachines, jobs }, null, 2);
  },

  importJSON: (json) => {
    try {
      const data = JSON.parse(json) as Partial<Persisted>;
      const userTools = Array.isArray(data.userTools) ? data.userTools : [];
      const userMachines = Array.isArray(data.userMachines) ? data.userMachines : [];
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      const now = Date.now();
      const modifiedAt = { tool: now, machine: now, job: now };
      persist({ userTools, userMachines, jobs, modifiedAt });
      set({ userTools, userMachines, jobs, modifiedAt });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not parse JSON.' };
    }
  },

  clearAll: () => {
    persist({ userTools: [], userMachines: [], jobs: [] });
    set({ userTools: [], userMachines: [], jobs: [] });
  },
}));

// --- resolution helpers (seed data first, then user library) ---

export function resolveTool(id: string): Tool | undefined {
  return getTool(id) ?? useLibraryStore.getState().userTools.find((t) => t.id === id);
}

export function resolveMachine(id: string): Machine | undefined {
  return getMachine(id) ?? useLibraryStore.getState().userMachines.find((m) => m.id === id);
}

export function combinedTools(userTools: Tool[]): Tool[] {
  return [...TOOLS, ...userTools];
}
export function combinedMachines(userMachines: Machine[]): Machine[] {
  return [...MACHINES, ...userMachines];
}

export { isPersistent };
