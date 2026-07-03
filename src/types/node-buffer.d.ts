/**
 * Minimal ambient declaration for the Node `Buffer` fallback paths in
 * shareCodec.ts / licenseFile.ts (used only when btoa/atob are absent, i.e.
 * under vitest/Node). Deliberately NOT @types/node: the app is browser-first
 * and we don't want Node globals silently available across src/.
 */
declare const Buffer: {
  from(input: Uint8Array | string, encoding?: string): Uint8Array & {
    toString(encoding: string): string;
  };
};
