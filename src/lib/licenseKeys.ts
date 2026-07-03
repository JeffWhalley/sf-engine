/**
 * Phase 13b — the app's shipped license PUBLIC keys (keyId → 32-byte hex).
 *
 * ⚠ PLACEHOLDER. **[HUMAN]:** run `generateKeypair()` ONCE in a secure
 * environment (see licenseFile.ts — the private key goes ONLY into the
 * payment webhook's secret store), then paste the real public key here and
 * delete this comment. With the placeholder, no real license can activate —
 * which is the safe failure mode.
 */
export const LICENSE_PUBLIC_KEYS: Record<string, string> = {
  'k1-placeholder': '0000000000000000000000000000000000000000000000000000000000000000',
};
