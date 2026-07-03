# Speeds & Feeds — Development, Launch & Monetization Master Plan

**Drop this file into the repo as `docs/LAUNCH-PLAN.md`, next to `docs/PLAN.md`.**

This document continues where `docs/PLAN.md` (the build plan) and `CLAUDE.md`
(the handoff) leave off. It takes the project from "working local app" through
**product completion, desktop packaging, backend + accounts, payments, deployment,
public launch, and revenue**. It is written for the same audience: lower-capability
implementation agents working discrete, well-scoped tasks under human direction.

> **How to use this document (for implementing agents):**
> 1. Read `CLAUDE.md` first, then this file's §1 (current state) and §2 (strategy).
> 2. Work one Phase at a time, in dependency order (§3 has the graph).
> 3. Every phase ends with explicit **Acceptance Criteria (AC)**. Do not move on
>    until all AC pass and `npm test` / `npm run typecheck` / `npm run build` are green.
> 4. Anything marked **[HUMAN]** requires the project owner (accounts, purchases,
>    certificates, legal review, pricing decisions, posting to forums). Agents must
>    stop and ask — never fake these.
> 5. When a choice is ambiguous, prefer the option that keeps the calculation engine
>    pure, offline-capable, and conservative. The safety disclaimer (PLAN.md §0.4)
>    must survive into every surface: web, desktop, exports, screenshots.

---

## 1. Current State (as of last session)

| Track | Status |
|---|---|
| Phase 0–6 (scaffold, engine, data, UI, advanced physics, machine limits, persistence) | **DONE** — 123 tests across 14 files, `tsc` clean, `vite build` clean |
| Phase 7 (drilling / turning / long-tool compensation) | not started |
| Phase 8 (manufacturer overrides, HSM/trochoidal mode, export/share) | not started |
| Desktop app | not started |
| Backend / accounts / sync | not started |
| Payments / licensing | not started |
| Deployment / CI / monitoring | not started |
| Launch / marketing | not started |

Stack: **Vite + React + TypeScript + Tailwind + Zustand + Vitest.** Engine is pure
TS (`src/engine/`), data layer in `src/data/`, persistence behind an adapter in
`src/lib/` with in-memory fallback. Imperial is canonical internally. These
invariants must not be broken by anything in this plan.

---

## 2. Product & Business Strategy (read before building anything)

### 2.1 The shape of the market

The reference competitor sells a **Windows desktop app** with several license types
(monthly subscription, hobby yearly, lifetime floating, permanent offline) plus a
separate **web/mobile companion** product sold as a lifetime personal license, and a
free "Lite" tier limited to one workpiece material after the trial. Community
feedback on their store shows two lessons we should bake in from day one:

1. **Too many license options kills purchases.** We will sell at most **three** ways
   to pay, ever.
2. **Machinists deeply value offline, permanent, no-phone-home options** for shop
   floor PCs. Our desktop tier must include a fully offline license mode.

### 2.2 Our positioning

- **Web app = the funnel.** Free tier that is genuinely useful (full milling
  calculator, limited library slots), instantly accessible, SEO-friendly.
  Competitors' web offerings are paid — a genuinely good free web calculator is the
  wedge.
- **Pro (subscription) = the recurring revenue.** Unlocks the full material DB,
  drilling/turning, unlimited libraries, cloud sync, sharing, and the
  "interesting features" (§2.4).
- **Desktop (one-time or bundled) = trust + shop floor.** Same codebase via Tauri.
  Offline license, local data, auto-update. Priced as a lifetime personal license;
  Pro subscribers get it included.

### 2.3 Pricing (proposed — **[HUMAN]** final decision)

Keep it to one simple grid. Suggested starting points to validate in beta
(not commitments — test willingness to pay with the beta cohort before locking):

| Tier | Price (suggested test range) | Includes |
|---|---|---|
| **Free (web)** | $0 | Milling calculator, ~10 common materials, 3 saved tools, 1 machine, disclaimer-watermarked exports |
| **Pro** | $6–10 / month or $59–89 / year | Everything: full material DB, drilling/turning, HSM mode, unlimited libraries, cloud sync, share links, desktop app, priority data requests |
| **Shop / Lifetime desktop** | $149–249 one-time | Desktop app with permanent offline license + 1 year of updates; optional floating-seat add-on later |

