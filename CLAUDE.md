# CLAUDE.md — Speeds & Feeds Calculator

Context + handoff notes for resuming this project in a fresh session. Read this
first, then `docs/PLAN.md` for full detail.

> Phases 1–6 are built and verified: engine + data + React UI + machine-limit
> clamping + persistence (saved jobs, user tool crib, export/import with an
> in-memory fallback). The 2026-07-02 standalone package is MERGED: drilling +
> turning + tool-life engines, drill/turn seed data + resolvers, share codec,
> sweep utility, offline license verify, CI workflow. 236 tests pass, `tsc`
> clean, `vite build` clean. Preview: open `dist/index.html`, or
> `npm install && npm run dev`.
>
> See `docs/TODO.md` for the running checklist.

## What this is

A web app that recommends CNC speeds & feeds (RPM, feed rate, depth/width of cut,
power, torque, force, deflection) from a tool + material + machine + cut geometry —
in the spirit of HSM Advisor. Built so that lower-effort agents can implement it
phase by phase.

Two docs anchor the work:
- **`docs/PLAN.md`** — the full build plan: every formula with worked numeric
  examples, data schemas, UI spec, and the phased roadmap with acceptance criteria.
- **`README.md`** — how to run, file map, usage examples, resolution model.

## Status (as of this handoff)

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffold (Vite/TS/Tailwind/Vitest) | **DONE** |
| 1 | Calculation engine (`src/engine/`) | **DONE, tested** |
| 2 | Data layer (`src/data/`) | **DONE, tested** |
| 3 | React UI (`src/components/`, `src/store/`, `src/ui/`) | **DONE, tested** |
| 4 | Advanced calc surfaced in UI | **DONE, tested** — engagement scope (`EngagementScope.tsx`) visualizes radial engagement + chip-thinning boost + base→adj feed/tooth + effective Ø; power/torque/force/deflection rows shown |
| 5 | Machine limits, perf slider, DOC/WOC balancing | **DONE, tested** — `data/limits.ts`: `availablePower` curve, RPM/feed clamping + discrete-speed snapping, `capPerformance` by rigidity, `fitEngagement` (Max DOC / Max WOC); UI shows clamped result + "wanted" value |
| 6 | Persistence & libraries (`src/lib/`, `src/store/useLibraryStore.ts`) | **DONE, tested** — storage w/ in-memory fallback; save/load/delete jobs; user tool crib; export/import JSON |
| 7 | Drilling / turning / long-tool comp | **T1 (drilling engine) + T2 (turning engine) DONE, tested; seed data + resolvers (`data/cuttingSeeds.ts`, `resolveDrillingInput`/`resolveTurningInput`) DONE, tested; all-material integration sweep in `data/__tests__/resolveOps.test.ts`. T3 long-tool derating (`engine/longTool.ts` via `calculateWithLimits`) DONE, tested; T4 Mill/Drill/Turn switcher UI DONE, tested (golden vectors reproduce on screen). **Phase 7 COMPLETE** |
| 7b | Machine presets | **DONE, tested** — `data/machinePresets.ts` (18 profiles, **[HUMAN] review numbers**) + searchable `MachinePresetPicker` (adopt → user library → edit) |
| 8 | Overrides, HSM, share/export | **COMPLETE, tested** — T1 codec; T2 setup sheet/QR/deep links; T3 mfr overrides (`data/mfrOverrides.ts`, EXAMPLE entry only — [HUMAN] real data) + badge; T4 HSM mode (SFM ×1.5, [HUMAN] review) + MRR-gain readout; 8.4 machine envelope chart |
| 9 | Charts & tool life | **COMPLETE, tested** — T1 animated EngagementScope (reduced-motion fallback); T2 sweep chart; T3 tool-life/cost panel (ESTIMATE-ONLY) |
| 10 | Deploy / CI | **T1 PWA DONE** (vite-plugin-pwa, offline shell, update toast); **T3 CI file in place**. T2 hosting + T4 monitoring are [HUMAN]-gated |
| 13b | Offline licensing | **T1 + client UI DONE, tested** — `lib/licenseFile.ts`, `useLicenseStore`, `LicensePanel`; `lib/licenseKeys.ts` is a PLACEHOLDER public key (**[HUMAN] keygen**); Pro removes the sheet footer |

