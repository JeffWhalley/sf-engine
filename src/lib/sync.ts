/**
 * Phase 11 T4 — library sync core. PURE: no Supabase, no React, no globals —
 * the transport is injected, so every branch is unit-testable.
 *
 * Model (LAUNCH-PLAN T3): the sync unit is the whole library blob per kind
 * ('tool' | 'machine' | 'job'); conflict resolution is last-write-wins on a
 * millisecond timestamp, with the loser surfaced so the UI can toast it.
 */

export type LibraryKind = 'tool' | 'machine' | 'job';

export interface LibraryBlob {
  kind: LibraryKind;
  /** Opaque JSON payload (the store's export for that kind). */
  payload: unknown;
  /** Client-side last-modified, ms epoch. */
  updatedAt: number;
}

export interface SyncTransport {
  /** Fetch the remote blob for a kind, or null when none exists. */
  pull(kind: LibraryKind): Promise<LibraryBlob | null>;
  /** Overwrite the remote blob. */
  push(blob: LibraryBlob): Promise<void>;
}

export type MergeOutcome =
  | { action: 'use-remote'; blob: LibraryBlob }
  | { action: 'push-local'; blob: LibraryBlob }
  | { action: 'in-sync'; blob: LibraryBlob };

/** Last-write-wins on updatedAt; ties keep local (no churn). */
export function mergeLastWriteWins(local: LibraryBlob, remote: LibraryBlob | null): MergeOutcome {
  if (remote === null) return { action: 'push-local', blob: local };
  if (remote.updatedAt > local.updatedAt) return { action: 'use-remote', blob: remote };
  if (remote.updatedAt < local.updatedAt) return { action: 'push-local', blob: local };
  return { action: 'in-sync', blob: local };
}

/**
 * Login-time reconcile: pull each kind, decide, push where local wins.
 * Returns what the caller must apply locally + which kinds were overwritten
 * locally (for the conflict toast).
 */
export async function reconcile(
  locals: LibraryBlob[],
  transport: SyncTransport,
): Promise<{ applyLocally: LibraryBlob[]; overwrittenKinds: LibraryKind[] }> {
  const applyLocally: LibraryBlob[] = [];
  const overwrittenKinds: LibraryKind[] = [];
  for (const local of locals) {
    const remote = await transport.pull(local.kind);
    const outcome = mergeLastWriteWins(local, remote);
    if (outcome.action === 'use-remote') {
      applyLocally.push(outcome.blob);
      overwrittenKinds.push(local.kind);
    } else if (outcome.action === 'push-local') {
      await transport.push(outcome.blob);
    }
  }
  return { applyLocally, overwrittenKinds };
}

/**
 * Debounced pusher for on-change sync (2s per LAUNCH-PLAN). Injectable
 * timers so tests don't sleep. Coalesces per kind; flush() forces all.
 */
export function createDebouncedPusher(
  transport: SyncTransport,
  delayMs = 2000,
  timers: { set: typeof setTimeout; clear: typeof clearTimeout } = {
    set: setTimeout,
    clear: clearTimeout,
  },
) {
  const pending = new Map<LibraryKind, { blob: LibraryBlob; handle: ReturnType<typeof setTimeout> }>();
  let onError: ((e: unknown) => void) | null = null;

  const fire = (kind: LibraryKind) => {
    const entry = pending.get(kind);
    if (!entry) return;
    pending.delete(kind);
    void transport.push(entry.blob).catch((e) => onError?.(e));
  };

  return {
    /** Queue (or re-queue) a blob; the newest one per kind wins. */
    schedule(blob: LibraryBlob): void {
      const existing = pending.get(blob.kind);
      if (existing) timers.clear(existing.handle);
      pending.set(blob.kind, {
        blob,
        handle: timers.set(() => fire(blob.kind), delayMs),
      });
    },
    /** Push everything queued right now (logout, page hide). */
    async flush(): Promise<void> {
      const kinds = [...pending.keys()];
      for (const kind of kinds) {
        const entry = pending.get(kind)!;
        timers.clear(entry.handle);
        pending.delete(kind);
        await transport.push(entry.blob).catch((e) => onError?.(e));
      }
    },
    pendingKinds(): LibraryKind[] {
      return [...pending.keys()];
    },
    onPushError(cb: (e: unknown) => void): void {
      onError = cb;
    },
  };
}
