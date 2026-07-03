/** Phase 12 T2 — webhook processor: idempotent, correct per event type (AC). */
import { describe, it, expect } from 'vitest';
import {
  processEntitlementEvent, subscriptionState,
  type EntitlementEvent, type WebhookDeps,
} from '../webhookCore';

function makeDeps() {
  const processed = new Set<string>();
  const recorded: string[] = [];
  const entitlements: unknown[] = [];
  const licenses: unknown[] = [];
  const deps: WebhookDeps = {
    wasProcessed: async (id) => processed.has(id),
    recordEvent: async (evt) => { recorded.push(evt.id); },
    markProcessed: async (id) => { processed.add(id); },
    writeEntitlement: async (a) => { entitlements.push(a); },
    issueLicense: async (p) => { licenses.push(p); },
    now: () => new Date('2026-07-03T12:00:00Z'),
  };
  return { deps, entitlements, licenses, recorded };
}

const evt = (over: Partial<EntitlementEvent>): EntitlementEvent => ({
  id: 'evt_1', provider: 'paddle', type: 'purchase', email: 'jeff@example.com',
  tier: 'pro', periodEnd: '2026-08-03T00:00:00Z', ...over,
});

describe('processEntitlementEvent', () => {
  it('pro purchase writes entitlement with period end, no license', async () => {
    const { deps, entitlements, licenses } = makeDeps();
    const r = await processEntitlementEvent(evt({}), deps);
    expect(r.outcome).toBe('processed');
    expect(entitlements[0]).toMatchObject({ tier: 'pro', periodEnd: '2026-08-03T00:00:00Z' });
    expect(licenses).toHaveLength(0);
  });

  it('lifetime purchase also issues a signed offline license', async () => {
    const { deps, entitlements, licenses } = makeDeps();
    await processEntitlementEvent(evt({ tier: 'lifetime', periodEnd: undefined, orderRef: 'ord9' }), deps);
    expect(entitlements[0]).toMatchObject({ tier: 'lifetime' });
    expect(licenses[0]).toMatchObject({ email: 'jeff@example.com', tier: 'lifetime', orderRef: 'ord9' });
  });

  it('AC: webhook replay does not double-grant', async () => {
    const { deps, entitlements, licenses } = makeDeps();
    await processEntitlementEvent(evt({ tier: 'lifetime' }), deps);
    const replay = await processEntitlementEvent(evt({ tier: 'lifetime' }), deps);
    expect(replay.outcome).toBe('duplicate');
    expect(entitlements).toHaveLength(1);
    expect(licenses).toHaveLength(1);
  });

  it('cancellation keeps the tier until period end (never mid-period)', async () => {
    const { deps, entitlements } = makeDeps();
    await processEntitlementEvent(evt({ id: 'evt_c', type: 'cancellation' }), deps);
    expect(entitlements[0]).toMatchObject({ tier: 'pro', periodEnd: '2026-08-03T00:00:00Z' });
  });

  it('refund and chargeback downgrade immediately', async () => {
    const { deps, entitlements } = makeDeps();
    await processEntitlementEvent(evt({ id: 'evt_r', type: 'refund' }), deps);
    await processEntitlementEvent(evt({ id: 'evt_cb', type: 'chargeback' }), deps);
    expect(entitlements).toEqual([
      expect.objectContaining({ tier: 'free' }),
      expect.objectContaining({ tier: 'free' }),
    ]);
  });
});

describe('subscriptionState (7-day grace)', () => {
  const now = new Date('2026-07-10T00:00:00Z');
  it('active until period end; grace ≤7 days after; lapsed beyond', () => {
    expect(subscriptionState('2026-07-11T00:00:00Z', now)).toBe('active');
    expect(subscriptionState('2026-07-05T00:00:00Z', now)).toBe('grace');
    expect(subscriptionState('2026-07-01T00:00:00Z', now)).toBe('lapsed');
    expect(subscriptionState(null, now)).toBe('none');
    expect(subscriptionState('garbage', now)).toBe('none');
  });
});