**Tests: 307 passing across 36 files. `tsc` clean. `vite build` clean.**

## How to verify (do this first when resuming)

```bash
cd sf-engine
npm install
npm test          # expect: 307 passed
npm run typecheck # expect: exit 0, no output
npm run build     # expect: clean Vite build into dist/
npm run dev       # serve the UI locally (or open dist/index.html)
```

If those are green, the foundation is intact and you can build on it.

## Architecture (hard rules — keep these true)

1. **Imperial is canonical.** All engine math is inches / ft·min⁻¹ / minutes / hp /
   lb-ft / psi / lbf. Convert only at the UI boundary (`src/engine/units.ts`).
2. **Engine is pure.** `src/engine/` has no React, no DOM, no storage, and never
   imports from `src/data/`. Dependency direction is UI → data → engine.
3. **No NaN.** Invalid inputs throw `EngineError`; valid inputs always return finite
   numbers. There are tests enforcing this; don't break them.
4. **One source of truth for state** (Phase 3 will add a Zustand store). Components
   never recompute formulas — they call `calculate()` / `computeMilling()`.
5. **No `localStorage` in artifacts.** When persistence lands (Phase 6), use the
   `MemoryStorage` fallback so it still runs inside a Claude Artifact preview.

## File map

```
sf-engine/
  src/engine/            # Phase 1 — pure math
    units.ts             # conversions + convert() dispatcher
    validate.ts          # EngineError + assertPositive/NonNegative/InRange
    chipThinning.ts      # radialChipThinningFactor, effectiveDiameter (ball/bull)
    power.ts             # mrr, spindlePower, torqueFromPower, cuttingForce, metric Kc
    deflection.ts        # cantilever deflection + YOUNGS_MODULUS_PSI table
    milling.ts           # rpm/feed primitives + computeMilling() orchestrator
    index.ts             # barrel
    __tests__/           # incl. vectors.ts (golden regression rows)
  src/data/              # Phase 2 — data + resolver
    types.ts             # Material, Tool, Machine, Coating, IsoGroup
    materials.ts         # 11 materials (getMaterial, searchMaterials, MATERIALS)
    tools.ts             # 8 tools (getTool, TOOLS)
    machines.ts          # 4 machines (getMachine, MACHINES)
    resolve.ts           # pickSFM, pickChipload, suggestEngagement,
                         #   resolveMillingInput, calculate  ← UI calls these
    index.ts             # barrel
    __tests__/
  src/store/             # Zustand state
    useCalcStore.ts      # Phase 3 — selections + geometry + performance + units;
                         #   buildSelection(), effectiveTool(), snapshot()/loadSnapshot()
    useLibraryStore.ts   # Phase 6 — user tools/machines + saved jobs + export/import;
                         #   resolveTool()/resolveMachine() (seed + user)
  src/lib/
    storage.ts           # Phase 6 — localStorage w/ in-memory fallback; isPersistent()
  src/ui/                # Phase 3 — UI-boundary helpers (NOT calculation)
    format.ts            # display formatting + unit conversion for readouts/inputs
    warnings.ts          # advisory warnings (advisory-only until Phase 5)
  src/components/        # Phase 3 — React components
    App handled in src/App.tsx; ResultsPanel is the presentational results view
    (has a render test asserting Vector A appears on screen)
  src/App.tsx            # layout + store wiring + result computation (useMemo)
  src/main.tsx           # React entry
  index.html, vite.config.ts, tailwind.config.js, postcss.config.js
  dist/                  # built app (open dist/index.html to preview)
  docs/PLAN.md           # full build plan
  README.md
```

## The two functions the UI will live on

