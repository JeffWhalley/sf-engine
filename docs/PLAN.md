# Speeds & Feeds Calculator — Web App Build Plan

A complete, agent-ready specification for building a CNC speeds-and-feeds calculator
in the spirit of HSM Advisor. This document is written so that lower-capability
implementation models/agents can pick up discrete, well-scoped tasks and produce
correct, testable code.

> **How to use this document (for implementing agents):** Work phase by phase, top to
> bottom. Do not skip the Calculation Engine (Phase 1) — every later feature depends on
> it. Each formula has units and a worked numeric example; turn those examples into unit
> tests before moving on. When a value is ambiguous, prefer the *conservative* result and
> surface a warning rather than guessing.

---

## 0. Product Overview

### 0.1 What we are building
A web application where a machinist enters a **cutting tool**, a **workpiece material**,
a **machine**, and a **cut geometry**, and receives recommended **spindle speed (RPM)**,
**feed rate**, **depth/width of cut**, and supporting figures (material removal rate,
spindle power, torque, cutting force, and tool deflection). A **performance slider** lets
the user move between conservative and aggressive parameters. The app warns when a
recommendation exceeds machine limits or risks tool breakage.

### 0.2 Reference product
HSM Advisor (hsmadvisor.com). The features we are replicating, in priority order:

| Priority | Feature | Phase |
|---|---|---|
| P0 | RPM + feed rate from material SFM and tool chip load | 1 |
| P0 | Inch/metric support | 1 |
| P0 | Material & tool databases | 2 |
| P0 | Input form + results display | 3 |
| P1 | Radial & axial chip thinning | 4 |
| P1 | Material removal rate (MRR) | 4 |
| P1 | Spindle power & torque estimation | 4 |
| P1 | Cutting force & tool deflection ("virtual tool") | 4 |
| P1 | Machine profiles + limit checking/clamping | 5 |
| P1 | Performance slider (conservative ↔ aggressive) | 5 |
| P1 | DOC/WOC balancing against available power | 5 |
| P2 | Saved tool / machine / job libraries (persistence) | 6 |
| P2 | HSM / trochoidal milling mode | 6 |
| P2 | Drilling & turning modes | 7 |
| P2 | Stickout / long-tool RPM & feed reduction | 7 |
| P3 | Manufacturer-recommended override tables | 8 |
| P3 | Export / copy results, shareable links | 8 |

### 0.3 Non-goals (for v1)
- No user accounts or server-side database (everything client-side until Phase 6+).
- No real-time tool-life prediction model (we provide a rough estimate only).
- No G-code generation.

### 0.4 Mandatory safety disclaimer (must appear in the UI)
> These figures are **starting points**, not guarantees. Always begin conservatively,
> verify against your tool manufacturer's data, and use sound judgment. The authors accept
> no liability for tool breakage, machine damage, or injury. Wear eye protection.

---

## 1. Domain Glossary (read this before writing any calculation code)

| Term | Symbol | Unit (imperial / metric) | Meaning |
|---|---|---|---|
| Cutting speed (surface speed) | SFM / Vc | ft/min / m/min | Speed of the cutting edge through the material. Driven by **material + tool material + coating**. |
| Spindle speed | n / RPM | rev/min | How fast the spindle turns. **Output.** |
| Tool diameter | D | in / mm | Cutting diameter of the tool. |
| Number of flutes/teeth | Z | count | Cutting edges. |
| Feed per tooth (chip load) | fz | in/tooth / mm/tooth | Material advanced per tooth per rev. Driven by **material + tool diameter**. |
| Feed rate | vf | in/min (IPM) / mm/min | Linear table feed. **Output.** vf = n · Z · fz |
| Axial depth of cut | ap (DOC) | in / mm | How deep the tool engages along its axis. **Input or suggested.** |
| Radial depth of cut / width of cut | ae (WOC) | in / mm | How wide the tool engages. **Input or suggested.** |
| Material removal rate | MRR / Q | in³/min / cm³/min | Volume removed per minute. ae · ap · vf. |
| Specific cutting force | kc | — / N/mm² | Force to shear a unit chip area. Material property. |
| Unit power | up / Kp | hp·min/in³ / — | Power to remove a unit volume per minute. Material property. |
| Maximum chip thickness | hm / hex | in / mm | Actual peak chip thickness; differs from fz at low radial engagement. |
| Effective diameter | Deff | in / mm | The diameter actually doing the cutting (ball/bull tools at shallow DOC). |
| Young's modulus | E | psi / GPa | Stiffness of the tool material (deflection calc). |
| Stickout | L | in / mm | Length of tool protruding from the holder. |

