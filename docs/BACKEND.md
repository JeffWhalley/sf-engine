# Backend setup runbook (Phase 11/12 — the [HUMAN] steps)

Everything code-side is already in the repo and tested. These are the account
steps only. Until you do them, the app runs exactly as today (cloud features
are dormant — no env keys, no cloud).

## 1. Supabase project (~15 min)

1. Create a project at supabase.com (free tier is fine to start).
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`.
3. Authentication → Providers: enable **Email (magic link)**; optionally
   Google OAuth (add the Vercel domain to redirect URLs).
4. Project Settings → API: copy the **URL** and **anon key**.

## 2. Vercel env vars

Project → Settings → Environment Variables:

    VITE_SUPABASE_URL      = https://<project>.supabase.co
    VITE_SUPABASE_ANON_KEY = <anon key>

Redeploy. The app detects the keys and cloud sync/entitlements wake up.
(NEVER put the service-role key in Vercel/client env.)

## 3. License signing keypair (one time, Phase 13b)

In any safe local Node REPL, inside the repo:

    import { generateKeypair } from './src/lib/licenseFile';
    console.log(await generateKeypair());

- `publicKeyHex` → paste into `src/lib/licenseKeys.ts` (replace placeholder).
- `privateKeyHex` → Supabase: `supabase secrets set LICENSE_PRIVATE_KEY_HEX=…
  LICENSE_KEY_ID=k1` — nowhere else, ever.

## 4. Payments webhook (Phase 12, when you pick a merchant)

1. Choose Paddle or Lemon Squeezy (merchant of record — they handle tax).
2. Implement the two TODOs in `supabase/functions/payments-webhook/index.ts`
   (`verifySignature`, `parseEvent`) for that provider's format — the decision
   logic (`src/lib/webhookCore.ts`) is already tested: idempotent replays,
   cancel-at-period-end, instant refund downgrade, lifetime license issuance.
3. `supabase secrets set WEBHOOK_SECRET=…` then
   `supabase functions deploy payments-webhook --no-verify-jwt`.
4. Point the provider's webhook URL at the function; run their sandbox
   purchase → expect Pro in <60s (AC).

## What's already handled in code

- RLS on every table; user A cannot read user B (policies in the migration).
- Free-tier limit backstop server-side (25 items/kind) via trigger.
- GDPR: deleting an auth user cascades all rows.
- Sync: last-write-wins per library kind, 2s debounced push, conflict toast
  data, offline-first (`src/lib/sync.ts` — unit-tested).
- Gating: single `useEntitlement()` hook; license file (offline) beats cloud.
