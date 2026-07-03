/**
 * Phase 8 — app-level share/deep-link glue over lib/shareCodec.
 *
 * Fragment grammar (state never leaves the browser — fragment only):
 *   #v1.<payload>        → open the calculator with this shared state
 *   #sheet.v1.<payload>  → open the printable setup sheet for this state
 *   #sheet               → setup sheet of whatever state is current
 */

import { encodeShare, decodeShare, ShareCodecError } from './shareCodec';
import type { JobSnapshot } from '../store/useLibraryStore';

export type AppRoute = 'app' | 'sheet';

export interface ParsedHash {
  route: AppRoute;
  /** Present when the fragment carried a state payload. */
  snapshot?: JobSnapshot;
  /** Human-readable decode problem (unknown version / corrupt), if any. */
  error?: string;
}

const SHEET_PREFIX = 'sheet';

/** Full share URL for the calculator view. */
export function buildShareUrl(snapshot: JobSnapshot, base: string): string {
  return `${base}#${encodeShare(snapshot)}`;
}

/** Full share URL that opens directly on the printable setup sheet. */
export function buildSheetUrl(snapshot: JobSnapshot, base: string): string {
  return `${base}#${SHEET_PREFIX}.${encodeShare(snapshot)}`;
}

/** Parse a location.hash (leading '#' optional). Never throws. */
export function parseAppHash(hash: string): ParsedHash {
  const raw = (hash.startsWith('#') ? hash.slice(1) : hash).trim();
  if (raw === '') return { route: 'app' };

  let route: AppRoute = 'app';
  let payload = raw;
  if (raw === SHEET_PREFIX) return { route: 'sheet' };
  if (raw.startsWith(`${SHEET_PREFIX}.`)) {
    route = 'sheet';
    payload = raw.slice(SHEET_PREFIX.length + 1);
  }

  if (!payload.startsWith('v')) return { route }; // not a state fragment (e.g. anchors)
  try {
    const { state } = decodeShare<JobSnapshot>(payload);
    // Minimal shape check — enough to not crash loadSnapshot.
    if (
      typeof state === 'object' && state !== null &&
      typeof (state as JobSnapshot).materialId === 'string' &&
      typeof (state as JobSnapshot).toolId === 'string' &&
      typeof (state as JobSnapshot).machineId === 'string'
    ) {
      return { route, snapshot: state };
    }
    return { route, error: 'Share link decoded but is not a valid setup.' };
  } catch (e) {
    return { route, error: e instanceof ShareCodecError ? e.message : 'Unreadable share link.' };
  }
}
