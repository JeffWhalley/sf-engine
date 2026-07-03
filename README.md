# Speeds & Feeds Calculator — Phases 1–6

Pure, framework-free TypeScript core plus a React UI for the CNC speeds & feeds
calculator.

- **Phase 1 — `src/engine/`**: the math core (pure functions, imperial-canonical).
- **Phase 2 — `src/data/`**: material / tool / machine databases + resolver.
- **Phase 3 — `src/components/`, `src/store/`, `src/ui/`**: the calculator console.
- **Phase 4**: advanced physics surfaced (engagement scope, chip thinning, effective Ø).
- **Phase 5 — `src/data/limits.ts`**: machine-limit clamping + DOC/WOC balancing.
- **Phase 6 — `src/lib/`, `src/store/useLibraryStore.ts`**: persistence (saved jobs,
  user tool crib, export/import) with an in-memory fallback.

See `docs/TODO.md` for the running checklist and `CLAUDE.md` for handoff notes.

## Run it

```bash
npm install
npm run dev       # serve the UI (or open dist/index.html to preview the build)
npm test          # 123 tests across 14 files
npm run typecheck
npm run build
```

All must be green before starting the next phase.

## What's here

```
src/engine/
  types.ts         # MillingInput / MillingResult, tool enums
  validate.ts      # EngineError + positive/range assertions (no NaN leaks)
  units.ts         # imperial<->metric conversions + convert() dispatcher
  chipThinning.ts  # radialChipThinningFactor + effectiveDiameter (ball/bull)
  power.ts         # mrr, spindlePower, torqueFromPower, cuttingForce, metric Kc check
  deflection.ts    # cantilever-beam tip deflection + Young's modulus table
  milling.ts       # rpm/feed primitives + computeMilling() orchestrator
  index.ts         # public barrel export
  __tests__/
    vectors.ts          # golden input->output regression rows (plan §8.1)
    units.test.ts
    chipThinning.test.ts
    power.test.ts
    deflection.test.ts
    milling.test.ts      # golden Vector A + metric Vector B + ball-nose
    properties.test.ts   # monotonicity, boundaries, randomized no-NaN sweep
```

## Design contract (keep this true in later phases)

1. **Imperial is canonical.** All internal math is inches / ft·min⁻¹ / minutes / hp /
   lb-ft / psi / lbf. Convert at the UI boundary only.
2. **Pure functions.** Nothing here touches React, the DOM, or storage.
3. **No NaN.** Invalid inputs throw `EngineError`; valid inputs always return finite numbers.
4. **Resolved inputs.** `computeMilling` receives already-resolved `sfm`, `chipload_in`,
   and `unitPower`. Turning material + tool + coating + performance into those numbers is
   Phase 2. Machine-limit clamping is Phase 5 and wraps the result of `computeMilling`.

## Usage

```ts
import { computeMilling } from './engine';

const result = computeMilling({
  sfm: 600, diameter_in: 0.5, flutes: 4, chipload_in: 0.003,
  ae_in: 0.05, ap_in: 0.5, toolType: 'flatEndmill',
  unitPower: 0.3, stickout_in: 1.5, toolMaterial: 'carbide',
});
// -> rpm 4583.66, feed_ipm 91.67, mrr 2.292, deflection 0.00015, ...
```

## Phase 2 — data layer (`src/data/`)

```
src/data/
  types.ts        # Material, Tool, Machine, Coating, IsoGroup
  materials.ts    # 11 seeded materials (SFM windows, chipload tables, unit power)
  tools.ts        # 8 seeded tools across the common types
  machines.ts     # 4 machine profiles (1 HP hobby, 20 HP VMC, router, gearbox)
  resolve.ts      # pickSFM, pickChipload, suggestEngagement, resolveMillingInput, calculate
  index.ts        # public barrel export
  __tests__/      # schema validation + resolver + full data×engine integration sweep
```

The bridge the UI will use:

```ts
import { getMaterial, getTool, getMachine, calculate, suggestEngagement } from './data';

const material = getMaterial('al-6061')!;
const tool = getTool('em-flat-050-4fl-carbide')!;
const machine = getMachine('mill-vmc-20hp')!;
const { ae_in, ap_in } = suggestEngagement(tool.diameter_in, 'profile', tool.fluteLength_in);

const result = calculate({ material, tool, machine, ae_in, ap_in, performance: 50 });
// -> full MillingResult (rpm, feed, mrr, power, torque, deflection, ...)
```

### Resolution model (read before editing)

- **SFM**: `pickSFM` interpolates the material's carbide window by `performance`
  (0..100). HSS / cobalt / coated-carbide windows are *derived by factor*
  (0.5 / 0.65 / 1.25) unless a material supplies an explicit `sfmOverrides` entry.
- **Chip load**: `pickChipload` interpolates the per-material `chiploadByDiameter`
  table, then applies a performance multiplier (0.8 @ 0, 1.0 @ 50, 1.35 @ 100).
- **Engagement**: `suggestEngagement(D, strategy, fluteLength?)` gives starting
  ae/ap for `slot` | `profile` | `hsm`, clamping axial depth to flute length.
- All seed numbers are conservative **starting points**; the manufacturer-override
  path (Phase 8) is the sanctioned way to get precise values.

## Next phases (hooks already in place)

- **Phase 3 (UI)**: collect selections, call `calculate()`, render `MillingResult`.
  Use `searchMaterials`, `TOOLS`, `MACHINES` to populate pickers.
- **Phase 5 (limits)**: wrap `calculate` — `checkLimits` / `clampRpmToMachine` /
  `clampFeedToMachine` using the `Machine` profile, plus rigidity-based capping of
  the `performance` value before it reaches `pickSFM`/`pickChipload`.
