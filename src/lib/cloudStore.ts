/**
 * Phase 11 T4 — cloud state + Supabase adapter. ENV-GATED: without
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ([HUMAN] creates the project,
 * keys go in Vercel env vars — never the repo) every action no-ops and the
 * app behaves exactly like today. supabase-js loads lazily so signed-out
 * users never download it.
 */

import { create } from 'zustand';
import type { Tier } from '../store/useEntitlement';
import { reconcile, createDebouncedPusher, type LibraryBlob, type SyncTransport } from './sync';

export type SyncStatus = 'off' | 'signed-out' | 'idle' | 'syncing' | 'error';

interface CloudState {
  configured: boolean;
  userEmail: string | null;
  entitlementTier: Tier | null;
  syncStatus: SyncStatus;
  lastError: string;
  /** Kinds whose local copy was replaced by newer cloud data (conflict toast). */
  overwrittenKinds: string[];

  init: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Called by the library store on every persisted change. */
  notifyChange: (blob: LibraryBlob) => void;
}

const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// Lazily created singletons
let client: import('@supabase/supabase-js').SupabaseClient | null = null;
let pusher: ReturnType<typeof createDebouncedPusher> | null = null;

async function getClient() {
  if (!url || !anonKey) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, anonKey);
  }
  return client;
}

function makeTransport(userId: string): SyncTransport {
  return {
    async pull(kind) {
      const c = await getClient();
      if (!c) return null;
      const { data, error } = await c
        .from('libraries')
        .select('payload, device_updated_at')
        .eq('user_id', userId)
        .eq('kind', kind)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return { kind, payload: data.payload, updatedAt: Number(data.device_updated_at) };
    },
    async push(blob) {
      const c = await getClient();
      if (!c) return;
      const { error } = await c.from('libraries').upsert(
        {
          user_id: userId,
          kind: blob.kind,
          payload: blob.payload,
          device_updated_at: blob.updatedAt,
        },
        { onConflict: 'user_id,kind' },
      );
      if (error) throw new Error(error.message);
    },
  };
}

export const useCloudStore = create<CloudState>((set, get) => ({
  configured: Boolean(url && anonKey),
  userEmail: null,
  entitlementTier: null,
  syncStatus: url && anonKey ? 'signed-out' : 'off',
  lastError: '',
  overwrittenKinds: [],

  init: async () => {
    const c = await getClient();
    if (!c) return;
    const { data } = await c.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    set({ userEmail: user.email ?? null, syncStatus: 'syncing' });
    try {
      const { data: ent } = await c
        .from('entitlements')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();
      const transport = makeTransport(user.id);
      pusher = createDebouncedPusher(transport);
      pusher.onPushError((e) => set({ syncStatus: 'error', lastError: String(e) }));
      // Login reconcile: local blobs come from the library store's exporter.
      const { collectLocalBlobs, applyRemoteBlobs, watchLocalChanges } = await import('./cloudBridge');
      const { applyLocally, overwrittenKinds } = await reconcile(collectLocalBlobs(), transport);
      applyRemoteBlobs(applyLocally);
      watchLocalChanges((blob) => get().notifyChange(blob));
      set({
        entitlementTier: ((ent?.tier as Tier | undefined) ?? 'free'),
        syncStatus: 'idle',
        overwrittenKinds,
      });
    } catch (e) {
      set({ syncStatus: 'error', lastError: String(e) });
    }
  },

  signInWithEmail: async (email) => {
    const c = await getClient();
    if (!c) return false;
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) {
      set({ lastError: error.message });
      return false;
    }
    return true;
  },

  signOut: async () => {
    await pusher?.flush();
    const c = await getClient();
    await c?.auth.signOut();
    pusher = null;
    set({ userEmail: null, entitlementTier: null, syncStatus: 'signed-out', overwrittenKinds: [] });
  },

  notifyChange: (blob) => {
    if (get().syncStatus === 'idle' || get().syncStatus === 'error') {
      pusher?.schedule(blob);
    }
  },
}));
