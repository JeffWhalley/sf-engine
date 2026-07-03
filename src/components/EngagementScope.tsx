import { useEffect, useRef } from 'react';
import type { MillingResult } from '../engine';
import { inToMm } from '../engine';
import type { Tool } from '../data';
import type { UnitSystem } from '../ui/format';

/**
 * Phase 9 T1 — respects prefers-reduced-motion: when reduced (or when
 * matchMedia is unavailable, e.g. tests), the scope renders fully static.
 */
function prefersReducedMotion(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Visualizes the "advanced" milling physics so the numbers make sense:
 *  - radial engagement (how much of the tool diameter is in the cut)
 *  - the radial chip-thinning boost that engagement produces
 *  - base -> adjusted feed per tooth
 *  - effective cutting diameter for ball/bull tools at shallow depth
 */
export function EngagementScope({
  result,
  tool,
  ae_in,
  sys,
}: {
  result: MillingResult;
  tool: Tool;
  ae_in: number;
  sys: UnitSystem;
}) {
  const D = tool.diameter_in;
  const frac = Math.max(0, Math.min(1, ae_in / D));
  const pct = frac * 100;
  const rctf = result.radialChipThinningFactor;
  const baseFz_in = result.chipload_in / rctf;

  const fzUnit = sys === 'metric' ? 'mm' : 'in';
  const fz = (v: number) =>
    sys === 'metric' ? inToMm(v).toFixed(3) : v.toFixed(4);
  const dia = (v: number) =>
    sys === 'metric' ? `${inToMm(v).toFixed(2)} mm` : `${v.toFixed(3)} in`;

  // SVG geometry (schematic — fixed pixel radius, not to scale)
  const cx = 52;
  const cy = 60;
  const r = 44;
  const planeX = cx + r - 2 * r * frac; // material edge; strip [planeX, cx+r] is engaged
  const effRing = result.effectiveDiameter_in < D - 1e-9;
  const effR = (result.effectiveDiameter_in / D) * r;

  // Phase 9 T1 — rAF-driven cutter rotation (visual speed ~log of rpm).
  const fluteGroup = useRef<SVGGElement | null>(null);
  const rpm = result.rpm;
  useEffect(() => {
    if (prefersReducedMotion() || !fluteGroup.current) return;
    const revPerSec = Math.min(2, Math.max(0.4, Math.log10(Math.max(10, rpm)) / 2.2));
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const deg = (((t - t0) / 1000) * revPerSec * 360) % 360;
      fluteGroup.current?.setAttribute('transform', `rotate(${deg} ${cx} ${cy})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpm]);

  const fluteAngles = Array.from({ length: Math.max(1, tool.flutes) }, (_, i) => (360 / Math.max(1, tool.flutes)) * i);

  return (
    <div className="panel p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="engraved text-[11px]">Engagement</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-[120px] w-[120px] shrink-0" role="img" aria-label="Radial engagement diagram">
          <defs>
            <clipPath id="toolclip">
              <circle cx={cx} cy={cy} r={r} />
            </clipPath>
            {/* chip-thinning gradient: chip is thinnest at entry, full at the edge */}
            <linearGradient id="thinning" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#47c7bd" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#47c7bd" stopOpacity="0.38" />
            </linearGradient>
          </defs>
          {/* tool body */}
          <circle cx={cx} cy={cy} r={r} fill="#1b2026" stroke="#3a424a" strokeWidth={1.5} />
          {/* engaged material (clipped to tool circle) */}
          <rect
            x={planeX}
            y={cy - r}
            width={cx + r - planeX}
            height={2 * r}
            fill="url(#thinning)"
            clipPath="url(#toolclip)"
          />
          {/* material edge */}
          <line x1={planeX} y1={cy - r} x2={planeX} y2={cy + r} stroke="#47c7bd" strokeWidth={1.5} clipPath="url(#toolclip)" />
          {/* cutting-circle outline + center */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#47c7bd" strokeWidth={1.5} opacity={0.5} />
          {/* effective diameter ring for ball/bull at shallow depth */}
          {effRing && (
            <circle cx={cx} cy={cy} r={effR} fill="none" stroke="#e6a23c" strokeWidth={1.5} strokeDasharray="3 2" />
          )}
          {/* rotating flutes (static under prefers-reduced-motion) */}
          <g ref={fluteGroup} data-testid="flutes" clipPath="url(#toolclip)">
            {fluteAngles.map((a) => (
              <line
                key={a}
                x1={cx}
                y1={cy}
                x2={cx + (r - 3) * Math.cos((a * Math.PI) / 180)}
                y2={cy + (r - 3) * Math.sin((a * Math.PI) / 180)}
                stroke="#3a424a"
                strokeWidth={1.5}
              />
            ))}
          </g>
          <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="#727c85" strokeWidth={1} />
          <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke="#727c85" strokeWidth={1} />
        </svg>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="font-mono text-[22px] leading-none text-ink">
              {pct.toFixed(0)}
              <span className="ml-1 text-[12px] text-ink-3">% of Ø</span>
            </div>
            <div className="engraved mt-0.5 text-[10px]">Radial engagement</div>
          </div>

          <div className="flex items-baseline gap-2 text-[12px]">
            <span className="engraved text-[10px]">Chip thinning</span>
            <span className={`font-mono ${rctf > 1.001 ? 'text-accent' : 'text-ink-3'}`}>
              ×{rctf.toFixed(2)}
            </span>
          </div>

          <div className="text-[12px]">
            <div className="engraved text-[10px]">Feed / tooth</div>
            <div className="font-mono text-ink-2">
              {fz(baseFz_in)}
              <span className="mx-1 text-ink-3">→</span>
              <span className="text-accent">{fz(result.chipload_in)}</span>
              <span className="ml-1 text-[11px] text-ink-3">{fzUnit}/t</span>
            </div>
          </div>

          {effRing && (
            <p className="text-[11px] leading-snug text-warn">
              Tip engagement only — effective Ø {dia(result.effectiveDiameter_in)} (of{' '}
              {dia(D)}). Speed is set from the effective diameter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
