/**
 * Phase 13b — license state. Persists the raw SFL1 string; re-verifies at
 * boot (async). Free tier is the fallback for every failure mode.
 */

import { create } from 'zustand';
import { verifyLicense, LicenseError, type LicensePayload } from '../lib/licenseFile';
import { LICENSE_PUBLIC_KEYS } from '../lib/licenseKeys';
import { storage } from '../lib/storage';

const KEY = 'sf.license.v1';

export type LicenseStatus = 'none' | 'checking' | 'valid' | 'invalid';

interface LicenseState {
  status: LicenseStatus;
  payload: LicensePayload | null;
  /** User-facing message for the last failure ('' when none). */
  error: string;
  /** Verify + persist a pasted license. Returns success. */
  activate: (license: string, keys?: Record<string, string>) => Promise<boolean>;
  /** Drop back to the free tier. */
  deactivate: () => void;
  /** Re-verify whatever is persisted (called at boot). */
  restore: (keys?: Record<string, string>) => Promise<void>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: 'none',
  payload: null,
  error: '',

  activate: async (license, keys = LICENSE_PUBLIC_KEYS) => {
    set({ status: 'checking', error: '' });
    try {
      const { payload } = await verifyLicense(license, keys);
      storage.setJSON(KEY, license.trim());
      set({ status: 'valid', payload, error: '' });
      return true;
    } catch (e) {
      set({
        status: 'invalid',
        payload: null,
        error: e instanceof LicenseError ? e.message : 'Could not verify this license.',
      });
      return false;
    }
  },

  deactivate: () => {
    storage.remove(KEY);
    set({ status: 'none', payload: null, error: '' });
  },

  restore: async (keys = LICENSE_PUBLIC_KEYS) => {
    const saved = storage.getJSON<string | null>(KEY, null);
    if (!saved) return;
    set({ status: 'checking' });
    try {
      const { payload } = await verifyLicense(saved, keys);
      set({ status: 'valid', payload });
    } catch {
      // stale/foreign license: keep it stored but run free
      set({ status: 'invalid', payload: null, error: '' });
    }
  },
}));

/** Pro = any currently-valid license (all tiers unlock the web Pro bits). */
export function isPro(state: Pick<LicenseState, 'status'>): boolean {
  return state.status === 'valid';
}
