/**
 * Phase 11 T4 — bridge between the local library store and the sync engine.
 * Kept separate from cloudStore to avoid an import cycle:
 *   useLibraryStore ← cloudBridge ← cloudStore
 */

import { useLibraryStore } from '../store/useLibraryStore';
import type { LibraryBlob, LibraryKind } from './sync';

/** Snapshot the three library kinds as sync blobs. */
export function collectLocalBlobs(): LibraryBlob[] {
  const s = useLibraryStore.getState();
  return [
    { kind: 'tool', payload: s.userTools, updatedAt: s.modifiedAt.tool },
    { kind: 'machine', payload: s.userMachines, updatedAt: s.modifiedAt.machine },
    { kind: 'job', payload: s.jobs, updatedAt: s.modifiedAt.job },
  ];
}

/** Apply newer cloud blobs locally WITHOUT bumping modifiedAt past theirs. */
export function applyRemoteBlobs(blobs: LibraryBlob[]): void {
  for (const blob of blobs) {
    useLibraryStore.getState().adoptRemote(blob.kind, blob.payload, blob.updatedAt);
  }
}

/** Call cb with a fresh blob whenever a kind's modifiedAt changes. */
export function watchLocalChanges(cb: (blob: LibraryBlob) => void): () => void {
  let prev = useLibraryStore.getState().modifiedAt;
  return useLibraryStore.subscribe((state) => {
    const cur = state.modifiedAt;
    if (cur === prev) return;
    for (const kind of ['tool', 'machine', 'job'] as LibraryKind[]) {
      if (cur[kind] !== prev[kind]) {
        const payload =
          kind === 'tool' ? state.userTools : kind === 'machine' ? state.userMachines : state.jobs;
        cb({ kind, payload, updatedAt: cur[kind] });
      }
    }
    prev = cur;
  });
}
