# TODO — Speeds & Feeds Calculator

Running checklist. Mirrors `docs/PLAN.md` phases and the status table in
`CLAUDE.md`. Check items off as they land; keep the test count current.

**Current state: Phases 0–10T1 (+7b, 8.3/8.4, 13b license UI, editors, combobox) COMPLETE · 301 tests passing · `tsc` + `vite build` clean.**

---

## Phase 0 — Scaffold ✅
- [x] Vite + React + TypeScript + Tailwind + Vitest project
- [x] Strict tsconfig; folder layout (`engine/ data/ store/ ui/ components/ lib/`)

## Phase 1 — Calculation engine (`src/engine/`) ✅
- [x] `units.ts` conversions + `convert()`
- [x] `rpmFromSurfaceSpeed`, `surfaceSpeedFromRpm`, `feedRate`
- [x] `radialChipThinningFactor` (+ ceiling)
- [x] `effectiveDiameter` (ball + bull)
- [x] `mrr`, `spindlePower`, `torqueFromPower`, `cuttingForce`
- [x] `deflection` (cantilever) + `YOUNGS_MODULUS_PSI`
- [x] `computeMilling` orchestrator (+ Phase 5 rpm/feed overrides)
- [x] Golden vectors A & B; property / boundary / no-NaN tests

## Phase 2 — Data layer (`src/data/`) ✅
- [x] `types.ts` (Material, Tool, Machine, Coating)
- [x] `materials.ts` — 11 materials (SFM windows, chipload tables, unit power)
- [x] `tools.ts` — 8 tools; `machines.ts` — 4 machines
- [x] `resolve.ts` — `pickSFM`, `pickChipload`, `suggestEngagement`,
      `resolveMillingInput`, `calculate`
- [x] Schema validation + resolver + full data×engine integration sweep

## Phase 3 — React UI ✅
- [x] Zustand store; `buildSelection` / `effectiveTool`
- [x] Inputs: material, tool (editable Ø/flutes/stickout), machine, geometry,
      performance slider; IN/MM unit toggle
- [x] Results panel with DRO-style readout; disclaimer banner
- [x] Render test: Vector A reproduces on screen (imperial + metric)

## Phase 4 — Advanced calc surfaced ✅
- [x] Engagement scope (radial engagement, chip-thinning ×, base→adj feed/tooth)
- [x] Effective-diameter callout for ball/bull at shallow DOC
- [x] Power / torque / cutting + radial force / deflection rows
- [x] Tests: feed rises as WOC drops; ball shallow-DOC lowers RPM; deflection warning fires

## Phase 5 — Machine limits & balancing (`src/data/limits.ts`) ✅
- [x] `availablePower(rpm)` power/torque curve
- [x] RPM clamping (+ discrete-speed snapping) & feed clamping; recompute via overrides
- [x] `capPerformance` by machine rigidity
- [x] `fitEngagement` — Max DOC / Max WOC to available power
- [x] UI: clamped readout + "wanted" value; spindle-load meter vs available power
- [x] `buildWarnings` (unit-aware) replaces advisory-only path in the app
- [x] Tests: clamps, power curve, rigidity cap, balancing to power

## Phase 6 — Persistence & libraries ✅
- [x] `lib/storage.ts` — localStorage + in-memory fallback (`isPersistent()`)
- [x] `useLibraryStore` — user tools/machines, saved jobs
- [x] Save / load / delete jobs (full snapshot); save current tool to crib
- [x] Export / import library JSON (round-trips)
- [x] User tools/machines merged into pickers; `resolveTool`/`resolveMachine`
- [x] Tests: jobs round-trip, user-tool resolve, export/import, fallback, adoptTool

---

## Phase 7 — Operations & long-tool comp 🔶 (in progress)
- [x] Engine `computeDrilling` (RPM from SFM on drill Ø; feed/rev; peck suggestion) + Golden Vector D-A
- [x] Engine `computeTurning` (CSS; feed/rev; DOC; theoretical Ra) + Golden Vector T-A
- [x] Drill/turn seed data (`data/cuttingSeeds.ts`, per ISO group) — **[HUMAN] review values**
- [x] `resolveDrillingInput` / `resolveTurningInput` + all-material integration sweep
- [x] Long-tool / reduced-shank derating (`engine/longTool.ts`; applied in `calculateWithLimits`, warnings via `buildWarnings`) — model is a documented judgment call, **[HUMAN] review**
- [x] `OperationSelect` (Milling / Drilling / Turning) in store + UI; per-mode inputs (`DrillingInputs`/`TurningInputs`) + results (`DrillingResults`/`TurningResults`); jobs snapshot mode (back-compat)
- [x] On-screen tests: Golden Vectors D-A & T-A reproduce in the UI; mode switch preserves material/machine

