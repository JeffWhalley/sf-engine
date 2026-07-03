import { beforeEach, describe, it, expect } from 'vitest';
import { useLibraryStore, resolveTool, isPersistent } from '../useLibraryStore';
import { useCalcStore } from '../useCalcStore';
import { getTool } from '../../data';

beforeEach(() => {
  useLibraryStore.getState().clearAll();
});

describe('storage fallback', () => {
  it('runs in-memory (non-persistent) under the test runner (no window)', () => {
    expect(isPersistent()).toBe(false);
  });
});

describe('jobs: save / load / delete', () => {
  it('round-trips a full setup snapshot', () => {
    const snap = useCalcStore.getState().snapshot();
    const id = useLibraryStore.getState().saveJob('Roughing 6061', snap);
    expect(useLibraryStore.getState().jobs.map((j) => j.name)).toContain('Roughing 6061');

    // change working state, then restore from the saved job
    useCalcStore.getState().setPerformance((snap.performance + 20) % 100);
    const job = useLibraryStore.getState().jobs.find((j) => j.id === id)!;
    useCalcStore.getState().loadSnapshot(job.snapshot);
    expect(useCalcStore.getState().performance).toBe(snap.performance);
    expect(useCalcStore.getState().materialId).toBe(snap.materialId);

    useLibraryStore.getState().deleteJob(id);
    expect(useLibraryStore.getState().jobs).toHaveLength(0);
  });
});

describe('user tools: save / resolve / delete', () => {
  it('saves a user tool that resolveTool can find alongside seed tools', () => {
    const base = getTool('em-flat-050-4fl-carbide')!;
    useLibraryStore.getState().saveTool({ ...base, id: 'user-tool:test1', name: 'Shop 1/2 EM' });

    expect(resolveTool('user-tool:test1')?.name).toBe('Shop 1/2 EM');
    expect(resolveTool('em-flat-050-4fl-carbide')?.name).toBe(base.name); // seed still works

    useLibraryStore.getState().deleteTool('user-tool:test1');
    expect(resolveTool('user-tool:test1')).toBeUndefined();
  });

  it('adoptTool selects a tool without disturbing geometry', () => {
    const base = getTool('em-flat-050-4fl-carbide')!;
    useLibraryStore.getState().saveTool({ ...base, id: 'user-tool:g', name: 'G' });
    useCalcStore.getState().setAe(0.037);
    useCalcStore.getState().adoptTool('user-tool:g');
    expect(useCalcStore.getState().toolId).toBe('user-tool:g');
    expect(useCalcStore.getState().ae_in).toBe(0.037); // geometry preserved
    expect(useCalcStore.getState().overrides).toEqual({});
  });
});

describe('export / import', () => {
  it('reproduces the library after clear', () => {
    const base = getTool('em-flat-050-4fl-carbide')!;
    useLibraryStore.getState().saveTool({ ...base, id: 'user-tool:x', name: 'X' });
    useLibraryStore.getState().saveJob('J', useCalcStore.getState().snapshot());

    const json = useLibraryStore.getState().exportJSON();
    useLibraryStore.getState().clearAll();
    expect(useLibraryStore.getState().jobs).toHaveLength(0);

    const res = useLibraryStore.getState().importJSON(json);
    expect(res.ok).toBe(true);
    expect(useLibraryStore.getState().userTools.map((t) => t.id)).toContain('user-tool:x');
    expect(useLibraryStore.getState().jobs.map((j) => j.name)).toContain('J');
  });

  it('rejects malformed JSON without throwing', () => {
    const res = useLibraryStore.getState().importJSON('{ not valid');
    expect(res.ok).toBe(false);
  });
});
