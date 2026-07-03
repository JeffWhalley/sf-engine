/**
 * Share-URL codec — Phase 8, T1 (LAUNCH-PLAN.md §4, feature F1).
 *
 * Encodes calculator state into a compact, versioned, URL-fragment-safe
 * string: `v1.<base64url(deflateRaw(JSON))>`. Lives in the FRAGMENT (#) so
 * shared state never reaches any server — a privacy promise we market.
 *
 * Compatibility contract: once shipped, every encoded string in the wild is
 * a compatibility surface. Rules:
 *   - NEVER change the meaning of an existing version's payload.
 *   - Schema changes → bump PREFIX to v2 and add a v1 reader (decode() may
 *     fan out by version). The frozen-fixture test enforces v1 stability.
 *   - Unknown/newer versions must produce ShareCodecError with a
 *     user-friendly message (UI shows "made with a newer version" toast).
 *
 * Uses `fflate` (tiny, browser+node). No engine imports — the payload is an
 * opaque JSON-serializable state object; the store owns its shape.
 */

import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export class ShareCodecError extends Error {
  /** 'unknown-version' lets the UI offer an upgrade hint. */
  constructor(
    message: string,
    public readonly kind: 'unknown-version' | 'corrupt' | 'unencodable',
  ) {
    super(message);
    this.name = 'ShareCodecError';
  }
}

export const CURRENT_VERSION = 1;
const SEP = '.';

// --- base64url (no padding), browser+node safe ------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// --- public API --------------------------------------------------------------

/**
 * Encode any JSON-serializable state. Throws ShareCodecError('unencodable')
 * on circular refs / non-serializable input.
 */
export function encodeShare(state: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(state);
    if (json === undefined) throw new Error('undefined');
  } catch {
    throw new ShareCodecError('State is not JSON-serializable.', 'unencodable');
  }
  const packed = deflateSync(strToU8(json), { level: 9 });
  return `v${CURRENT_VERSION}${SEP}${toBase64Url(packed)}`;
}

export interface DecodedShare<T = unknown> {
  version: number;
  state: T;
}

/** Decode a share string (with or without a leading '#'). */
export function decodeShare<T = unknown>(input: string): DecodedShare<T> {
  const raw = input.startsWith('#') ? input.slice(1) : input;
  const sep = raw.indexOf(SEP);
  const versionTag = sep === -1 ? '' : raw.slice(0, sep);
  const m = /^v(\d+)$/.exec(versionTag);
  if (!m) {
    throw new ShareCodecError('Not a recognizable share link.', 'corrupt');
  }
  const version = Number(m[1]);
  if (version !== 1) {
    throw new ShareCodecError(
      `This link was made with a newer version of the app (v${version}). ` +
        `Refresh/update the app and try again.`,
      'unknown-version',
    );
  }
  try {
    const bytes = fromBase64Url(raw.slice(sep + 1));
    const json = strFromU8(inflateSync(bytes));
    return { version, state: JSON.parse(json) as T };
  } catch {
    throw new ShareCodecError(
      'This share link appears damaged or truncated.',
      'corrupt',
    );
  }
}

/** Convenience: full URL for the current origin/path. */
export function shareUrl(state: unknown, base: string): string {
  return `${base}#${encodeShare(state)}`;
}
