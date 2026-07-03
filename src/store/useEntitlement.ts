/**
 * Phase 11 T5 — THE single gating point for paid features.
 *
 * Every gated feature asks this hook (or `entitlementOf` outside React) and
 * nothing else — no scattered `if (pro)` checks. Sources, in precedence
 * order:
 *   1. Offline license file (lifetime/comp/beta) — works forever, no backend.
 *   2. Cloud entitlement (Pro subscription) — cached by cloudStore once the
 *      backend exists (Phase 11 T1/T2 [HUMAN]); includes the 30-day offline
 *      grace handled server/cache-side.
 *
 * The calculator itself is NEVER gated (LAUNCH-PLAN philosophy) — gating is
 * for extras: clean setup sheets, cloud sync, unlimited libraries.
 */

import { useLicenseStore } from './useLicenseStore';
import { useCloudStore } from '../lib/cloudStore';

export type Tier = 'free' | 'pro' | 'lifetime';

export interface Entitlement {
  tier: Tier;
  /** Where the tier came from (for the account UI). */
  source: 'license-file' | 'cloud' | 'none';
  /** Convenience: anything above free. */
  paid: boolean;
}

const FREE: Entitlement = { tier: 'free', source: 'none', paid: false };

/** Pure resolver — testable without React. */
export function resolveEntitlement(
  licenseStatus: string,
  licenseTier: string | undefined,
  cloudTier: Tier | null,
): Entitlement {
  if (licenseStatus === 'valid') {
    // all license-file tiers unlock everything the web Pro tier has
    const tier: Tier = licenseTier === 'lifetime' ? 'lifetime' : 'pro';
    return { tier, source: 'license-file', paid: true };
  }
  if (cloudTier && cloudTier !== 'free') {
    return { tier: cloudTier, source: 'cloud', paid: true };
  }
  return FREE;
}

/** React hook — subscribes to both sources. */
export function useEntitlement(): Entitlement {
  const licenseStatus = useLicenseStore((s) => s.status);
  const licenseTier = useLicenseStore((s) => s.payload?.tier);
  const cloudTier = useCloudStore((s) => s.entitlementTier);
  return resolveEntitlement(licenseStatus, licenseTier, cloudTier);
}

/** Non-React accessor (setup sheet building, copy text, etc.). */
export function entitlementOf(): Entitlement {
  const lic = useLicenseStore.getState();
  const cloud = useCloudStore.getState();
  return resolveEntitlement(lic.status, lic.payload?.tier, cloud.entitlementTier);
}
