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
}

interface LibraryState extends Persisted {
  saveTool: (tool: Tool) => void;
  deleteTool: (id: string) => void;
  saveMachine: (machine: Machine) => void;
  deleteMachine: (id: string) => void;
  saveJob: (name: string, snapshot: JobSnapshot) => string;
  deleteJob: (id: string) => void;
  exportJSON: () => string;
  importJSON: (json: string) => { ok: boolean; error?: string };
  clearAll: () => void;
}

const KEY = 'library';

function load(): Persisted {
  return storage.getJSON<Persisted>(KEY, { userTools: [], userMachines: [], jobs: [] });
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
      persist({ userTools, userMachines: s.userMachines, jobs: s.jobs });
      return { userTools };
    }),

  deleteTool: (id) =>
    set((s) => {
      const userTools = s.userTools.filter((t) => t.id !== id);
      persist({ userTools, userMachines: s.userMachines, jobs: s.jobs });
      return { userTools };
    }),

  saveMachine: (machine) =>
    set((s) => {
      const userMachines = [...s.userMachines.filter((m) => m.id !== machine.id), machine];
      persist({ userTools: s.userTools, userMachines, jobs: s.jobs });
      return { userMachines };
    }),

  deleteMachine: (id) =>
    set((s) => {
      const userMachines = s.userMachines.filter((m) => m.id !== id);
      persist({ userTools: s.userTools, userMachines, jobs: s.jobs });
      return { userMachines };
    }),

  saveJob: (name, snapshot) => {
    const job: Job = { id: uid('job'), name: name.trim() || 'Untitled', savedAt: Date.now(), snapshot };
    set((s) => {
      const jobs = [...s.jobs, job];
      persist({ userTools: s.userTools, userMachines: s.userMachines, jobs });
      return { jobs };
    });
    return job.id;
  },

  deleteJob: (id) =>
    set((s) => {
      const jobs = s.jobs.filter((j) => j.id !== id);
      persist({ userTools: s.userTools, userMachines: s.userMachines, jobs });
      return { jobs };
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
      persist({ userTools, userMachines, jobs });
      set({ userTools, userMachines, jobs });
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
