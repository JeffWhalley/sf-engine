/**
 * Offline license file — Phase 13b, T1 (LAUNCH-PLAN.md §4).
 *
 * Format:  SFL1.<base64url(canonical-JSON payload)>.<base64url(Ed25519 sig)>
 *
 * Design goals (per plan):
 *   - Verification is FULLY OFFLINE, forever: the app ships only the PUBLIC
 *     key; a lifetime license never phones home.
 *   - Deter honest people only — no DRM arms race (plan §Phase 13b T1).
 *   - Payload is human-readable after base64 decode (machinists can see
 *     exactly what the file says about them — trust through transparency).
 *
 * Key handling **[HUMAN]**:
 *   - Generate ONE production keypair with `generateKeypair()` (script below).
 *   - PRIVATE key lives ONLY in the purchase-webhook secret store (Phase 12
 *     Edge Function). Never in the repo, never in the app bundle.
 *   - `keyId` in the payload names which public key signed it, so keys can
 *     be rotated (app ships a map of keyId → publicKey; old licenses keep
 *     verifying against their original key).
 *
 * Canonicalization: JSON with recursively sorted keys. The SIGNED BYTES are
 * the canonical JSON — verify() re-canonicalizes the decoded payload and
 * checks the signature over that, so field order in the file can't matter.
 *
 * Uses @noble/ed25519 + @noble/hashes (audited, tiny, browser+node).
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

// noble-ed25519 v2 needs a sha512 provider wired once:
ed.hashes.sha512 = sha512;

const PREFIX = 'SFL1';

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export type LicenseTier = 'lifetime' | 'pro-comp' | 'beta';

export interface LicensePayload {
  v: 1;
  /** Purchaser email (what the license is "made out to"). */
  email: string;
  tier: LicenseTier;
  /** ISO 8601 issue timestamp. */
  issuedAt: string;
  /** Names the signing key (rotation support). */
  keyId: string;
  /** Order/receipt reference from the merchant of record. */
  orderRef?: string;
}

export class LicenseError extends Error {
  constructor(
    message: string,
    public readonly kind: 'malformed' | 'bad-signature' | 'unknown-key' | 'unsupported-version',
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** JSON.stringify with recursively sorted object keys (stable signing bytes). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const inner = (v as Record<string, unknown>)[k];
      if (inner !== undefined) out[k] = sortValue(inner);
    }
    return out;
  }
  return v;
}

const utf8 = {
  enc: (s: string) => new TextEncoder().encode(s),
  dec: (b: Uint8Array) => new TextDecoder().decode(b),
};

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

/** SERVER SIDE ONLY (webhook). privateKey: 32-byte hex. */
export async function signLicense(
  payload: LicensePayload,
  privateKeyHex: string,
): Promise<string> {
  if (payload.v !== 1) throw new LicenseError('payload.v must be 1', 'unsupported-version');
  const canonical = canonicalJson(payload);
  const sig = await ed.signAsync(utf8.enc(canonical), ed.etc.hexToBytes(privateKeyHex));
  return `${PREFIX}.${toB64Url(utf8.enc(canonical))}.${toB64Url(sig)}`;
}

export interface VerifyResult {
  valid: true;
  payload: LicensePayload;
}

/**
 * CLIENT SIDE. `publicKeys` maps keyId → 32-byte hex public key (the app
 * ships this map). Throws LicenseError on any failure — callers show
 * `.kind`-appropriate messages and fall back to the free tier.
 */
export async function verifyLicense(
  license: string,
  publicKeys: Record<string, string>,
): Promise<VerifyResult> {
  const trimmed = license.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new LicenseError('Not a recognizable license file.', 'malformed');
  }
  let payload: LicensePayload;
  try {
    payload = JSON.parse(utf8.dec(fromB64Url(parts[1]!))) as LicensePayload;
  } catch {
    throw new LicenseError('License file is damaged.', 'malformed');
  }
  if (payload.v !== 1) {
    throw new LicenseError(
      'License was issued for a newer app version — please update.',
      'unsupported-version',
    );
  }
  if (typeof payload.keyId !== 'string' || typeof payload.email !== 'string') {
    throw new LicenseError('License file is damaged.', 'malformed');
  }
  const pubHex = publicKeys[payload.keyId];
  if (!pubHex) {
    throw new LicenseError(
      `License signed with unknown key "${payload.keyId}" — update the app.`,
      'unknown-key',
    );
  }
  // Signature is over the RE-CANONICALIZED payload: tampering with either
  // the payload bytes or their decoded content breaks verification.
  const ok = await ed.verifyAsync(
    fromB64Url(parts[2]!),
    utf8.enc(canonicalJson(payload)),
    ed.etc.hexToBytes(pubHex),
  );
  if (!ok) {
    throw new LicenseError('License signature is invalid.', 'bad-signature');
  }
  return { valid: true, payload };
}

// ---------------------------------------------------------------------------
// Keygen (run once, [HUMAN], on a trusted machine)
// ---------------------------------------------------------------------------

export async function generateKeypair(): Promise<{
  privateKeyHex: string;
  publicKeyHex: string;
}> {
  const priv = ed.utils.randomSecretKey();
  const pub = await ed.getPublicKeyAsync(priv);
  return {
    privateKeyHex: ed.etc.bytesToHex(priv),
    publicKeyHex: ed.etc.bytesToHex(pub),
  };
}