Rules: annual ≈ 10× monthly (2 months free). Never gate the *safety-relevant*
warnings behind a paywall — limit *breadth* (materials, modes, saves), not *safety*.

### 2.4 Differentiating "interesting features" (what makes this more than a clone)

Ranked by (impact ÷ effort). These are the features marketing will lead with:

| # | Feature | Tier | Phase |
|---|---|---|---|
| F1 | **Shareable cut recipes** — every calculation encodes to a URL (`/c/#<base64 state>`); one click to share on a forum, opens read-only with a "tweak this" button | Free (viral loop) | 8 |
| F2 | **Printable setup sheet / QR export** — one-page PDF per job: tool, params, warnings, QR link back to the live recipe; tape it to the machine | Free (watermarked) / Pro (clean) | 8 |
| F3 | **Live engagement visualizer** — animated top-down view of the cutter in the cut (WOC/DOC, chip thinning shading); extends the existing `EngagementScope` | Free | 9 |
| F4 | **What-if sweep charts** — small multiples: MRR / power / deflection vs. the performance slider or vs. WOC, so users *see* the tradeoff curve instead of guessing | Pro | 9 |
| F5 | **Tool-life & cost-per-part estimator** — rough Taylor-equation tool life + $/part given tool cost and cycle contribution; clearly labeled as estimate | Pro | 9 |
| F6 | **Community recipe library** — opt-in publish of recipes (material+tool+machine+result), searchable, voteable, with mandatory "worked for me on <machine>" context | Pro to publish, free to read | 12 |
| F7 | **AI cut assistant** — "explain this recommendation," "my finish is chattering at these params, what do I change?" — LLM over the engine's own numbers, never overriding them | Pro | 12 |
| F8 | **Machinist toolbox** — tap-drill charts, thread calcs, trig/bolt-circle, drill point depth, surface-finish (Ra vs feed/nose radius) mini-calculators; each one is an SEO landing page | Free | 12 |
| F9 | **Machine presets library** — curated profiles for common machines (Tormach, Haas Mini Mill, Syil, PrintNC, routers...), community-submittable | Free | 7b |
| F10 | **PWA offline mode** — installable web app, works with no signal in the shop | Free | 10 |

F1, F2, F9 ship at launch. F3–F5 in the first post-launch month. F6–F8 after
revenue exists.

---

## 3. Phase Map & Dependency Graph

Phases 7–8 come from the original PLAN.md; 7b and 9–16 are new.

```
7  Drilling & turning modes ─────────┐
7b Machine presets library           ├─→ 8  Export, share links, mfr overrides, HSM mode
                                     │        │
                                     │        ▼
                                     │   9  Differentiators (F3, F4, F5)
                                     │
10 PWA + web deployment + CI  ───────┼─→ 11 Backend: accounts, sync, entitlements
                                     │        │
                                     │        ▼
                                     │   12 Payments & licensing (Stripe/MoR)
                                     │        │
13 Desktop app (Tauri) ──────────────┘        ▼
        │                            14 Beta program
        ▼                                     │
13b Desktop licensing + auto-update ──────────┤
                                              ▼
                                     15 LAUNCH
                                              │
                                              ▼
                                     16 Post-launch growth loop (F6–F8, content, iteration)
```

Parallelizable: {7, 7b} ∥ {10} ∥ {13 shell work}. Everything monetization-related
(11, 12, 13b) is serial. **Minimum path to first dollar:** 7 → 8 → 10 → 11 → 12 → 14 → 15.

Rough sizing (agent-sessions, i.e. one focused implementation session each):
7: 3–4 · 7b: 1 · 8: 3 · 9: 3 · 10: 2 · 11: 3–4 · 12: 3 · 13: 2–3 · 13b: 2 ·
14: ongoing · 15: 1 + human time · 16: ongoing.

---

## 4. Phase 7 — Drilling & Turning (complete the calculator)

Follow PLAN.md §7 for formulas. Additional requirements so it's launch-ready:

- **T1** Drilling: RPM/feed from SFM + feed/rev, peck-cycle suggestion (peck depth
  vs. diameter and material), thrust & power estimate, spot/center-drill hint for
  D < 1/8". New engine module `src/engine/drilling.ts`, pure, imperial-canonical,
  golden vector + property tests like Phase 1's.
- **T2** Turning: RPM (with max-RPM cap at small diameters), feed/rev, DOC
  suggestion, constant-surface-speed note, power from MRR. `src/engine/turning.ts`.
- **T3** Long-tool / stickout compensation (PLAN.md §7): reduce recommended feed &
  DOC as stickout/diameter ratio grows; reuse `deflection.ts`.
- **T4** UI: mode switcher (Mill / Drill / Turn) in the store; each mode reuses
  MaterialSelect/MachineEditor; results panel adapts.
- **AC:** ≥25 new tests including one golden vector per mode with every number
  documented in comments; integration sweep across all materials × both new modes
  produces no non-finite output; mode switch preserves material/machine selection.

## Phase 7b — Machine Presets (F9)

- **T1** `src/data/machinePresets.ts`: 15–20 curated profiles (Tormach 440/770/1100,
  Haas Mini Mill/VF-2, Syil X5, common routers, a manual knee mill, a generic
  10k/20k-RPM spindle). Fields per existing `Machine` type. **[HUMAN]** review the
  numbers — sourced from manufacturer public specs, cited in comments.
- **T2** UI: preset picker inside `MachineEditor` ("start from preset → edit").
- **AC:** every preset passes the Phase-5 limit checker against the integration
  sweep without producing impossible states; picker is searchable.

## Phase 8 — Share, Export, Overrides, HSM Mode

- **T1 (F1)** URL state codec: `src/lib/shareCodec.ts` — versioned, compact
  (JSON → deflate → base64url in the fragment, so state never hits the server).
  `#v1.<payload>`. Decoding an unknown version shows a friendly upgrade message.
  Round-trip property test: encode(decode(x)) === x for 500 random states.
- **T2 (F2)** Setup sheet: print-stylesheet route `/sheet` rendering the current
  state as one page (tool, material, machine, outputs, warnings, disclaimer, QR of
  the share URL — use the `qrcode` npm package). Free tier renders a
  "made with <app>" footer; Pro renders clean. PDF via the browser print dialog —
  do **not** add a server-side PDF dependency.
- **T3** Manufacturer override tables (PLAN.md §8): data shape + resolver hook that
  prefers an exact brand/series match over generic data, with a UI badge
  ("Using <brand> data").
- **T4** HSM/trochoidal mode (PLAN.md §6 scope): toggle that applies the
  high-engagement-speed/low-WOC parameter style with chip-thinning already in the
  engine; advisory copy about toolpath support in the user's CAM.
- **AC:** share URL from machine A reproduces identical outputs on machine B
  (golden test); setup sheet prints to one page at Letter and A4; overrides
  demonstrably change output and show the badge; all previous tests still green.

## Phase 9 — Differentiators (F3, F4, F5)

- **T1 (F3)** Upgrade `EngagementScope` to an animated SVG (requestAnimationFrame,
  respects `prefers-reduced-motion`): rotating cutter, engagement arc shaded,
  chip-thinning gradient. Zero engine changes.
- **T2 (F4)** Sweep charts: `src/lib/sweep.ts` runs `calculate()` across a swept
  variable (performance 0–100, or WOC 5–100%D) and returns series; render with
  `recharts` (already a known-good lib). Mark the current operating point. Pure
  function + memoization; must stay <16ms per frame for slider drags (throttle).
- **T3 (F5)** Tool life: Taylor VT^n = C with per-ISO-group default n and C chosen
  to yield sane baselines (document sources in comments); $/part panel = tool cost
  ÷ parts-per-edge-life + machine-rate × cycle-minutes. Giant "estimate only"
  caveat inline. New `src/engine/toolLife.ts`, pure, tested.
- **AC:** animation has a reduced-motion fallback; sweep chart matches spot-check
  values from direct `calculate()` calls; tool-life outputs monotonic (harder
  material or higher speed → shorter life) via property tests.

