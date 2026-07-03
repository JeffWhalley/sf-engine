# Launch Asset Drafts — Phase 15 prep

**[HUMAN] must edit, personalize, and approve every word before anything is
posted.** Placeholders: {APP}, {URL}, {YOURNAME}. Read each forum's
self-promotion rules first (LAUNCH-PLAN Phase 15 step 2).

---

## Draft A — r/hobbycnc / r/Machinists (builder voice)

> **Title:** I built a free speeds & feeds calculator that runs in the browser — tear it apart
>
> Machinist here. I got tired of juggling spreadsheets and app licenses across
> shop PCs, so I built {APP}: a speeds & feeds calculator that runs entirely
> in your browser — nothing installs, nothing uploads, works offline once
> loaded.
>
> It does milling, drilling, and turning: RPM/feed from real SFM and chip-load
> data, radial chip thinning, effective diameter on ball/bull noses, power,
> torque, cutting force, and tool deflection, with machine-limit warnings and
> a conservative↔aggressive slider. Every recipe encodes into the URL, so you
> can share an exact setup like this: {URL}#{example}
>
> The numbers are conservative starting points, not gospel — it tells you that
> in the app too. What I'd genuinely like from this crowd: run your usual
> cuts through it and tell me where the recommendations are off. Material data
> corrections are the most valuable feedback I can get.
>
> Free tier is free forever (that's not a trial). There's a paid tier for the
> full material library and cloud sync, which is how I keep the lights on —
> but everything in this post works without paying or even signing up.

## Draft B — Practical Machinist (more technical voice)

> **Title:** New browser-based speeds/feeds calculator — looking for data corrections from working machinists
>
> I've built a speeds & feeds calculator ({URL}) and before pushing it
> further I want it checked against real shop practice, not just handbook
> math. The engine computes: RPM/feed from material SFM windows and
> diameter-interpolated chip loads, radial chip-thinning compensation,
> effective diameter for ball/bull end mills, MRR, spindle power/torque
> against machine profiles, cutting force, and cantilever tip deflection
> with stickout. Drilling adds thrust estimates and peck advice; turning
> adds achieved-SFM under RPM caps and theoretical Ra from nose radius.
>
> All figures deliberately land on the conservative end and it warns rather
> than silently clamping. If you run a cut and the recommendation is
> meaningfully wrong for your setup, that's exactly what I want to hear —
> material, tool, machine, and what you actually ran.

## Draft C — Show HN (one paragraph)

> **Show HN: {APP} — speeds & feeds calculator for CNC machining, runs in the browser**
>
> Physics-based cutting-parameter calculator (milling/drilling/turning):
> pure-TypeScript engine, ~170 unit tests with golden vectors from handbook
> worked examples, all client-side — shared setups encode into the URL
> fragment so nothing touches a server. Free tier is permanent; revenue is a
> Pro tier (full material DB, sync) and a lifetime-license desktop build
> (Tauri) with fully offline Ed25519 license verification, because machine
> shops don't trust phone-home software. Happy to answer questions about the
> chip-thinning math or the no-DRM licensing design.

## FAQ skeleton (for the site)

- **Is the free tier a trial?** No. It's free permanently: full milling
  calculator, {N} common materials, limited saved libraries.
- **Where does my data go?** Nowhere, unless you sign in to sync or click
  share. Calculations run in your browser. Share links encode the setup in
  the URL fragment, which never reaches our server.
- **Can I trust the numbers?** They're conservative starting points computed
  from standard machining formulas — always verify against your tool
  manufacturer's data and your machine. The app shows this disclaimer
  because it's true, not because lawyers made us.
- **Offline?** Yes — the web app works offline after first load (PWA), and
  the desktop app is offline-first. Lifetime desktop licenses verify locally
  and never phone home.
- **Refunds?** 14 days, no questions.
- **I found wrong data for material X.** Please tell us — data corrections
  get priority and credit.
