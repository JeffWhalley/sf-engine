/**
 * Phase 13b — license store: activate/persist/restore/deactivate, free-tier
 * fallback on every failure. Uses freshly generated keys (server-side API is
 * available in tests; the app itself ships only LICENSE_PUBLIC_KEYS).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { generateKeypair, signLicense, type LicensePayload } from '../../lib/licenseFile';
import { useLicenseStore, isPro } from '../useLicenseStore';

let keys: Record<string, string>;
let license: string;
const PAYLOAD: LicensePayload = {
  v: 1, email: 'jeff@example.com', tier: 'lifetime',
  issuedAt: '2026-07-03T00:00:00Z', keyId: 'k1',
};

beforeAll(async () => {
  const kp = await generateKeypair();
  keys = { k1: kp.publicKeyHex };
  license = await signLicense(PAYLOAD, kp.privateKeyHex);
});

beforeEach(() => useLicenseStore.getState().deactivate());

describe('license store', () => {
  it('starts free; activates a valid license; isPro flips', async () => {
    expect(isPro(useLicenseStore.getState())).toBe(false);
    const ok = await useLicenseStore.getState().activate(license, keys);
    expect(ok).toBe(true);
    expect(useLicenseStore.getState().status).toBe('valid');
    expect(useLicenseStore.getState().payload?.email).toBe('jeff@example.com');
    expect(isPro(useLicenseStore.getState())).toBe(true);
  });

  it('restore() re-verifies the persisted license after a "reload"', async () => {
    await useLicenseStore.getState().activate(license, keys);
    useLicenseStore.setState({ status: 'none', payload: null }); // simulate boot
    await useLicenseStore.getState().restore(keys);
    expect(useLicenseStore.getState().status).toBe('valid');
  });

  it('garbage license → invalid + friendly error + still free', async () => {
    const ok = await useLicenseStore.getState().activate('SFL1.not.real', keys);
    expect(ok).toBe(false);
    expect(useLicenseStore.getState().status).toBe('invalid');
    expect(useLicenseStore.getState().error).not.toBe('');
    expect(isPro(useLicenseStore.getState())).toBe(false);
  });

  it('license signed by an unknown key fails against shipped keys', async () => {
    const attacker = await generateKeypair();
    const forged = await signLicense(PAYLOAD, attacker.privateKeyHex);
    const ok = await useLicenseStore.getState().activate(forged, keys);
    expect(ok).toBe(false);
  });

  it('deactivate() clears persistence — restore stays free', async () => {
    await useLicenseStore.getState().activate(license, keys);
    useLicenseStore.getState().deactivate();
    await useLicenseStore.getState().restore(keys);
    expect(useLicenseStore.getState().status).toBe('none');
  });
});