**ISO material groups** (used to organize the material DB):
`P` steel · `M` stainless steel · `K` cast iron · `N` non-ferrous (aluminum, brass, copper) ·
`S` superalloys (titanium, nickel/Inconel) · `H` hardened steel.

---

## 2. Calculation Engine Specification (THE CORE — implement & test first)

Implement these as **pure functions** in a single module (`src/engine/`), each taking
explicit numeric inputs in a single unit system and returning numbers. Do all internal math
in **one canonical unit system** (recommendation: **imperial inches + minutes**), and convert
at the UI boundary only. Every function below lists units, the formula, and a worked example.

> **Agent rule:** never inline these formulas elsewhere. The UI calls the engine; the engine
> never touches the DOM.

### 2.1 Unit conversions (`units.ts`)
```
in  = mm / 25.4
mm  = in * 25.4
ft/min (SFM) = (m/min) * 3.28084
m/min        = SFM / 3.28084
in³/min      = cm³/min / 16.387064
hp           = kW / 0.7457
kW           = hp * 0.7457
lb-ft        = N·m * 0.737562
N·m          = lb-ft / 0.737562
psi          = GPa * 145037.7
```
Write `convert(value, fromUnit, toUnit)` with a small lookup table. Round only for display
(see §2.12), never mid-calculation.

### 2.2 Spindle speed from cutting speed (`rpmFromSurfaceSpeed`)
Inputs: `sfm` (ft/min), `diameter_in` (in). Output: RPM.
```
RPM = (SFM * 12) / (π * D_in)
```
Metric equivalent (for reference/tests): `RPM = (Vc_mmin * 1000) / (π * D_mm)`

**Worked example:** SFM = 600, D = 0.5 in →
`RPM = (600*12)/(π*0.5) = 7200/1.570796 = 4583.66 RPM`. ✅ test target `4583.66 ± 0.5`

### 2.3 Feed rate (`feedRate`)
Inputs: `rpm`, `flutes` (Z), `chipload_in` (fz, in/tooth). Output: IPM.
```
vf = RPM * Z * fz
```
**Worked example:** RPM = 4583.66, Z = 4, fz = 0.003 →
`vf = 4583.66 * 4 * 0.003 = 55.00 IPM`. ✅ test target `55.00 ± 0.05`

### 2.4 Surface speed back-calc (`surfaceSpeedFromRpm`) — needed for limit clamping
```
SFM = (RPM * π * D_in) / 12
```

### 2.5 Radial chip thinning (`radialChipThinningFactor`)
When radial engagement `ae` is **less than half the diameter**, the real chip is thinner
than `fz`, so feed can be increased to keep the *actual* chip thickness on target.

Inputs: `ae_in`, `D_in`. Output: factor ≥ 1 to multiply `fz` by.
```
r = ae / D                       // radial engagement ratio (0..1)
if r >= 0.5:  RCTF = 1           // no thinning at/above half engagement
else:         RCTF = 1 / (2 * sqrt(r - r^2))
```
Clamp the factor to a sane ceiling (e.g. **≤ 3.0**) to avoid runaway feeds at tiny `ae`.

**Worked examples (must hold in tests):**
- `ae = 0.5D` (r=0.5): RCTF = 1.000
- `ae = 0.25D` (r=0.25): `1/(2*sqrt(0.25-0.0625)) = 1/(2*0.4330) = 1.1547`
- `ae = 0.10D` (r=0.10): `1/(2*sqrt(0.10-0.01)) = 1/(2*0.3) = 1.6667`

Adjusted feed per tooth: `fz_adj = fz_target * RCTF`. Recompute `vf` with `fz_adj`.

### 2.6 Effective diameter & axial chip thinning (`effectiveDiameter`)
For **ball-nose** and **bull-nose (corner-radius)** tools cutting at a shallow axial depth,
only a smaller effective diameter is engaged. Use this **effective diameter for the SFM→RPM
conversion** (the contact point moves slower than the nominal OD).

