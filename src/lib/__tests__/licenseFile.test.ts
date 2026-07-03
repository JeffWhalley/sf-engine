import { describe, it, expect, beforeAll } from 'vitest';
import {
  signLicense,
  verifyLicense,
  generateKeypair,
  canonicalJson,
  LicenseError,
  type LicensePayload,
} from '../licenseFile';

let priv = '';
let pub = '';
let keys: Record<string, string> = {};

const PAYLOAD: LicensePayload = {
  v: 1,
  email: 'machinist@example.com',
  tier: 'lifetime',
  issuedAt: '2026-07-02T10:00:00Z',
  keyId: 'prod-2026',
  orderRef: 'LS-123456',
};

beforeAll(async () => {
  const kp = await generateKeypair();
  priv = kp.privateKeyHex;
  pub = kp.publicKeyHex;
  keys = { 'prod-2026': pub };
});

describe('sign → verify round trip', () => {
  it('valid license verifies and returns the payload', async () => {
    const lic = await signLicense(PAYLOAD, priv);
    expect(lic.startsWith('SFL1.')).toBe(true);
    const r = await verifyLicense(lic, keys);
    expect(r.valid).toBe(true);
    expect(r.payload).toEqual(PAYLOAD);
  });

  it('tolerates surrounding whitespace (files get copy-pasted)', async () => {
    const lic = await signLicense(PAYLOAD, priv);
    const r = await verifyLicense(`  ${lic}\n`, keys);
    expect(r.payload.email).toBe(PAYLOAD.email);
  });

  it('payload is human-readable after base64 decode (transparency)', async () => {
    const lic = await signLicense(PAYLOAD, priv);
    const mid = lic.split('.')[1]!;
    const json = Buffer.from(mid.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    expect(JSON.parse(json).email).toBe('machinist@example.com');
  });
});

describe('tamper resistance', () => {
  it('editing the payload (tier escalation) breaks verification', async () => {
    const lic = await signLicense({ ...PAYLOAD, tier: 'beta' }, priv);
    const [p, body, sig] = lic.split('.') as [string, string, string];
    const decoded = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    ) as LicensePayload;
    decoded.tier = 'lifetime'; // the attack
    const forgedBody = Buffer.from(JSON.stringify(decoded))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await expect(verifyLicense(`${p}.${forgedBody}.${sig}`, keys)).rejects.toMatchObject({
      kind: 'bad-signature',
    });
  });

  it('bit-flipped signature rejected', async () => {
    const lic = await signLicense(PAYLOAD, priv);
    // Flip a char in the MIDDLE of the signature segment: the final base64url
    // char has trailing bits that are discarded on decode, so flipping it can
    // yield the same 64 bytes (this made the original last-char flip flaky).
    const cut = lic.lastIndexOf('.') + 10;
    const flipped =
      lic.slice(0, cut) + (lic[cut] === 'A' ? 'B' : 'A') + lic.slice(cut + 1);
    await expect(verifyLicense(flipped, keys)).rejects.toBeInstanceOf(LicenseError);
  });

  it('license signed by a different (attacker) key rejected', async () => {
    const attacker = await generateKeypair();
    const forged = await signLicense(PAYLOAD, attacker.privateKeyHex);
    await expect(verifyLicense(forged, keys)).rejects.toMatchObject({
      kind: 'bad-signature',
    });
  });
});

describe('error taxonomy (drives UI messaging)', () => {
  it('garbage → malformed', async () => {
    for (const bad of ['', 'hello', 'SFL1.', 'SFL1.a.b.c.d', 'XXX.a.b']) {
      await expect(verifyLicense(bad, keys)).rejects.toMatchObject({ kind: 'malformed' });
    }
  });

  it('unknown keyId → unknown-key (rotation path)', async () => {
    const lic = await signLicense({ ...PAYLOAD, keyId: 'prod-2030' }, priv);
    await expect(verifyLicense(lic, keys)).rejects.toMatchObject({ kind: 'unknown-key' });
  });

  it('key rotation: old licenses verify via the keyId map', async () => {
    const kp2 = await generateKeypair();
    const rotated = { ...keys, 'prod-2027': kp2.publicKeyHex };
    const oldLic = await signLicense(PAYLOAD, priv); // prod-2026
    const newLic = await signLicense({ ...PAYLOAD, keyId: 'prod-2027' }, kp2.privateKeyHex);
    expect((await verifyLicense(oldLic, rotated)).payload.keyId).toBe('prod-2026');
    expect((await verifyLicense(newLic, rotated)).payload.keyId).toBe('prod-2027');
  });
});

describe('canonicalization', () => {
  it('key order does not matter; undefined fields dropped', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 }, z: undefined })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });
  it('signature covers canonical form: reordered-but-equal payload still verifies', async () => {
    const lic = await signLicense(PAYLOAD, priv);
    const [p, , sig] = lic.split('.') as [string, string, string];
    // Re-encode the SAME payload with reversed key order.
    const reordered = Object.fromEntries(Object.entries(PAYLOAD).reverse());
    const body = Buffer.from(JSON.stringify(reordered))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const r = await verifyLicense(`${p}.${body}.${sig}`, keys);
    expect(r.payload).toEqual(PAYLOAD);
  });
});