## Phase 10 — PWA, Web Deployment, CI

- **T1** PWA: `vite-plugin-pwa`, offline-first for the app shell + data (it's all
  static), install prompt, update toast. AC: Lighthouse PWA installable; airplane-mode
  reload works.
- **T2** Hosting: **Cloudflare Pages** (static, free tier, global). **[HUMAN]**
  create the CF account and buy the domain. Config as code in the repo
  (`wrangler.toml` or Pages Git integration).
- **T3** CI (GitHub Actions): on PR — install, typecheck, test, build; on `main` —
  deploy preview→production. Cache node_modules. Fail the build on any test/type error.
- **T4** Monitoring & analytics: **Sentry** (frontend errors) + **Plausible or
  Umami** (privacy-friendly analytics; machinist forums are hostile to tracking —
  say "no cookies, no ads" and mean it). Track only: pageviews, calc events
  (mode + material group, no user data), share-link creation, upgrade clicks.
- **T5** SEO base: prerendered landing page, per-mode routes with real copy
  (`/milling-speeds-and-feeds`, `/drilling-…`), OpenGraph cards that render the
  recipe summary for shared links, sitemap.
- **AC:** production URL serves the app <1s TTFB from a cold cache region; CI red
  blocks deploy; Sentry receives a thrown test error; analytics events visible.

## Phase 11 — Backend: Accounts, Sync, Entitlements

Philosophy: **the calculator never requires the backend.** The backend exists only
for identity, entitlements, sync, and community content.

- **T1** Platform: **Supabase** (Postgres + Auth + RLS + Edge Functions). Rationale:
  smallest ops surface for a solo owner, generous free tier, standard Postgres exit
  path. **[HUMAN]** create the project; keys go in CI secrets, never the repo.
- **T2** Auth: email magic-link + Google OAuth. No passwords to manage.
- **T3** Schema (RLS on everything):
  - `profiles(id, email, display_name, created_at)`
  - `entitlements(user_id, tier: free|pro|lifetime, source: stripe|manual|beta, current_period_end, updated_at)`
  - `libraries(user_id, kind: tool|machine|job, payload jsonb, updated_at, device_updated_at)` — sync unit is the whole library blob per kind (matches the existing `src/lib/` persistence adapter; simple last-write-wins with a conflict toast, not CRDTs)
  - `shared_recipes(id, user_id, title, payload jsonb, material_group, votes, created_at, published bool)` — for F6 later
- **T4** Client integration: new persistence adapter `src/lib/cloudStore.ts`
  implementing the same interface as the local adapter; sync = pull on login, push
  on change (debounced 2s), status indicator in the header. Signed-out experience
  identical to today.
- **T5** Entitlement gating: a single `useEntitlement()` hook; every gated feature
  checks it in exactly one place (no scattered `if (pro)`). Free limits enforced
  client-side for UX and server-side (RLS/row counts) for integrity.
- **AC:** RLS tests prove user A cannot read user B's rows; full offline → login →
  sync round-trip preserves libraries byte-identically; deleting the account
  (**required** — GDPR) cascades all rows.

## Phase 12 — Payments & Licensing

- **T1** Merchant: use a **merchant-of-record** (Paddle or Lemon Squeezy) rather
  than raw Stripe. Rationale: they handle global sales tax/VAT/invoices, which a
  solo operator should not — the fee premium buys compliance. **[HUMAN]** choose,
  open the account, and set final prices per §2.3. (If the owner insists on Stripe,
  add Stripe Tax + registrations — bigger lift; document the decision either way.)
- **T2** Checkout flow: pricing page → hosted checkout → webhook (Supabase Edge
  Function) verifies signature → writes `entitlements`. Also handle: renewal,
  cancellation (downgrade at period end, never mid-period), refund, chargeback.
  Idempotent webhook handlers with an events table.
- **T3** Grace + failure states: failed renewal → 7-day grace with banner →
  downgrade to free (data retained, gated features locked, nothing deleted).
- **T4** Manual entitlements admin: a tiny protected page (or SQL runbook) to grant
  beta/lifetime/comp entitlements.