Ball nose (radius `R = D/2`), axial depth `ap`:
```
if ap >= R:  Deff = D
else:        Deff = 2 * sqrt(ap * (D - ap))      // = 2*sqrt(2*R*ap - ap^2)
```
Bull nose with corner radius `rc`, axial depth `ap`:
```
if ap >= rc:  Deff = D
else:         Deff = D - 2*rc + 2*sqrt(ap*(2*rc - ap))
```
**Worked example (ball):** D = 0.5 (R=0.25), ap = 0.05 →
`Deff = 2*sqrt(0.05*(0.5-0.05)) = 2*sqrt(0.0225) = 2*0.15 = 0.30 in`.
Then compute RPM from `Deff` instead of `D`.

> Order of operations: compute `Deff` → RPM from `Deff` → radial thinning on `ae` → feed.

### 2.7 Material removal rate (`mrr`)
Inputs: `ae_in`, `ap_in`, `vf_ipm`. Output: in³/min.
```
MRR = ae * ap * vf
```
**Worked example:** ae = 0.05, ap = 0.5, vf = 91.67 → `MRR = 2.292 in³/min`.

### 2.8 Spindle power (`spindlePower`)
Inputs: `mrr_in3min`, `unitPower` (hp·min/in³ for the material), `efficiency` (0–1, default 0.80).
```
P_cut_hp   = MRR * unitPower
P_motor_hp = P_cut_hp / efficiency
```
**Worked example:** MRR = 2.292, unitPower(aluminum)=0.30, eff=0.80 →
`P_cut = 0.688 hp`, `P_motor = 0.859 hp`.

Metric cross-check formula (for tests):
`P_kW = (ae_mm * ap_mm * vf_mmmin * kc_Nmm2) / (60 * 10^6)`

### 2.9 Torque (`torqueFromPower`)
```
Torque_lbft = (P_hp * 5252) / RPM
Torque_Nm   = (P_kW * 9550) / RPM
```
**Worked example:** P = 0.688 hp, RPM = 4583.66 → `T = 0.788 lb-ft`.

### 2.10 Tangential cutting force (`cuttingForce`)
Approximate the average tangential force at the cutter from power:
```
Ft_lbf = (P_cut_hp * 33000) / Vcut_ftmin
   where Vcut_ftmin = (π * D_in * RPM) / 12   // surface speed
```
Radial (deflecting) force is roughly a fraction of tangential; use a configurable ratio
`kr` (default **0.4**): `Fr = kr * Ft`.

**Worked example:** P_cut = 0.688 hp, D=0.5, RPM=4583.66 →
`Vcut = (π*0.5*4583.66)/12 = 600 ft/min`; `Ft = (0.688*33000)/600 = 37.8 lbf`; `Fr ≈ 15.1 lbf`.

### 2.11 Tool deflection (`deflection`) — cantilever beam model
Model the tool as a round cantilever loaded at the tip by the radial force `Fr`.
Inputs: `Fr_lbf`, `stickout_in` (L), `D_in`, `E_psi`, optional `fluteFactor` (default 0.8 —
the fluted section is less stiff, model it as an effective diameter `d = fluteFactor * D`).
```
d = fluteFactor * D
I = π * d^4 / 64                 // area moment of inertia (in^4)
δ = (Fr * L^3) / (3 * E * I)     // tip deflection (in)
```
`E` reference values: **solid carbide ≈ 90,000,000 psi (90 Mpsi / ~620 GPa)**,
**HSS ≈ 30,000,000 psi (~210 GPa)**.

**Worked example:** Fr = 15.1, L = 1.5, D = 0.5, fluteFactor = 0.8, E = 90e6 →
`d = 0.4`, `I = π*0.4^4/64 = π*0.0256/64 = 0.0012566 in^4`,
`δ = (15.1 * 1.5^3)/(3*90e6*0.0012566) = (15.1*3.375)/(339,283) = 50.96/339283 = 0.000150 in`.

Flag a warning if `δ > deflectionLimit` (default **0.001 in / 0.025 mm**) — reduce
DOC/feed when exceeded.

