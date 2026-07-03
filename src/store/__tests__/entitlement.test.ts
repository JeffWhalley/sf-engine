/** Phase 11 T5 — single gating point. */
import { describe, it, expect } from 'vitest';
import { resolveEntitlement } from '../useEntitlement';
import { useCloudStore } from '../../lib/cloudStore';

describe('resolveEntitlement precedence', () => {
  it('license file beats everything and maps tiers', () => {
    expect(resolveEntitlement('valid', 'lifetime', null)).toEqual({
      tier: 'lifetime', source: 'license-file', paid: true,
    });
    expect(resolveEntitlement('valid', 'beta', 'free').tier).toBe('pro');
  });

  it('cloud pro applies when no license; free otherwise', () => {
    expect(resolveEntitlement('none', undefined, 'pro')).toEqual({
      tier: 'pro', source: 'cloud', paid: true,
    });
    expect(resolveEntitlement('none', undefined, 'free').paid).toBe(false);
    expect(resolveEntitlement('invalid', undefined, null).paid).toBe(false);
  });
});

describe('cloudStore without configuration (no env keys)', () => {
  it('reports off and every action no-ops safely', async () => {
    const s = useCloudStore.getState();
    expect(s.configured).toBe(false);
    expect(s.syncStatus).toBe('off');
    await s.init(); // must not throw
    expect(await s.signInWithEmail('x@y.z')).toBe(false);
    s.notifyChange({ kind: 'tool', payload: [], updatedAt: 1 }); // no-op
    expect(useCloudStore.getState().syncStatus).toBe('off');
  });
});