- **AC:** end-to-end test in sandbox mode: purchase → Pro unlock <60s; cancel →
  downgrade at period end; refund → immediate downgrade; webhook replay does not
  double-grant. Pricing page copy reviewed **[HUMAN]**.

## Phase 13 — Desktop App (Tauri)

- **T1** Framework: **Tauri v2** wrapping the existing Vite app. Rationale: ~10MB
  installers vs. Electron's ~100MB, Rust shell we barely touch, same web codebase,
  first-class auto-update. Targets: Windows x64 (primary — the shop-floor OS),
  macOS universal, Linux AppImage.
- **T2** Desktop niceties: native file dialogs for library export/import (replace
  the browser download fallback), window state persistence, offline by default,
  "check for updates" menu item.
- **T3** CI matrix build: GitHub Actions builds all three platforms on tag push,
  attaches artifacts to a GitHub Release draft.
- **AC:** installer <25MB per platform; app passes the full golden-vector smoke
  test running from the packaged build; no network calls on launch when signed out
  (verify with a proxy log).

## Phase 13b — Desktop Licensing, Signing, Auto-Update

- **T1** License model (mirrors §2.1 lesson — offline must work):
  - Pro subscribers: sign in inside the desktop app; entitlement cached with a
    **30-day offline grace**, re-validated opportunistically.
  - Lifetime: a **signed license file** (Ed25519; payload = email, tier, issue
    date, key id). Public key ships in the app; verification is fully offline,
    forever, no phone-home. Issued automatically by a webhook on purchase and
    re-downloadable from the account page.
  - Piracy stance: deter honest people only. No DRM arms race; the free web tier
    is the real answer.
- **T2** Code signing **[HUMAN — budget item]:** Windows — Azure Trusted Signing
  (cheapest reputable route) or an OV cert; macOS — Apple Developer Program
  ($99/yr) + notarization in CI; Linux — none needed. Unsigned builds scare
  machinists off (SmartScreen warnings) — treat signing as a launch blocker for
  Windows/macOS.
- **T3** Auto-update: Tauri updater against GitHub Releases, signed manifests,
  channel = stable only (no beta channel until post-launch).
- **AC:** license file validates offline on a machine with networking disabled;
  tampered file rejected; update from vN to vN+1 succeeds on all three OSes;
  Windows install shows a signed publisher, macOS passes Gatekeeper.

## Phase 14 — Beta Program (2–4 weeks, overlaps 12–13b)

- **[HUMAN]** Recruit 20–50 machinists: r/Machinists, r/hobbycnc, Practical
  Machinist, CNCzone, a couple of Discords, and any personal contacts. Offer:
  free lifetime Pro for substantive feedback ("beta founder" entitlement via
  Phase 12 T4).
- Feedback loop: in-app feedback button (mailto or a Supabase table), weekly
  triage, a public CHANGELOG.md.
- **The one question that matters:** watch whether betas' *real cuts* match
  recommendations. Every "that RPM broke my tool" report is a P0 data bug —
  fix the data, add a regression test, thank them publicly.
- Also validate pricing here: show the pricing page, ask directly.
- **Exit criteria:** ≥10 external users have run ≥5 sessions each; zero open
  P0 correctness reports; checkout tested by ≥3 real cards (refunded).

## Phase 15 — Launch

**[HUMAN-led; agents prepare assets.]** Sequence over ~2 weeks:

1. **Soft launch:** flip billing live, remove beta gate, announce to beta list.
2. **Community launch (the real one):** honest posts in r/Machinists, r/hobbycnc,
   Practical Machinist, CNCzone — *lead with the free tool and a shared recipe
   link, not the paid tier.* Machinist forums reward "I built a thing, it's free
   to use, tear it apart" and punish marketing-speak. Reply to every comment for
   72h. **Read each forum's self-promotion rules first.**
3. **Creators:** offer free lifetime Pro to 5–10 CNC YouTubers (NYC CNC–style
   channels, hobby CNC channels) — no payment for coverage, just access; one
   honest mention is worth more than ads here.
