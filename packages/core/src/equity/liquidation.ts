// Liquidation seniority: who is paid first out of a sale or a wind-down.

import type { CapClass } from "./cap-table.js";

/**
 * Classes grouped into ranks, most senior first. A lower `seniority` number is more senior.
 * Classes at the same seniority share one rank only when all of them are pari passu; otherwise each
 * is its own rank, in input order. A missing seniority is the schema default, 1.
 */
export function seniorityOrder(classes: readonly CapClass[]): CapClass[][] {
  const bySeniority = new Map<number, CapClass[]>();
  for (const shareClass of classes) {
    const seniority = shareClass.seniority ?? 1;
    const group = bySeniority.get(seniority);
    if (group) group.push(shareClass);
    else bySeniority.set(seniority, [shareClass]);
  }

  const ranks: CapClass[][] = [];
  const seniorities = [...bySeniority.keys()].sort((a, b) => a - b);
  for (const seniority of seniorities) {
    const group = bySeniority.get(seniority);
    if (!group) continue;
    if (group.every((shareClass) => shareClass.pariPassu !== false)) {
      ranks.push(group);
    } else {
      for (const shareClass of group) ranks.push([shareClass]);
    }
  }
  return ranks;
}
