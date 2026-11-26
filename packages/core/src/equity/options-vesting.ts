import { parseFixed } from "./fixed.js";
import type { VestingRule } from "./vesting.js";

/** A vesting schedule as it travels on the wire: integer and decimal strings, YYYY-MM-DD. */
export type WireVestingSchedule = {
  startDate: string;
  totalMonths: number;
  cliffMonths: number;
  frequencyMonths: number;
  tranches?: { monthOffset: number; percent: string }[] | null;
  acceleratedShares?: string | null;
  acceleratedOn?: string | null;
  stoppedOn?: string | null;
};

/** The core vesting rule for a wire schedule, so web and stores compute the same events. */
export function vestingRuleOf(schedule: WireVestingSchedule): VestingRule {
  return {
    startDate: schedule.startDate,
    totalMonths: schedule.totalMonths,
    cliffMonths: schedule.cliffMonths,
    frequencyMonths: schedule.frequencyMonths,
    tranches:
      schedule.tranches?.map((tranche) => ({
        monthOffset: tranche.monthOffset,
        percent: parseFixed(tranche.percent),
      })) ?? null,
    acceleratedShares: schedule.acceleratedShares ? BigInt(schedule.acceleratedShares) : null,
    acceleratedOn: schedule.acceleratedOn ?? null,
    stoppedOn: schedule.stoppedOn ?? null,
  };
}
