/**
 * Parameter sweep — Phase 9, T2 / feature F4 (LAUNCH-PLAN.md §4).
 *
 * Runs any compute function across a swept input variable and returns chart-
 * ready series. Engine-agnostic by design (dependency injection): works with
 * computeMilling / computeDrilling / computeTurning / calculate() unchanged.
 *
 * Error semantics: a single invalid point (engine throws, e.g. a WOC sweep
 * wandering past a validity edge) must NOT kill the chart — that point is
 * returned as { error } and the UI renders a gap. Anything non-Error thrown
 * is re-thrown (programming bug, not a validity edge).
 *
 * Perf contract (Phase 9 AC): pure + allocation-light; callers throttle
 * slider-driven recomputes. 101-point sweeps of the real engine run in well
 * under a frame (see perf smoke test).
 */

export interface SweepPoint<TOut> {
  /** The swept variable's value at this sample. */
  x: number;
  /** Present iff compute succeeded. */
  result?: TOut;
  /** Present iff compute threw an Error (validity edge). */
  error?: string;
}

export interface SweepSeries<TOut> {
  points: Array<SweepPoint<TOut>>;
  /** Count of failed points, for a UI badge ("3 points out of range"). */
  errorCount: number;
}

/** Inclusive linear range with `steps` samples (steps >= 2). */
export function linspace(from: number, to: number, steps: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error('linspace: from/to must be finite');
  }
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`linspace: steps must be an integer >= 2, got ${steps}`);
  }
  const out = new Array<number>(steps);
  const dx = (to - from) / (steps - 1);
  for (let i = 0; i < steps; i++) out[i] = from + dx * i;
  out[steps - 1] = to; // exact endpoint, no FP drift
  return out;
}

/**
 * Sweep `xs`, building each input with `apply(base, x)` (must NOT mutate
 * base — return a new input) and running `compute` on it.
 */
export function sweep<TIn, TOut>(
  base: TIn,
  xs: readonly number[],
  apply: (base: TIn, x: number) => TIn,
  compute: (input: TIn) => TOut,
): SweepSeries<TOut> {
  const points: Array<SweepPoint<TOut>> = new Array(xs.length);
  let errorCount = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    try {
      points[i] = { x, result: compute(apply(base, x)) };
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      points[i] = { x, error: e.message };
      errorCount++;
    }
  }
  return { points, errorCount };
}

/**
 * Convenience: extract one numeric metric into [x, y] pairs, skipping error
 * points — exactly the shape recharts wants.
 */
export function extractSeries<TOut>(
  series: SweepSeries<TOut>,
  pick: (result: TOut) => number,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const p of series.points) {
    if (p.result !== undefined) out.push({ x: p.x, y: pick(p.result) });
  }
  return out;
}
