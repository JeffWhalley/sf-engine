# Running & Testing the Feeds & Speeds App

Everything lives in the `sf-engine` folder (the zip is a backup of the same
thing). The app is a static web app — there is no backend, no database, and no
account needed. Nothing to "install" beyond Node.js.

## 1. One-time setup

1. Install **Node.js 20 LTS** (18+ works) from https://nodejs.org — the
   Windows installer includes npm.
2. Open a terminal (PowerShell is fine) in the `sf-engine` folder:

   ```powershell
   cd "$env:USERPROFILE\Documents\claudecowork\sf-engine"
   npm install
   ```

   This downloads dependencies into `node_modules` (~2 min). You only redo it
   if `package.json` changes.

## 2. Run it for testing (dev server)

```powershell
npm run dev
```

Vite prints a local URL — usually **http://localhost:5173**. Open it in your
browser. Edits to source files hot-reload instantly. `Ctrl+C` stops it.

## 3. Production build (what would actually ship)

```powershell
npm run build      # outputs the finished site into dist/
npm run preview    # serves dist/ at a local URL so you can test the real build
```

The production build is also a **PWA**: in Chrome/Edge you'll get an install
icon in the address bar, and once loaded it works fully offline. (Offline +
install only work in `preview`/deployed builds, not `npm run dev`.)

You can also just double-click `dist/index.html` after a build — the app is
configured with relative paths so it runs straight off the filesystem
(the service worker/PWA parts stay dormant that way, which is fine for
testing the calculator).

## 4. Verify the code is healthy

```powershell
npm test            # 301 tests, all should pass
npm run typecheck   # TypeScript strict check, should print nothing
```

## 5. What to poke at while testing

- **Mill / Drill / Turn** switcher (top right) — material & machine carry
  across modes.
- **Engagement presets** Slot / Profile / HSM — HSM shows the MRR-gain note
  and boosts surface speed 1.5×.
- **Stickout** — raise it past 3×D and watch feed/RPM derate with a warning.
- **Machine picker** — "Start from a preset…" (Tormach, Haas, routers…), and
  "Duplicate & edit…" to build your own machine, including fixed gearbox
  speeds.
- **Tool panel** — "Duplicate & edit…" for the full tool editor. The 3/8" 3FL
  aluminum tool demos the **"Using Example Tooling data"** manufacturer badge.
- **Share / Copy / Sheet** buttons in the header — Share puts a link on the
  clipboard that reproduces the exact setup on any machine; Sheet is the
  printable one-page setup sheet with QR code (print → Save as PDF).
- **Unit handling** — the global IN/MM toggle, plus click any field's
  underlined in/mm suffix to flip just that field.
- **Library panel** — save jobs, export/import JSON, and the License section
  (nothing can activate yet: the shipped public key is a placeholder until a
  real keypair is generated — that's intentional).

## 6. Known caveats

- All cutting data are conservative **starting points** flagged for human
  review (`docs/TODO.md` lists every `[HUMAN]` item) — verify against
  manufacturer data before real cuts.
- Tool-life / thrust figures are estimates only, and say so in the UI.
- The bundle warns about chunk size at build time (recharts); harmless.

## 7. Where things live

| Path | What |
|---|---|
| `src/engine/` | Pure calculation engine (milling, drilling, turning, tool life, derating) |
| `src/data/` | Materials, tools, machines, presets, seeds, resolvers, limits |
| `src/components/` | React UI |
| `docs/PLAN.md`, `docs/LAUNCH-PLAN.md` | Build & launch plans |
| `docs/TODO.md` | Live checklist incl. all `[HUMAN]` review items |
| `CLAUDE.md` | Handoff notes for the next working session |
