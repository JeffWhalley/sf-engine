/**
 * Long-tool / reduced-shank compensation — Phase 7 T3 (PLAN.md §7.3,
 * LAUNCH-PLAN.md §4 T3).
 *
 * Pure derating math: given the tool's stickout-to-diameter ratio (and an
 * optionally reduced shank), produce multiplicative derates for feed, RPM and
 * axial DOC. The data layer applies them BEFORE machine-limit clamping; the
 * deflection model (deflection.ts) then reports the resulting tip deflection
 * as usual, so the two mechanisms stay independent and composable.
 *
 * ── Model (documented judgment call — **[HUMAN] review, standing rule 6**) ──
 * Tip deflection of a cantilever grows with L³ at constant force. Up to
 * NORMAL_STICKOUT_RATIO (3×D — the conventional "standard stickout") no
 * derating is applied. Beyond it, we hold predicted deflection roughly
 * constant by shedding cutting force across BOTH feed and DOC:
 *
 *   over        = (L/D) / 3                     (how far past normal, ≥ 1)
 *   feedFactor  = apFactor = over^-1.5          (force ∝ feed·DOC → force·L³ ≈ const)
 *   rpmFactor   = over^-0.5                     (chatter margin, mild)
 *
 * floors: feed/ap 0.25, rpm 0.7 — past those the advice is "fix the setup,
 * not the parameters", and a warning says so.
 *
 * Reduced shank (shank Ø < cutting Ø): stiffness goes with d⁴, so the shank
 * is the weak section. Extra feed derate = (shank/D)² (bounded ≥ 0.5) — the
 * square (not 4th power) because the weak section is only part of the beam.
 *
 * Invalid input throws EngineError; results are always finite.
 */

import { EngineError, requirePositive } from './validate';

/** Conventional "standard" stickout; at or below this, no derating. */
export const NORMAL_STICKOUT_RATIO = 3;
/** Below these floors we stop deratings and tell the user to re-fixture. */
export const MIN_FEED_FACTOR = 0.25;
export const MIN_RPM_FACTOR = 0.7;
const MIN_SHANK_FACTOR = 0.5;

export interface LongToolInput {
  /** Length protruding from the holder, inches. */
  stickout_in: number;
  /** Cutting diameter, inches. */
  diameter_in: number;
  /** Shank diameter, inches — enables reduced-shank detection. */
  shankDiameter_in?: number;
}

export interface LongToolAssessment {
  /** Stickout / diameter. */
  stickoutRatio: number;
  /** True if any derating applies. */
  derated: boolean;
  /** True if the shank is thinner than the cutting diameter. */
  reducedShank: boolean;
  /** Multiply feed (chip load) by this. ≤ 1. */
  feedFactor: number;
  /** Multiply RPM (via surface speed) by this. ≤ 1. */
  rpmFactor: number;
  /** Multiply axial DOC by this. ≤ 1. */
  apFactor: number;
  /** Advisory strings for the warning list. */
  warnings: string[];
}

export function assessLongTool(input: LongToolInput): LongToolAssessment {
  const { stickout_in, diameter_in, shankDiameter_in } = input;
  requirePositive(stickout_in, 'stickout_in');
  requirePositive(diameter_in, 'diameter_in');
  if (shankDiameter_in !== undefined) requirePositive(shankDiameter_in, 'shankDiameter_in');

  const ratio = stickout_in / diameter_in;
  const warnings: string[] = [];

  let feedFactor = 1;
  let rpmFactor = 1;

  if (ratio > NORMAL_STICKOUT_RATIO) {
    const over = ratio / NORMAL_STICKOUT_RATIO;
    feedFactor = Math.pow(over, -1.5);
    rpmFactor = Math.max(MIN_RPM_FACTOR, Math.pow(over, -0.5));
    if (feedFactor < MIN_FEED_FACTOR) {
      feedFactor = MIN_FEED_FACTOR;
      warnings.push(
        `Extreme stickout (${ratio.toFixed(1)}×D): derating floored — shorten the tool, ` +
          `choke up in the holder, or use a larger shank instead of cutting parameters.`,
      );
    } else {
      warnings.push(
        `Long tool (${ratio.toFixed(1)}×D stickout): feed & DOC reduced to ` +
          `${Math.round(feedFactor * 100)}%, RPM to ${Math.round(rpmFactor * 100)}%, ` +
          `to hold tip deflection near standard-stickout levels.`,
      );
    }
  }

  let reducedShank = false;
  if (shankDiameter_in !== undefined && shankDiameter_in < diameter_in) {
    reducedShank = true;
    const shankRatio = shankDiameter_in / diameter_in;
    const shankFactor = Math.max(MIN_SHANK_FACTOR, shankRatio * shankRatio);
    feedFactor *= shankFactor;
    warnings.push(
      `Reduced shank (Ø${shankDiameter_in}" < cutting Ø${diameter_in}"): the shank is the ` +
        `weak section — feed further reduced to ${Math.round(feedFactor * 100)}% of base.`,
    );
  }

  const apFactor = feedFactor; // force is shed equally across feed and DOC

  const result: LongToolAssessment = {
    stickoutRatio: ratio,
    derated: feedFactor < 1 || rpmFactor < 1,
    reducedShank,
    feedFactor,
    rpmFactor,
    apFactor,
    warnings,
  };
  for (const [k, v] of Object.entries(result)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new EngineError(`internal: non-finite ${k}`);
    }
  }
  return result;
}