```ts
import { getMaterial, getTool, getMachine, calculate, suggestEngagement,
         searchMaterials, TOOLS, MACHINES } from './data';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const machine = getMachine('mill-vmc-20hp')!;
const { ae_in, ap_in } = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);

const result = calculate({ material, tool, machine, ae_in, ap_in, performance: 50 });
// MillingResult: rpm, feed_ipm, chipload_in, mrr_in3min, cuttingPower_hp,
//   motorPower_hp, cuttingTorque_lbft, tangentialForce_lbf, radialForce_lbf,
//   deflection_in, effectiveDiameter_in, radialChipThinningFactor, sfm
```

## Key decisions & deviations from PLAN.md (don't re-litigate these)

- **SFM storage**: materials store only a carbide window (`sfmCarbide`); HSS/cobalt/
  coated are *derived* by factor (0.5 / 0.65 / 1.25) in `resolve.ts`, overridable via
  `Material.sfmOverrides`. (Plan §3.1 had all-optional per-material-type fields.)
- **Performance model**: a single `performance` 0..100 drives both axes — SFM
  *interpolates* the material window (min→max), chip load uses a *multiplier*
  (0.8 @0 / 1.0 @50 / 1.35 @100). This replaces the fixed multiplier table in plan
  §5.2 for SFM. The Phase 5 slider just feeds this number in.
- **Chipload tables** are generated from one reference fz at 1/2" using the aluminum
  shape ratios, so all materials scale consistently. Aluminum reproduces plan §3.4
  exactly (there's a test).
- **`cuttingForce`** takes surface speed directly (not diameter), so it stays correct
  once Phase 5 clamps RPM. Don't "simplify" it back to recomputing from D.
- **`calculate()` does NOT yet clamp to machine limits** — it only uses machine
  efficiency for power. Limit checking/clamping (RPM/feed/power/torque, discrete-RPM
  snapping, rigidity capping) is Phase 5 and wraps `calculate`.
- All seed numbers are conservative **starting points**, not manufacturer data.
  Precise data comes via the Phase 8 override path.

## Next action ([HUMAN] gates, then Phase 11–13)

Everything repo-side through Phase 10 T1 is complete and tested (incl. PWA,
copy-results, material combobox, full tool/machine editors, per-field units,
license UI). What remains needs the human:

1. **Phase 10 T2 hosting** — Cloudflare Pages account + domain; then wire the
   deploy step into `.github/workflows/ci.yml` (already present).
2. **Phase 10 T4 monitoring** — Sentry + Plausible/Umami accounts.
3. **License keypair** — run `generateKeypair()` once (see licenseFile.ts);
   private key → payment webhook secret store; public key → `lib/licenseKeys.ts`.
4. Then Phase 11 (backend/accounts), 12 (payments — the license signer is
   ready for the webhook), 13 (Tauri desktop; CI matrix is stubbed).

Standing [HUMAN] review items: license keypair generation (licenseKeys.ts), cuttingSeeds values, machinePresets numbers,
longTool derating model, HSM_SFM_BOOST, Taylor defaults, mfrOverrides example
entry (replace with real data), launch-assets/DRAFTS.md.

Then Phase 8: manufacturer S&F overrides (match `tool.brand`+`tool.series`,
bypass `pickSFM`/`pickChipload`), HSM/trochoidal preset polish, and copy-results
+ shareable URL (encode `snapshot()` in the query string — the store already has
`snapshot()`/`loadSnapshot()` to build on).

### Design language (keep consistent)
Machined-graphite instrument panel (`src/index.css` + `tailwind.config.js`):
anodized-teal accent only for the live readout, amber/red strictly for warnings,
JetBrains Mono tabular figures, Saira Condensed engraved labels, recessed "DRO"
windows for primary outputs.

## Safety note (must survive into the UI)

Outputs are starting points, not guarantees. The disclaimer in PLAN.md §0.4 must be
visible in the app. When in doubt the engine/data err conservative and warn — keep it
that way.
