/**
 * Advisory warnings for Phase 3. These are *advisory only* — they flag when a
 * recommendation runs past a machine or tool limit but do NOT yet clamp the
 * output. The typed warning structure + clamping arrives in Phase 5 (PLAN §5.1).
 */

import type { MillingResult } from '../engine';
import type { Machine, Tool, LimitedResult } from '../data';
import type { UnitSystem } from './format';
import { fmt, powerToDisplay, powerUnit } from './format';

export type Severity = 'info' | 'warn' | 'danger';

export interface Advisory {
  severity: Severity;
  message: string;
}

const DEFLECTION_LIMIT_IN = 0.001; // 1 thou

export interface AdvisoryContext {
  machine: Machine;
  tool: Tool;
  ap_in: number;
  sys: UnitSystem;
}

export function advisories(r: MillingResult, ctx: AdvisoryContext): Advisory[] {
  const { machine, tool, ap_in, sys } = ctx;
  const out: Advisory[] = [];

  if (r.rpm > machine.maxRpm) {
    out.push({
      severity: 'danger',
      message: `Spindle speed ${fmt(Math.round(r.rpm), 0)} rpm is above the machine maximum of ${fmt(machine.maxRpm, 0)} rpm.`,
    });
  } else if (r.rpm < machine.minRpm) {
    out.push({
      severity: 'warn',
      message: `Spindle speed ${fmt(Math.round(r.rpm), 0)} rpm is below the machine minimum of ${fmt(machine.minRpm, 0)} rpm.`,
    });
  }

  if (r.feed_ipm > machine.maxFeed_ipm) {
    out.push({
      severity: 'warn',
      message: `Feed exceeds the machine's maximum table feed (${fmt(machine.maxFeed_ipm, 0)} in/min).`,
    });
  }

  if (r.motorPower_hp > machine.maxPower_hp) {
    out.push({
      severity: 'danger',
      message: `Needs ${fmt(powerToDisplay(r.motorPower_hp, sys), 2)} ${powerUnit(sys)} at the spindle — more than the machine's ${fmt(powerToDisplay(machine.maxPower_hp, sys), 2)} ${powerUnit(sys)}. Reduce depth, width, or feed.`,
    });
  }

  if (r.deflection_in > DEFLECTION_LIMIT_IN) {
    const shown =
      sys === 'metric'
        ? `${fmt(r.deflection_in * 25400, 1)} µm`
        : `${fmt(r.deflection_in * 1000, 2)} thou`;
    out.push({
      severity: 'warn',
      message: `Estimated tool deflection (${shown}) is high. Shorten the stickout or reduce depth of cut.`,
    });
  }

  if (ap_in > tool.fluteLength_in) {
    out.push({
      severity: 'warn',
      message: `Axial depth is deeper than the tool's flute length (${fmt(tool.fluteLength_in, 3)} in).`,
    });
  }

  if (out.length === 0) {
    out.push({ severity: 'info', message: 'Within machine and tool limits.' });
  }
  return out;
}

// --- Phase 5: warnings from a clamped LimitedResult (supersedes advisories in the app) ---

export function buildWarnings(limited: LimitedResult, ctx: AdvisoryContext): Advisory[] {
  const { machine, tool, ap_in, sys } = ctx;
  const { result, unclamped, clampedRpm, clampedFeed, clampedPower, availablePower_hp, performanceCappedTo } =
    limited;
  const out: Advisory[] = [];

  for (const message of limited.longTool?.warnings ?? []) {
    out.push({ severity: 'warn', message });
  }

  if (performanceCappedTo != null) {
    out.push({
      severity: 'info',
      message: `Aggressiveness limited to ${performanceCappedTo}% by ${machine.rigidity} machine rigidity.`,
    });
  }

  if (limited.rpmSolvedForChipload) {
    out.push({
      severity: 'info',
      message: `RPM solved from your locked feed to hold chip load (${fmt(result.rpm, 0)} rpm, ${fmt(result.sfm, 0)} sfm achieved).`,
    });
  }

  if (clampedRpm) {
    out.push({
      severity: 'warn',
      message: `Spindle capped at ${fmt(Math.round(result.rpm), 0)} rpm (wanted ${fmt(Math.round(unclamped.rpm), 0)}). Surface speed drops accordingly.`,
    });
  }

  if (clampedFeed) {
    out.push({
      severity: 'warn',
      message: `Feed capped at the machine's ${fmt(machine.maxFeed_ipm, 0)} in/min — chip load is reduced below target.`,
    });
  }

  if (clampedPower) {
    out.push({
      severity: 'warn',
      message: `Feed reduced to ${fmt(result.feed_ipm, 1)} in/min (wanted ${fmt(unclamped.feed_ipm, 1)}) to fit the spindle's ${fmt(powerToDisplay(availablePower_hp, sys), 2)} ${powerUnit(sys)} at this RPM. For more MRR, reduce DOC/WOC instead.`,
    });
  }

  if (result.motorPower_hp > availablePower_hp + 1e-6) {
    out.push({
      severity: 'danger',
      message: `Needs ${fmt(powerToDisplay(result.motorPower_hp, sys), 2)} ${powerUnit(sys)} but only ${fmt(powerToDisplay(availablePower_hp, sys), 2)} ${powerUnit(sys)} is available at ${fmt(Math.round(result.rpm), 0)} rpm. Use "Fit DOC/WOC" or reduce engagement.`,
    });
  }

  if (machine.maxTorque_lbft != null && result.cuttingTorque_lbft > machine.maxTorque_lbft) {
    out.push({
      severity: 'warn',
      message: `Cutting torque (${fmt(result.cuttingTorque_lbft, 1)} lb·ft) is over the machine's ${fmt(machine.maxTorque_lbft, 1)} lb·ft.`,
    });
  }

  if (result.deflection_in > DEFLECTION_LIMIT_IN) {
    const shown =
      sys === 'metric'
        ? `${fmt(result.deflection_in * 25400, 1)} µm`
        : `${fmt(result.deflection_in * 1000, 2)} thou`;
    out.push({
      severity: 'warn',
      message: `Estimated tool deflection (${shown}) is high. Shorten the stickout or reduce depth of cut.`,
    });
  }

  if (ap_in > tool.fluteLength_in) {
    out.push({
      severity: 'warn',
      message: `Axial depth is deeper than the tool's flute length (${fmt(tool.fluteLength_in, 3)} in).`,
    });
  }

  if (out.length === 0) {
    out.push({ severity: 'info', message: 'Within machine and tool limits.' });
  }
  return out;
}
