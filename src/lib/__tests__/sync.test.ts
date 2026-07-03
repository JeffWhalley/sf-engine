/** Phase 11 T4 — sync core: LWW merge, reconcile, debounced pusher. */
import { describe, it, expect, vi } from 'vitest';
import { mergeLastWriteWins, reconcile, createDebouncedPusher, type LibraryBlob, type SyncTransport } from '../sync';

const blob = (kind: 'tool' | 'machine' | 'job', updatedAt: number, tag = ''): LibraryBlob => ({
  kind, payload: { tag, kind }, updatedAt,
});

function memoryTransport(initial: LibraryBlob[] = []) {
  const remote = new Map(initial.map((b) => [b.kind, b]));
  const pushes: LibraryBlob[] = [];
  const t: SyncTransport = {
    pull: async (kind) => remote.get(kind) ?? null,
    push: async (b) => { remote.set(b.kind, b); pushes.push(b); },
  };
  return { t, remote, pushes };
}

describe('mergeLastWriteWins', () => {
  it('newer remote wins; newer local pushes; tie keeps local', () => {
    expect(mergeLastWriteWins(blob('tool', 5), blob('tool', 9)).action).toBe('use-remote');
    expect(mergeLastWriteWins(blob('tool', 9), blob('tool', 5)).action).toBe('push-local');
    expect(mergeLastWriteWins(blob('tool', 7), blob('tool', 7)).action).toBe('in-sync');
    expect(mergeLastWriteWins(blob('tool', 7), null).action).toBe('push-local');
  });
});

describe('reconcile (login round-trip)', () => {
  it('pushes newer locals, applies newer remotes, reports overwrites', async () => {
    const { t, pushes } = memoryTransport([
      blob('tool', 100, 'remote-newer'),
      blob('machine', 10, 'remote-older'),
      // no remote 'job'
    ]);
    const { applyLocally, overwrittenKinds } = await reconcile(
      [blob('tool', 50, 'local'), blob('machine', 60, 'local'), blob('job', 70, 'local')],
      t,
    );
    expect(overwrittenKinds).toEqual(['tool']);
    expect(applyLocally.map((b) => b.kind)).toEqual(['tool']);
    expect((applyLocally[0]!.payload as { tag: string }).tag).toBe('remote-newer');
    expect(pushes.map((b) => b.kind).sort()).toEqual(['job', 'machine']);
  });

  it('offline → login → sync preserves the library byte-identically (AC)', async () => {
    const { t } = memoryTransport([]);
    const locals = [blob('tool', 5, 'A'), blob('machine', 6, 'B'), blob('job', 7, 'C')];
    await reconcile(locals, t);
    const { applyLocally } = await reconcile(locals, t); // second login, nothing newer
    expect(applyLocally).toEqual([]); // local copy untouched
    expect(JSON.stringify((await t.pull('tool'))!.payload)).toBe(JSON.stringify(locals[0]!.payload));
  });
});

describe('createDebouncedPusher', () => {
  it('coalesces rapid edits per kind and pushes once after the delay', () => {
    vi.useFakeTimers();
    const { t, pushes } = memoryTransport();
    const p = createDebouncedPusher(t, 2000);
    p.schedule(blob('tool', 1, 'v1'));
    p.schedule(blob('tool', 2, 'v2'));
    p.schedule(blob('machine', 3, 'm1'));
    expect(p.pendingKinds().sort()).toEqual(['machine', 'tool']);
    vi.advanceTimersByTime(2100);
    expect(pushes).toHaveLength(2);
    expect((pushes.find((b) => b.kind === 'tool')!.payload as { tag: string }).tag).toBe('v2');
    vi.useRealTimers();
  });

  it('flush() pushes everything pending immediately (logout path)', async () => {
    vi.useFakeTimers();
    const { t, pushes } = memoryTransport();
    const p = createDebouncedPusher(t, 2000);
    p.schedule(blob('job', 1));
    await p.flush();
    expect(pushes).toHaveLength(1);
    expect(p.pendingKinds()).toEqual([]);
    vi.useRealTimers();
  });

  it('push errors surface through onPushError, not as crashes', async () => {
    vi.useFakeTimers();
    const failing: SyncTransport = {
      pull: async () => null,
      push: async () => { throw new Error('offline'); },
    };
    const p = createDebouncedPusher(failing, 10);
    let seen = '';
    p.onPushError((e) => { seen = String(e); });
    p.schedule(blob('tool', 1));
    await vi.advanceTimersByTimeAsync(20);
    expect(seen).toContain('offline');
    vi.useRealTimers();
  });
});
