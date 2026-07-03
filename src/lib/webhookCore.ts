/**
 * Phase 12 T2 — pure, idempotent entitlement-event processor.
 *
 * Runs SERVER-SIDE (the Supabase Edge Function imports this logic); it lives
 * in src/lib so it's unit-tested with the same rigor as the engine. All I/O
 * is injected. The app bundle never imports this file.
 *
 * Event mapping (LAUNCH-PLAN Phase 12 T2/T3):
 *   purchase / renewal   → set tier (+ period end for subscriptions)
 *   cancellation         → KEEP tier, keep period end (downgrade happens when
 *                          the period lapses — never mid-period)
 *   refund / chargeback  → immediate downgrade to free
 *   lifetime purchase    → tier lifetime + issue a signed offline license
 */

import type { LicensePayload } from './licenseFile';

export type EventType = 'purchase' | 'renewal' | 'cancellation' | 'refund' | 'chargeback';
export type PaidTier = 'pro' | 'lifetime';

export interface EntitlementEvent {
  /** Provider's unique event id — the idempotency key. */
  id: string;
  provider: string;
  type: EventType;
  email: string;
  tier: PaidTier;
  /** Subscription period end (ISO) — absent for lifetime. */
  periodEnd?: string;
  orderRef?: string;
}

export interface WebhookDeps {
  /** Has this event id been fully processed before? */
  wasProcessed(id: string): Promise<boolean>;
  /** Record the event (idempotency row) — called before side effects. */
  recordEvent(evt: EntitlementEvent): Promise<void>;
  /** Mark it done — called after all side effects succeed. */
  markProcessed(id: string): Promise<void>;
  /** Upsert the entitlement row for the user with this email. */
  writeEntitlement(args: {
    email: string;
    tier: 'free' | PaidTier;
    source: string;
    periodEnd?: string;
  }): Promise<void>;
  /** Sign + store/send a lifetime license file (Phase 13b T1). */
  issueLicense(payload: Omit<LicensePayload, 'v' | 'keyId'>): Promise<void>;
  now(): Date;
}

export interface ProcessResult {
  outcome: 'processed' | 'duplicate';
  action: string;
}

export async function processEntitlementEvent(
  evt: EntitlementEvent,
  deps: WebhookDeps,
): Promise<ProcessResult> {
  if (await deps.wasProcessed(evt.id)) {
    return { outcome: 'duplicate', action: 'none (replay ignored)' };
  }
  await deps.recordEvent(evt);

  let action: string;
  switch (evt.type) {
    case 'purchase':
    case 'renewal': {
      await deps.writeEntitlement({
        email: evt.email,
        tier: evt.tier,
        source: evt.provider,
        periodEnd: evt.tier === 'lifetime' ? undefined : evt.periodEnd,
      });
      action = `entitlement → ${evt.tier}`;
      if (evt.type === 'purchase' && evt.tier === 'lifetime') {
        await deps.issueLicense({
          email: evt.email,
          tier: 'lifetime',
          issuedAt: deps.now().toISOString(),
          orderRef: evt.orderRef,
        });
        action += ' + license issued';
      }
      break;
    }
    case 'cancellation': {
      // Never mid-period: entitlement stays until periodEnd lapses.
      await deps.writeEntitlement({
        email: evt.email,
        tier: evt.tier,
        source: evt.provider,
        periodEnd: evt.periodEnd,
      });
      action = `kept ${evt.tier} until ${evt.periodEnd ?? 'period end'}`;
      break;
    }
    case 'refund':
    case 'chargeback': {
      await deps.writeEntitlement({ email: evt.email, tier: 'free', source: evt.provider });
      action = 'immediate downgrade to free';
      break;
    }
  }

  await deps.markProcessed(evt.id);
  return { outcome: 'processed', action };
}

/**
 * Grace handling (Phase 12 T3) — pure helper for the client/edge cron:
 * within 7 days after a lapsed period end → 'grace' (show banner);
 * beyond → 'lapsed' (downgrade to free; data retained).
 */
export function subscriptionState(
  periodEnd: string | null | undefined,
  now: Date,
): 'active' | 'grace' | 'lapsed' | 'none' {
  if (!periodEnd) return 'none';
  const end = new Date(periodEnd).getTime();
  if (Number.isNaN(end)) return 'none';
  const graceMs = 7 * 24 * 3600 * 1000;
  if (now.getTime() <= end) return 'active';
  if (now.getTime() <= end + graceMs) return 'grace';
  return 'lapsed';
}