4. **Product Hunt / Hacker News:** secondary; HN "Show HN" is worth one morning.
5. Launch-day checklist (agents prepare): status page, Sentry alert rules,
   Cloudflare cache warm, load test the share-link path, support email + canned
   responses, refund policy live, rollback plan for the last deploy.

**Launch assets for agents to draft (human edits before posting):** landing page
final copy, 90-second demo GIF/video script, 3 forum post drafts in different
voices, FAQ, comparison page ("vs. spreadsheet / vs. desktop-only calculators" —
factual, no competitor bashing).

## Phase 16 — Post-Launch Growth Loop (ongoing)

- **Content flywheel:** each F8 mini-calculator (tap drill, thread, bolt circle…)
  is a standalone SEO page funneling to the main app — ship one per week; these
  are ideal small agent tasks.
- **F6 community recipes** once ≥100 weekly actives: moderation queue **[HUMAN]**,
  report button, and recipes always display the disclaimer + "verify before running."
- **F7 AI assistant:** Anthropic API via an Edge Function (key server-side only);
  system prompt constrains it to *explain* engine outputs and suggest which input
  to change — it must never emit numbers the engine didn't produce. Pro-only;
  per-user daily cap to control cost.
- **Metrics review, weekly:** signups, activation (first completed calc), free→Pro
  conversion (target 2–4%), churn (<5%/mo), share-link creation rate (the viral
  loop health metric), top materials requested but missing (feeds the data backlog).
- **Data expansion backlog:** more materials/coatings, manufacturer override packs
  (may become a partnership/licensing conversation later **[HUMAN]**).

---

## 5. Legal & Safety (launch blockers, all **[HUMAN]** to finalize)

1. **Disclaimer everywhere:** PLAN.md §0.4 text in-app (already), on setup sheets,
   in share-link pages, in the desktop about box, and in the ToS. A first-run
   "I understand these are starting points" acknowledgment, stored locally.
2. **Terms of Service + EULA** (desktop) + **Privacy Policy** (name Supabase,
   the MoR, Sentry, and the analytics provider as processors; state plainly:
   no ads, no selling data, calculations never leave the device unless you share
   or sync). Use a reputable template service, then **have a lawyer skim the
   liability language** — this is machine-tool adjacent software; the waiver
   wording matters more than for a typical SaaS.
3. **Refund policy:** 14 days no-questions on desktop/lifetime; MoR handles the
   mechanics.
4. **Trademark check** on the final product name before buying the domain
   **[HUMAN]** — and do not use competitors' names in the product or ad keywords
   beyond truthful comparison pages.
5. Business entity / tax registration for the owner's jurisdiction — outside this
   plan's scope; flag to the owner before revenue starts.

---

## 6. Budget (recurring, order-of-magnitude)

| Item | Cost |
|---|---|
| Domain | ~$15/yr |
| Cloudflare Pages, Supabase, analytics | $0 at launch scale; ~$25–50/mo if it grows |
| Sentry | free tier initially |
| Apple Developer Program | $99/yr |
| Windows code signing (Azure Trusted Signing) | ~$10/mo |
| Merchant of record | % of revenue only |
| AI assistant API | usage-based; capped per user |

Fixed burn before revenue: roughly **$20–35/month + $99/year**. Everything else
scales with revenue.

---

## 7. Standing Rules for All Implementing Agents

1. `npm test && npm run typecheck && npm run build` green before every handoff;
   update `CLAUDE.md`'s status table and `docs/TODO.md` at the end of every session.
2. The engine stays pure and offline. No feature may make a network call a
   prerequisite for calculating.
3. Never weaken a warning, clamp, or disclaimer to make a number look better or a
   tier more attractive.
4. Secrets live in CI/host secret stores only. If a key appears in the repo,
   revoke it and tell the owner — do not just delete the line.
5. Stop and ask on anything **[HUMAN]**: accounts, purchases, prices, legal text,
   community posts, and any external communication.
6. New data (materials, presets, overrides) requires a cited source in comments
   and integration-sweep coverage before merge.
7. One phase per session where possible; if a phase is too big, cut at a task
   boundary and leave the tree green.