## Phase 7b — Machine presets ✅
- [x] `data/machinePresets.ts` — 18 curated profiles, sources noted — **[HUMAN] review values**
- [x] `MachinePresetPicker` in machine panel ("start from preset → edit" via user library), searchable
- [x] AC test: every preset × every material through limit checker + drill/turn → finite, in-range

## Merged from standalone session (2026-07-02) ✅
- [x] `lib/shareCodec.ts` — `v1.` share codec, FROZEN wire format (Phase 8 T1)
- [x] `lib/sweep.ts` — engine-agnostic sweep data layer (Phase 9 T2)
- [x] `engine/toolLife.ts` — Taylor tool-life + cost/part, ESTIMATE-ONLY (Phase 9 T3)
- [x] `lib/licenseFile.ts` — `SFL1.` Ed25519 offline license verify (Phase 13b T1)
- [x] `.github/workflows/ci.yml` (Phase 10 T3); `docs/launch-assets/DRAFTS.md` — [HUMAN] edit

## Phase 8 — Overrides, HSM, export ✅
- [x] T1 Share codec (`lib/shareCodec.ts`, FROZEN v1) — merged from standalone session
- [x] T2 Setup sheet: `#sheet` route (`SetupSheet.tsx`), one-page print CSS, QR of share link (`qrcode`), disclaimer + "made with" footer; Share button copies `#v1.…` link; deep links restore state (`lib/appShare.ts`)
- [x] T3 Manufacturer overrides (`data/mfrOverrides.ts` + resolver hook + "Using <brand> data" badge) — registry holds ONE EXAMPLE entry; **[HUMAN] add real catalog data before launch**
- [x] T4 HSM mode: `strategy` tracked in store; `hsm` flag boosts SFM ×1.5 (**[HUMAN] review**); advisory copy + MRR-gain readout vs profile in `GeometryInputs`
- [x] 8.4 Machine power/torque envelope chart (`MachineCurveChart.tsx`, operating point marked)

## Phase 9 — Differentiators ✅
- [x] T2 Sweep chart (`ui/sweepData.ts` + `SweepChart.tsx`, recharts; gaps for invalid points; current point marked)
- [x] T3 Tool-life & cost/part panel (`ui/toolLifeData.ts` + `ToolLifePanel.tsx`; ESTIMATE-ONLY badge inline)
- [x] T1 Animated EngagementScope (rAF cutter rotation, chip-thinning gradient, prefers-reduced-motion → static)

## Phase 10 — PWA, deploy, CI 🔶
- [x] T1 PWA: `vite-plugin-pwa` (prompt updates, offline shell, icons, `UpdateToast`) — verify Lighthouse installable after first deploy
- [x] T3 CI workflow file in `.github/workflows/ci.yml` (from standalone session)
- [ ] T2 Hosting (Cloudflare Pages) — **[HUMAN]: account + domain**
- [ ] T4 Monitoring (Sentry + Plausible/Umami) — **[HUMAN]: accounts**

## Backlog / stretch 🔶
- [x] Searchable material combobox (`MaterialSelect` is now a keyboard-navigable combobox)
- [x] Full tool & machine editors (`ToolEditor`, `MachineEditor` — all fields, duplicate-&-edit for seeds, user library)
- [x] Tool-life (Taylor) estimate (Phase 9 T3)
- [x] Copy-results button (PLAN 8.3 — per-mode plain text + share URL, `ui/copyText.ts`)
- [x] License entry + Pro gating (Phase 13b: `useLicenseStore`, `LicensePanel`, sheet footer pro-clean; `lib/licenseKeys.ts` is a PLACEHOLDER — **[HUMAN] generate the real keypair**)
- [x] Per-field unit selection (`LengthField` — click the in/mm suffix; global toggle resets)
- [ ] Cloud sync / accounts (introduces a backend — out of scope for the static app)