### 2.12 Rounding / display helpers
- RPM → nearest 1 (or snap to machine's discrete steps if gearbox machine).
- Feed (IPM) → 2 decimals; (mm/min) → nearest 1.
- Chip load → 4 decimals (in) / 3 decimals (mm).
- Power → 2 decimals; Torque → 2 decimals; Deflection → 4 decimals (in) / 3 (mm).

### 2.13 The orchestration function (`computeMilling`)
A single high-level function that wires the above together. Pseudocode:
```
function computeMilling(input):
    Deff   = effectiveDiameter(toolType, D, ap, cornerRadius)
    sfm    = pickSFM(material, toolMaterial, coating, performance)   // §3
    rpm    = rpmFromSurfaceSpeed(sfm, Deff)
    rpm    = clampRpmToMachine(rpm, machine)                         // §5, may rescale sfm
    fzBase = pickChipload(material, D, performance)                  // §3
    rctf   = radialChipThinningFactor(ae, D)
    fz     = min(fzBase * rctf, fzBase * RCTF_CEILING)
    vf     = feedRate(rpm, Z, fz)
    vf     = clampFeedToMachine(vf, machine)
    mrrV   = mrr(ae, ap, vf)
    pCut   = mrrV * unitPower(material)
    pMot   = pCut / machine.efficiency
    torque = torqueFromPower(pCut, rpm)
    Ft     = cuttingForce(pCut, D, rpm); Fr = 0.4 * Ft
    defl   = deflection(Fr, stickout, D, E(toolMaterial))
    warnings = checkLimits(rpm, vf, pMot, torque, defl, machine)     // §5
    return { rpm, vf, fz, mrrV, pCut, pMot, torque, Ft, Fr, defl, warnings, sfm, Deff }
```

---

## 3. Data Models & Seed Data

All data is static JSON/TS for v1. Define TypeScript interfaces in `src/data/types.ts`.

### 3.1 Material
```ts
interface Material {
  id: string;
  name: string;             // "6061-T6 Aluminum"
  isoGroup: 'P'|'M'|'K'|'N'|'S'|'H';
  hardnessBhn?: [number, number];   // Brinell range
  // SFM ranges keyed by tool material; [min, max]
  sfm: { hss?: [number,number]; carbide?: [number,number]; carbideCoated?: [number,number] };
  // Chip load (in/tooth) as a function of tool diameter — see §3.4
  chiploadByDiameter: { d_in: number; fz_in: number }[];
  unitPower: number;        // hp·min/in³  (see reference table below)
  kc?: number;              // N/mm² specific cutting force (optional, metric force calc)
  coatingMultiplier?: { tin?: number; tialn?: number; altin?: number; dlc?: number };
  notes?: string;
}
```

**Reference SFM (carbide, uncoated) and unit-power seed values** — agents: seed at least
these, expand later. SFM are mid-range starting points; store as `[min,max]`.

| Material | ISO | SFM carbide (start) | unitPower hp·min/in³ | kc N/mm² |
|---|---|---|---|---|
| 6061 Aluminum | N | 600–1200 | 0.30 | 800 |
| Brass (free-cutting) | N | 500–800 | 0.55 | 1300 |
| Mild steel 1018 | P | 300–450 | 1.10 | 1800 |
| Alloy steel 4140 (annealed) | P | 250–350 | 1.40 | 2100 |
| Tool steel (hardened ~45HRC) | H | 120–200 | 1.90 | 2600 |
| 304 Stainless | M | 200–300 | 1.50 | 2400 |
| 316 Stainless | M | 180–280 | 1.55 | 2500 |
| Gray cast iron | K | 250–400 | 0.80 | 1300 |
| Titanium Ti-6Al-4V | S | 120–200 | 1.30 | 1400 |
| Inconel 718 | S | 60–120 | 2.30 | 3200 |
| Polycarbonate/plastic | N | 500–1000 | 0.10 | 300 |

> HSS SFM ≈ 0.4–0.6 × carbide SFM. Coated carbide ≈ 1.1–1.4 × uncoated (store as
> `coatingMultiplier`). These are deliberately conservative; the manufacturer override
> (Phase 8) can supersede them.

### 3.2 Tool
```ts
type ToolType = 'flatEndmill'|'ballEndmill'|'bullEndmill'|'chamfer'|'faceMill'
              | 'drill'|'highFeedMill'|'reamer'|'tap';
type ToolMaterial = 'hss'|'cobalt'|'carbide'|'carbideCoated';
type Coating = 'none'|'tin'|'tialn'|'altin'|'dlc';

interface Tool {
  id: string;
  name: string;
  type: ToolType;
  material: ToolMaterial;
  coating: Coating;
  diameter_in: number;
  flutes: number;
  cornerRadius_in?: number;     // bull nose
  fluteLength_in: number;       // LOC — limits max DOC
  overallLength_in: number;     // OAL
  shankDiameter_in: number;     // reduced-shank detection
  stickout_in: number;          // user-set; defaults to ~3*D
  helixAngle_deg?: number;
  youngsModulus_psi?: number;   // default from material if absent
  brand?: string; series?: string;   // for manufacturer override matching
}
```

### 3.3 Machine
```ts
interface Machine {
  id: string;
  name: string;
  maxRpm: number;
  minRpm: number;
  maxPower_hp: number;
  efficiency: number;              // default 0.80
  maxFeed_ipm: number;
  // Optional power/torque curve: power available drops below "base" RPM.
  // Model as: constant torque below baseRpm, constant power above.
  baseRpm?: number;                // RPM where full power becomes available
  maxTorque_lbft?: number;
  rigidity?: 'light'|'medium'|'rigid';   // scales aggressive presets
  discreteRpms?: number[];         // gearbox/manual machines snap to these
  taper?: string;                  // "BT30", "CAT40", "R8" (display only)
}
```
Power-at-RPM model (for limit checking):
```
availablePower(rpm) =
   rpm >= baseRpm ? maxPower_hp
                  : maxPower_hp * (rpm / baseRpm)     // torque-limited region
```

### 3.4 Chip-load-by-diameter interpolation (`pickChipload`)
Chip load grows with tool diameter. Store a small table per material and **linearly
interpolate** (clamp at the ends). Example table for 6061 aluminum (carbide):

| d (in) | fz (in/tooth) |
|---|---|
| 0.0625 | 0.0005 |
| 0.125 | 0.0010 |
| 0.250 | 0.0020 |
| 0.500 | 0.0030 |
| 0.750 | 0.0040 |
| 1.000 | 0.0050 |

`pickChipload(material, d)` → interpolate between the bracketing rows; clamp below the
first / above the last. Then apply the performance multiplier (§5.2).

### 3.5 Suggested engagement defaults (`suggestEngagement`)
Reasonable starting DOC/WOC when the user hasn't specified, by strategy:

| Strategy | ae (WOC) | ap (DOC) |
|---|---|---|
| Conventional slotting | 1.0 × D | 0.5–1.0 × D |
| Conventional profiling | 0.3–0.5 × D | 1.0 × D |
| HSM / trochoidal | 0.05–0.15 × D | 1.5–2.5 × D |

Clamp `ap ≤ tool.fluteLength_in`; warn if the requested DOC exceeds flute length.

---

## 4. Tech Stack & Architecture

Chosen for low-friction implementation by simpler agents and zero backend for v1.

- **Framework:** React + TypeScript via **Vite**.
- **Styling:** Tailwind CSS. (See the `frontend-design` notes referenced in §9 for visual
  direction — favor a clean, instrument-panel/dense-data aesthetic, not a marketing page.)
- **State:** local React state + a small **Zustand** store for the active tool/material/machine/inputs.
- **Persistence (Phase 6):** `localStorage` via a thin `storage.ts` wrapper.
  ⚠️ *If previewing inside a Claude Artifact, `localStorage` is unavailable — keep a
  `MemoryStorage` fallback so the calculator still runs in-memory there.*
- **Math:** plain TS; no heavy libraries. (Optional `mathjs` only if needed.)
- **Testing:** **Vitest** for the engine. Engine tests are mandatory and gate every phase.
- **Charts (Phase 5+):** lightweight (e.g. `recharts`) for the torque/power curve only.
- **Hosting:** static deploy (Vercel/Netlify/GitHub Pages). No server until accounts exist.

### 4.1 Folder layout (target)
```
src/
  engine/            # pure calc functions + their tests (Phase 1)
    units.ts
    milling.ts
    chipThinning.ts
    power.ts
    deflection.ts
    index.ts
    __tests__/
  data/
    types.ts
    materials.ts
    tools.ts
    machines.ts
  store/             # zustand store
  components/        # UI (Phase 3+)
    InputPanel/
    ResultsPanel/
    PerformanceSlider/
    LimitWarnings/
    libraries/       # saved tools/machines (Phase 6)
  lib/storage.ts
  App.tsx  main.tsx
```

### 4.2 Hard architectural rules (give these verbatim to UI agents)
1. **The engine is pure and unit-canonical.** No React, no DOM, no `localStorage` inside `engine/`.
2. **One source of truth for state** (the store). Components read/derive; they don't recompute formulas.
3. **Convert at the boundary.** UI may display metric; the engine receives canonical imperial.
4. **No `<form>` submit navigation**; use controlled inputs + `onChange`.
5. **Never block on invalid input** — show the last valid result plus an inline validation hint.

---

## 5. Machine Limits, Performance Slider & Balancing (Phase 5 detail)

### 5.1 Limit checking & clamping (`checkLimits`, `clampRpmToMachine`, `clampFeedToMachine`)
Produce a typed list of warnings; clamp outputs to machine capability:
- **RPM > maxRpm:** clamp RPM to `maxRpm`, recompute the *actual* SFM, warn "RPM capped — surface speed reduced."
- **RPM < minRpm:** raise to `minRpm`, warn.
- **discreteRpms set:** snap to nearest available; recompute feed.
- **Feed > maxFeed_ipm:** clamp, warn "Feed capped by machine."
- **P_motor > availablePower(rpm):** warn "Insufficient spindle power"; offer auto-reduce (see §5.3).
- **Torque > maxTorque_lbft:** warn.
- **Deflection > limit:** warn "High deflection — reduce stickout / DOC / feed."

Each warning: `{ severity: 'info'|'warn'|'danger', field, message, suggestedFix? }`.

### 5.2 Performance slider
A 0–100 slider mapping to a multiplier set applied to SFM and chip load:

| Slider | Label | SFM ×  | Chipload × | Engagement |
|---|---|---|---|---|
| 0–25 | Conservative | 0.80 | 0.80 | low ae/ap |
| 26–60 | Balanced (default ~50) | 1.00 | 1.00 | default |
| 61–85 | Aggressive | 1.15 | 1.20 | higher |
| 86–100 | Max | 1.30 | 1.35 | max |

Scale the aggressive end down for `machine.rigidity === 'light'` (e.g. cap multiplier at 1.10).

### 5.3 DOC ↔ WOC balancing against available power
Mirror HSM Advisor's behavior: when the user changes one of DOC/WOC, or when power is
exceeded, solve for the other so that `P_motor ≈ availablePower`:
```
target P_cut = availablePower(rpm) * efficiency
target MRR   = target P_cut / unitPower
// hold ae fixed, solve ap (or vice-versa):
ap_max = target MRR / (ae * vf)
```
Clamp `ap_max ≤ fluteLength`. Present the suggested value and let the user accept it.
Provide two buttons: **"Maximize DOC (hold WOC)"** and **"Maximize WOC (hold DOC)."**

---

## 6. UI / UX Specification

A single-screen, two-column "calculator console." No page navigation needed for the core.

### 6.1 Layout
```
┌───────────────────────────── Header: app name · unit toggle (IN|MM) · disclaimer link ─┐
├──────────────── Left: INPUTS ───────────────┬──────────── Right: RESULTS ──────────────┤
│ Operation: [Milling ▾] (Drill/Turn later)   │  RPM            ####                       │
│ Material   [ search/select ▾ ]              │  Feed rate      ##.## IPM                  │
│ Tool       [ select ▾ ] [+ new]             │  Chip load (adj) 0.0050 in                 │
│   type, dia, flutes, material, coating      │  MRR            #.## in³/min               │
│   stickout, flute length, corner radius     │  Spindle power  #.## hp (of X hp)          │
│ Machine    [ select ▾ ] [+ new]             │  Torque         #.## lb-ft                 │
│ Cut geometry: DOC ___  WOC ___              │  Cutting force  ## lbf                     │
│   [Maximize DOC] [Maximize WOC]             │  Deflection     0.0001 in                  │
│ Performance: [====●========] Balanced       │  ── Warnings ─────────────────────────    │
│                                             │  ⚠ Feed capped by machine                  │
└─────────────────────────────────────────────┴───────────────────────────────────────────┘
```

### 6.2 Behavior
- **Live recompute** on any input change (debounced ~150 ms).
- **Per-field unit awareness:** a global IN|MM toggle for v1; per-field toggle is a P3 nicety.
- **Color cues:** results turn amber/red when a related warning fires; green when a
  manufacturer override is active (Phase 8).
- **Empty/invalid input:** keep last good result; show inline hint, don't crash.
- **Mobile:** stack columns; inputs first, results sticky at bottom.

### 6.3 Components to build (Phase 3)
`UnitToggle`, `OperationSelect`, `MaterialSelect` (searchable), `ToolEditor`,
`MachineEditor`, `GeometryInputs`, `PerformanceSlider`, `ResultsPanel`, `ResultRow`,
`WarningList`, `DisclaimerBanner`.

---

## 7. Implementation Phases (agent-sized tasks with acceptance criteria)

Each task is small and independently verifiable. **Definition of done = acceptance criteria
pass + engine tests still green.**

### Phase 0 — Scaffold
- **0.1** Init Vite + React + TS + Tailwind + Vitest. *AC:* `npm run dev` serves a blank app; `npm test` runs.
- **0.2** Create folder layout from §4.1 with empty stubs. *AC:* imports resolve, build passes.

### Phase 1 — Calculation engine (no UI)
- **1.1** `units.ts` with §2.1 conversions. *AC:* round-trip tests (in→mm→in) within 1e-9.
- **1.2** `rpmFromSurfaceSpeed`, `surfaceSpeedFromRpm`, `feedRate`. *AC:* matches §2.2/§2.3 examples.
- **1.3** `radialChipThinningFactor` + ceiling clamp. *AC:* matches all §2.5 examples.
- **1.4** `effectiveDiameter` (ball + bull). *AC:* matches §2.6 example; `ap≥R ⇒ Deff=D`.
- **1.5** `mrr`, `spindlePower`, `torqueFromPower`. *AC:* §2.7–2.9 examples.
- **1.6** `cuttingForce`, `deflection`. *AC:* §2.10–2.11 examples (±2%).
- **1.7** `computeMilling` orchestrator (§2.13), no machine clamping yet. *AC:* full pipeline on the worked example returns the documented RPM/feed/MRR/power/deflection set.

### Phase 2 — Data
- **2.1** `types.ts` interfaces (§3). *AC:* compiles.
- **2.2** Seed `materials.ts` with the §3.1 table + chipload tables (§3.4). *AC:* ≥10 materials, each validated by a schema test.
- **2.3** `pickSFM`, `pickChipload` (interpolation). *AC:* interpolation midpoint test; clamp at ends.
- **2.4** Seed `tools.ts` (≥6 generic tools) and `machines.ts` (≥3: a hobby mill ~1hp, a VMC ~20hp, a router). *AC:* schema tests pass.

### Phase 3 — Core UI
- **3.1** Store (Zustand) holding inputs + selected material/tool/machine. *AC:* updating an input rerenders results.
- **3.2** Inputs column components (§6.3). *AC:* all inputs controlled; IN/MM toggle converts display.
- **3.3** Results panel wired to `computeMilling`. *AC:* the §2 worked example reproduces on screen.
- **3.4** Disclaimer banner (§0.4) always visible. *AC:* present on load.

### Phase 4 — Advanced calc surfaced in UI
- **4.1** Show adjusted chip load + radial thinning factor. *AC:* dropping WOC raises feed per §2.5.
- **4.2** Effective-diameter handling for ball/bull tools in UI. *AC:* ball tool at shallow DOC lowers RPM.
- **4.3** Power, torque, force, deflection rows. *AC:* values match engine; deflection warning fires past limit.

### Phase 5 — Machine limits, slider, balancing
- **5.1** `checkLimits` + `clamp*` (§5.1) integrated into orchestrator. *AC:* over-speed clamps + warns.
- **5.2** `availablePower(rpm)` curve + power warning. *AC:* high MRR on the 1hp machine warns.
- **5.3** Performance slider (§5.2). *AC:* moving to Aggressive raises SFM/feed by the documented factors.
- **5.4** DOC/WOC balancing buttons (§5.3). *AC:* "Maximize DOC" yields P_motor ≈ available power (±5%).

### Phase 6 — Persistence & libraries
- **6.1** `storage.ts` (localStorage + MemoryStorage fallback). *AC:* survives reload; works in-memory when storage blocked.
- **6.2** Save/load/delete tools, machines, and named "jobs" (full input snapshot). *AC:* CRUD round-trips.
- **6.3** Import/export library as JSON. *AC:* export then re-import reproduces identical state.

### Phase 7 — More operations & long-tool compensation
- **7.1** **Drilling** mode: RPM from SFM on drill dia; feed = RPM × feed/rev; peck distance suggestion by hole depth. *AC:* documented drill example.
- **7.2** **Turning** mode: constant-surface-speed RPM at a turned diameter; feed/rev; DOC. *AC:* turning example.
- **7.3** Long-tool/reduced-shank compensation: when stickout > k·D or shank < D, scale down RPM/feed and cap DOC; account for flute length. *AC:* increasing stickout lowers feed and raises deflection warning.

### Phase 8 — Overrides, export, polish
- **8.1** Manufacturer S&F override: match by tool `brand`+`series`; when present, use their table and show a green "Mfr" badge. *AC:* override supersedes computed SFM/chipload.
- **8.2** HSM/trochoidal mode: low ae, high ap defaults + thinning; show MRR gain. *AC:* HSM preset produces higher MRR at equal power.
- **8.3** Copy-results button + shareable URL (encode inputs in query string). *AC:* pasted URL reconstructs the calculation.
- **8.4** Torque/power curve chart for the selected machine. *AC:* curve renders; operating point marked.

---

## 8. Testing Strategy

- **Engine unit tests are the backbone.** Every formula in §2 ships with the worked example
  as a test on the same commit. CI must run `npm test` and block merges on failure.
- **Golden-vector file** (`engine/__tests__/vectors.ts`): a table of input→expected-output
  rows (start with the two worked examples below). Add a row whenever a calc is touched.
- **Property tests** (nice-to-have): RPM is monotonic-decreasing in diameter; feed is
  monotonic-increasing in flutes; RCTF ≥ 1 and = 1 at `ae = D/2`.
- **Boundary tests:** `ae → 0` (RCTF hits ceiling), `ap ≥ R` (Deff = D), zero/negative
  inputs (engine returns a typed error, never `NaN`).
- **No-NaN guarantee:** a test that feeds randomized but in-range inputs and asserts all
  outputs are finite numbers.

### 8.1 Golden vectors (seed these first)
**Vector A — Aluminum, 1/2" 4FL carbide, full-width finish-ish:**
in: `SFM 600, D 0.5", Z 4, fz 0.003", ae 0.05", ap 0.5", unitPower 0.30, eff 0.80, stickout 1.5", E 90e6, fluteFactor 0.8`
→ `RPM 4583.66 · RCTF 1.6667 · fz_adj 0.0050 · feed 91.67 IPM · MRR 2.292 in³/min · P_cut 0.688 hp · P_motor 0.859 hp · torque 0.788 lb-ft · Ft 37.8 lbf · Fr 15.1 lbf · deflection 0.00015 in`

**Vector B — Mild steel, 10 mm 4FL carbide (metric, convert at boundary):**
in: `Vc 120 m/min, D 10 mm, Z 4, fz 0.05 mm, ae 5 mm (=0.5D), ap 5 mm`
→ `RPM ≈ 3819.7 · RCTF 1.000 · feed ≈ 763.9 mm/min` (verify power via metric kc formula in §2.8).

---

## 9. Notes & Conventions for Implementing Agents

- **When in doubt, be conservative and warn.** A too-slow recommendation is safe; a too-fast
  one breaks tools. Never silently exceed a machine or deflection limit.
- **Keep the engine framework-free and fully unit-tested before touching the UI.** Most
  defects in this kind of app come from mixing unit systems mid-calculation — don't.
- **Do not invent material data.** Use the seed tables here; mark anything added later with a
  source. The manufacturer-override path (8.1) is the sanctioned way to get precise numbers.
- **Frontend visual direction:** consult the project's `frontend-design` guidance and aim for
  a dense, legible "machine instrument" look (monospace numerics, clear units, restrained
  color used only for state/warnings) rather than a generic SaaS landing style.
- **Accessibility:** numeric inputs need labels + units; warnings must be text, not color-only.
- **Definition of done for any task:** acceptance criteria met **and** `npm test` green **and**
  no `NaN`/`Infinity` reachable from valid inputs.

---

## 10. Future / Stretch (post-v1)
- User accounts + cloud sync of libraries (introduces a backend; out of scope for v1).
- Tool-life (Taylor's equation) estimation with material constants.
- Per-field independent unit selection (HSM Advisor parity).
- Helical/ramp entry and circular-interpolation feed compensation.
- High-feed-mill chip-thinning geometry (lead-angle based).
- Coolant/strategy presets; cost-per-part estimate.
- Community-shared material and tool packs.

---

*End of plan. Build Phase 1 first, prove it with the golden vectors, then layer the UI on top.*
