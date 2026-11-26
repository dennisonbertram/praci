import { t } from "@lingui/core/macro";
import type { BrexCategorySpend, BrexPerson, BrexSpendBucket } from "@rakazo/contracts";
import { BREX_SPEND_BUCKETS } from "@rakazo/contracts";

export function isSpendBucket(value: string | undefined): value is BrexSpendBucket {
  return BREX_SPEND_BUCKETS.includes(value as BrexSpendBucket);
}

/** Bar colour for a spend-limit meter: red when over the limit, amber from 80%. */
export const limitBarClass = (percent: number) =>
  percent >= 100 ? "bg-destructive" : percent >= 80 ? "bg-warning" : "bg-foreground/70";

export const isSpendCents = (cents: number) => cents > 0;

export function spendCategoryTotals(
  categories: readonly BrexCategorySpend[],
): { bucket: BrexSpendBucket; cents: number; count: number }[] {
  const byBucket = new Map(categories.map((category) => [category.bucket, category]));
  return BREX_SPEND_BUCKETS.map((bucket) => {
    const category = byBucket.get(bucket);
    return { bucket, cents: category?.cents ?? 0, count: category?.count ?? 0 };
  }).filter((category) => isSpendCents(category.cents));
}

export function spendBucketLabel(bucket: BrexSpendBucket): string {
  switch (bucket) {
    case "software":
      return t`Software`;
    case "cloud":
      return t`Cloud`;
    case "travel":
      return t`Travel`;
    case "meals":
      return t`Meals`;
    case "marketing":
      return t`Marketing`;
    case "other":
      return t`Other`;
  }
}

export function spendPeriodLabel(period: string | null | undefined): string {
  if (!period) return "—";
  const PERIODS: Record<string, string> = {
    DAILY: t`Daily`,
    WEEKLY: t`Weekly`,
    MONTHLY: t`Monthly`,
    QUARTERLY: t`Quarterly`,
    YEARLY: t`Yearly`,
    ONE_TIME: t`One time`,
  };
  const key = period.trim().toUpperCase().replace(/^PER_/, "").replaceAll("-", "_");
  return PERIODS[key] ?? period.replaceAll("_", " ").toLowerCase();
}

export function brexStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const STATUSES: Record<string, string> = {
    ACTIVE: t`Active`,
    ARCHIVED: t`Archived`,
    INACTIVE: t`Inactive`,
    INVITED: t`Invited`,
    LOCKED: t`Locked`,
    SUSPENDED: t`Suspended`,
    TERMINATED: t`Terminated`,
  };
  const key = status.trim().toUpperCase();
  return STATUSES[key] ?? status.replaceAll("_", " ").toLowerCase();
}

// Brex ids are plain tokens. The id is Brex-controlled text, so anything else is never sent.
const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const safeId = (id: string) => SAFE_ID.test(id);

export type OffboardPlan = {
  lockCardIds: string[];
  cancelCardIds: string[];
  spendLimitIds: string[];
};

/** The card and spend-limit steps an Offboard request can ask the Brex agent for. */
export function offboardPlan(person: BrexPerson): OffboardPlan {
  const cards = person.cards.filter((card) => safeId(card.cardId));
  const active = cards.filter((card) => card.status.toUpperCase() !== "TERMINATED");
  return {
    lockCardIds: active
      .filter((card) => card.status.toUpperCase() !== "LOCKED")
      .map((card) => card.cardId),
    cancelCardIds: active.map((card) => card.cardId),
    spendLimitIds: [...new Set(person.spendLimitIds.filter(safeId))],
  };
}

export function offboardMessage(person: BrexPerson): string {
  const plan = offboardPlan(person);
  const steps: string[] = [];
  if (plan.lockCardIds.length > 0) {
    steps.push(`lock their cards ${plan.lockCardIds.join(", ")}`);
  }
  if (plan.cancelCardIds.length > 0) steps.push(`cancel ${plan.cancelCardIds.join(", ")}`);
  if (plan.spendLimitIds.length > 0) {
    steps.push(`remove them from limits ${plan.spendLimitIds.join(", ")}`);
  }
  return `Offboard ${person.name}${steps.length > 0 ? `: ${steps.join(", ")}.` : "."}`;
}
