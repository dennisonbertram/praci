// Vesting math: an even rule (total months, cliff, frequency) or custom tranches, from a start
// date, with a stop date and acceleration. Months are calendar months clamped to the target
// month's end, and the last event takes the remainder so a vesting schedule totals exactly.

import { addMonthsClamped } from "./dates.js";
import type { Fixed } from "./fixed.js";
import { SCALE } from "./fixed.js";

export type VestingTranche = { monthOffset: number; percent: Fixed };

export type VestingRule = {
  startDate: string;
  totalMonths: number;
  cliffMonths: number;
  frequencyMonths: number;
  tranches?: VestingTranche[] | null;
  acceleratedShares?: bigint | null;
  acceleratedOn?: string | null;
  stoppedOn?: string | null;
};

export type VestingEvent = { date: string; shares: bigint; cumulative: bigint };

function hasTranches(rule: VestingRule): boolean {
  return rule.tranches != null && rule.tranches.length > 0;
}

function sortedTranches(rule: VestingRule): VestingTranche[] {
  return [...(rule.tranches ?? [])].sort((a, b) => a.monthOffset - b.monthOffset);
}

function clampTotal(value: bigint, total: bigint): bigint {
  if (value > total) return total;
  return value > 0n ? value : 0n;
}

/** Shares the tranches vest, cumulatively, with the last tranche taking the rounding remainder. */
function trancheShares(rule: VestingRule, total: bigint): VestingEvent[] {
  const tranches = sortedTranches(rule);
  const events: VestingEvent[] = [];
  let cumulative = 0n;
  for (let index = 0; index < tranches.length; index += 1) {
    const tranche = tranches[index];
    if (!tranche) continue;
    const shares =
      index === tranches.length - 1
        ? total - cumulative
        : (total * tranche.percent) / (100n * SCALE);
    cumulative += shares;
    events.push({
      date: addMonthsClamped(rule.startDate, tranche.monthOffset),
      shares,
      cumulative,
    });
  }
  return events;
}

/** The even rule's cumulative targets at frequency dates, the cliff, and the final date. */
function evenEvents(rule: VestingRule, total: bigint): VestingEvent[] {
  if (rule.totalMonths === 0) {
    return [{ date: rule.startDate, shares: total, cumulative: total }];
  }
  const frequency = rule.frequencyMonths > 0 ? rule.frequencyMonths : 1;
  const cliffMonths = rule.cliffMonths > 0 ? rule.cliffMonths : 0;
  const finalMonth = Math.max(rule.totalMonths, cliffMonths);
  const targets = new Map<string, bigint>();
  const addTarget = (month: number, target: bigint) => {
    const date = addMonthsClamped(rule.startDate, month);
    const bounded = clampTotal(target, total);
    const prior = targets.get(date) ?? 0n;
    if (bounded > prior) targets.set(date, bounded);
  };

  if (cliffMonths > 0) {
    addTarget(cliffMonths, (total * BigInt(cliffMonths)) / BigInt(rule.totalMonths));
  }
  for (let month = frequency; month < rule.totalMonths; month += frequency) {
    if (month >= cliffMonths) {
      addTarget(month, (total * BigInt(month)) / BigInt(rule.totalMonths));
    }
  }
  addTarget(finalMonth, total);

  const events: VestingEvent[] = [];
  let cumulative = 0n;
  for (const [date, target] of [...targets].sort(([left], [right]) => left.localeCompare(right))) {
    if (target <= cumulative) continue;
    events.push({ date, shares: target - cumulative, cumulative: target });
    cumulative = target;
  }
  return events;
}

/** Effective dated vesting events, including acceleration and the inclusive stop date. */
export function vestingEvents(rule: VestingRule, total: bigint): VestingEvent[] {
  if (total <= 0n) return [];
  const scheduled = hasTranches(rule) ? trancheShares(rule, total) : evenEvents(rule, total);
  const targets = new Map<string, bigint>();
  for (const event of scheduled) {
    const prior = targets.get(event.date) ?? 0n;
    if (event.cumulative > prior) targets.set(event.date, event.cumulative);
  }
  const stoppedOn = rule.stoppedOn ?? null;
  let acceleratedOn = rule.acceleratedOn ?? null;
  const acceleratedShares = rule.acceleratedShares ?? 0n;
  if (acceleratedShares > 0n && acceleratedOn != null) {
    if (acceleratedOn < rule.startDate) acceleratedOn = rule.startDate;
    if (stoppedOn == null || acceleratedOn <= stoppedOn) {
      if (!targets.has(acceleratedOn)) targets.set(acceleratedOn, 0n);
    } else {
      acceleratedOn = null;
    }
  } else {
    acceleratedOn = null;
  }

  const events: VestingEvent[] = [];
  let scheduledCumulative = 0n;
  let effectiveCumulative = 0n;
  for (const [date, target] of [...targets].sort(([left], [right]) => left.localeCompare(right))) {
    if (stoppedOn != null && date > stoppedOn) break;
    if (target > scheduledCumulative) scheduledCumulative = target;
    const acceleration = acceleratedOn != null && acceleratedOn <= date ? acceleratedShares : 0n;
    const cumulative = clampTotal(scheduledCumulative + acceleration, total);
    if (cumulative <= effectiveCumulative) continue;
    events.push({ date, shares: cumulative - effectiveCumulative, cumulative });
    effectiveCumulative = cumulative;
  }
  return events;
}

/**
 * Shares vested as of `asOf`. Vesting stops on `stoppedOn`; on and after `acceleratedOn`
 * `acceleratedShares` are added, capped at `total`.
 */
export function vestedShares(rule: VestingRule, total: bigint, asOf: string): bigint {
  if (total <= 0n || asOf < rule.startDate) return 0n;
  let vested = 0n;
  for (const event of vestingEvents(rule, total)) {
    if (event.date > asOf) break;
    vested += event.shares;
  }
  return vested;
}

function frequencyLabel(months: number): string {
  if (months === 1) return "monthly";
  if (months === 3) return "quarterly";
  if (months === 6) return "semi-annually";
  if (months === 12) return "annually";
  return `every ${months} months`;
}

function cliffLabel(months: number): string {
  if (months % 12 === 0) return `${months / 12} year`;
  return `${months} month`;
}

/**
 * A short human summary of the rule, e.g. "1/48 monthly, 1 year cliff", "1/16 quarterly",
 * "Custom (4 tranches)" or "Immediate".
 */
export function describeVesting(rule: VestingRule): string {
  if (hasTranches(rule)) {
    const count = rule.tranches?.length ?? 0;
    return `Custom (${count} tranche${count === 1 ? "" : "s"})`;
  }
  if (rule.totalMonths === 0) return "Immediate";
  const frequency = rule.frequencyMonths > 0 ? rule.frequencyMonths : 1;
  const remainder = rule.totalMonths % frequency;
  const base =
    remainder === 0
      ? `1/${Math.max(1, Math.floor(rule.totalMonths / frequency))} ${frequencyLabel(frequency)}`
      : `${frequencyLabel(frequency)}, final ${remainder} month${remainder === 1 ? "" : "s"}`;
  const cliff = rule.cliffMonths > 0 ? `, ${cliffLabel(rule.cliffMonths)} cliff` : "";
  return `${base}${cliff}`;
}
