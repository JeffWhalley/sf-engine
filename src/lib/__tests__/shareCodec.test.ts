import { describe, it, expect } from 'vitest';
import {
  encodeShare,
  decodeShare,
  shareUrl,
  ShareCodecError,
  CURRENT_VERSION,
} from '../shareCodec';

/** A realistic store snapshot, mirroring the Phase-3 Zustand shape. */
const TYPICAL_STATE = {
  v: 1,
  mode: 'mill',
  materialId: 'al-6061',
  toolId: 'em-0500-4fl-carbide',
  machineId: 'tormach-1100',
  ae_in: 0.125,
  ap_in: 0.5,
  performance: 65,
  unitSystem: 'in',
};

/**
 * FROZEN v1 FIXTURE — do not regenerate. If this test breaks, the wire
 * format changed and every link in the wild breaks with it. Bump to v2
 * with a v1 reader instead (see shareCodec.ts contract).
 */
const FROZEN_V1 =
  'v1.LY1LDsIwDETv4jVBDqJZ5AasOQAKqSss5VOFgIQQd2cC3fk9z9hvepK3O8p1FvKUNSUChS5NQzrNcCEZx85C91r_SrLhidkcl2RiaFdFebTiTYv8Er22gcZaZqyCXLSQ5709TKB1I8yrtGVkS8R_B_Eo2s-ve5eMM4h9vg';

describe('frozen v1 wire format', () => {
  it('decodes the frozen fixture to the exact original state', () => {
    const { version, state } = decodeShare<typeof TYPICAL_STATE>(FROZEN_V1);
    expect(version).toBe(1);
    expect(state).toEqual(TYPICAL_STATE);
  });
  it('current encoder still emits v1', () => {
    expect(CURRENT_VERSION).toBe(1);
    expect(encodeShare({ a: 1 }).startsWith('v1.')).toBe(true);
  });
});

describe('round-trip properties', () => {
  it('encode→decode is identity for 500 randomized states', () => {
    let seed = 7;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
      return Math.abs(seed % 100_000) / 100_000;
    };
    for (let i = 0; i < 500; i++) {
      const state = {
        mode: (['mill', 'drill', 'turn'] as const)[Math.floor(rnd() * 3)],
        materialId: `mat-${Math.floor(rnd() * 40)}`,
        toolId: `tool-${Math.floor(rnd() * 999)}`,
        nums: [rnd() * 10, rnd(), Math.floor(rnd() * 24000)],
        nested: { performance: Math.floor(rnd() * 101), flag: rnd() > 0.5 },
        maybeNull: rnd() > 0.5 ? null : 'x',
        unicode: 'Ø½″ — ±0.001 → μm ✓',
      };
      expect(decodeShare(encodeShare(state)).state).toEqual(state);
    }
  });

  it('handles a leading # (fragment as read from location.hash)', () => {
    const enc = encodeShare(TYPICAL_STATE);
    expect(decodeShare('#' + enc).state).toEqual(TYPICAL_STATE);
  });

  it('shareUrl composes base + fragment', () => {
    const url = shareUrl(TYPICAL_STATE, 'https://example.com/c');
    expect(url).toMatch(/^https:\/\/example\.com\/c#v1\./);
    expect(decodeShare(url.split('#')[1]!).state).toEqual(TYPICAL_STATE);
  });
});

describe('compactness & URL safety', () => {
  it('typical state stays comfortably shareable (<300 chars)', () => {
    expect(encodeShare(TYPICAL_STATE).length).toBeLessThan(300);
  });
  it('output is base64url-safe (no +, /, =, #, ?)', () => {
    const enc = encodeShare(TYPICAL_STATE);
    expect(/^v1\.[A-Za-z0-9_-]+$/.test(enc)).toBe(true);
  });
});

describe('error paths (friendly, typed)', () => {
  it('unknown newer version → unknown-version error with upgrade hint', () => {
    try {
      decodeShare('v99.AAAA');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ShareCodecError);
      expect((e as ShareCodecError).kind).toBe('unknown-version');
      expect((e as ShareCodecError).message).toMatch(/newer version/i);
    }
  });

  it('garbage / truncated / non-share strings → corrupt', () => {
    for (const bad of ['', 'hello', 'v1.', 'v1.!!!!', FROZEN_V1.slice(0, 40), 'vX.abc']) {
      try {
        decodeShare(bad);
        expect.unreachable(`should have thrown for: ${bad}`);
      } catch (e) {
        expect(e).toBeInstanceOf(ShareCodecError);
        expect((e as ShareCodecError).kind).toBe('corrupt');
      }
    }
  });

  it('circular state → unencodable', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    try {
      encodeShare(a);
      expect.unreachable();
    } catch (e) {
      expect((e as ShareCodecError).kind).toBe('unencodable');
    }
  });
});
