/**
 * Phase 12 T2 — payments webhook (Supabase Edge Function, Deno).
 *
 * ⚠ SKELETON — [HUMAN] steps before this goes live (see docs/BACKEND.md):
 *   1. Choose the merchant of record (Paddle / Lemon Squeezy) and implement
 *      `verifySignature` + `parseEvent` for their exact payload format.
 *   2. `supabase secrets set` : WEBHOOK_SECRET, LICENSE_PRIVATE_KEY_HEX,
 *      LICENSE_KEY_ID (from the one-time keygen — licenseFile.ts).
 *   3. `supabase functions deploy payments-webhook --no-verify-jwt`
 *
 * All decision logic is in src/lib/webhookCore.ts (unit-tested in the repo);
 * this file is only transport + wiring.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  processEntitlementEvent,
  type EntitlementEvent,
  type WebhookDeps,
} from '../../../src/lib/webhookCore.ts';
import { signLicense } from '../../../src/lib/licenseFile.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role: entitlement writes
);

/** [HUMAN] implement per provider (HMAC etc.). MUST reject on failure. */
function verifySignature(_rawBody: string, _headers: Headers): boolean {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret) return false;
  // TODO(provider): Paddle → verify `Paddle-Signature` HMAC-SHA256 of raw body
  //                 Lemon Squeezy → verify `X-Signature` HMAC-SHA256
  return false; // fail closed until implemented
}

/** [HUMAN] map the provider's payload to the normalized event. */
function parseEvent(_body: any): EntitlementEvent | null {
  // TODO(provider): map event name → type, extract email/tier/periodEnd/id
  return null;
}

const deps: WebhookDeps = {
  wasProcessed: async (id) => {
    const { data } = await supabase.from('webhook_events').select('processed').eq('id', id).maybeSingle();
    return data?.processed === true;
  },
  recordEvent: async (evt) => {
    await supabase.from('webhook_events').upsert({ id: evt.id, provider: evt.provider, payload: evt });
  },
  markProcessed: async (id) => {
    await supabase.from('webhook_events').update({ processed: true }).eq('id', id);
  },
  writeEntitlement: async ({ email, tier, source, periodEnd }) => {
    const { data: user } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!user) throw new Error(`no profile for ${email} — buyer must sign up first`);
    await supabase.from('entitlements').upsert({
      user_id: user.id,
      tier,
      source,
      current_period_end: periodEnd ?? null,
      updated_at: new Date().toISOString(),
    });
  },
  issueLicense: async (payload) => {
    const priv = Deno.env.get('LICENSE_PRIVATE_KEY_HEX')!;
    const keyId = Deno.env.get('LICENSE_KEY_ID') ?? 'k1';
    const license = await signLicense({ v: 1, keyId, ...payload }, priv);
    // Store for re-download from the account page (bucket or table).
    await supabase.from('issued_licenses').upsert({ email: payload.email, license });
  },
  now: () => new Date(),
};

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers)) return new Response('bad signature', { status: 401 });
  const evt = parseEvent(JSON.parse(raw));
  if (!evt) return new Response('unhandled event', { status: 200 }); // ack, don't retry
  const result = await processEntitlementEvent(evt, deps);
  return new Response(JSON.stringify(result), { status: 200 });
});
