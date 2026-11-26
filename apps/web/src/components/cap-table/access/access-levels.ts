import { t } from "@lingui/core/macro";
import type { EquityAccessGroupKey, EquityAccessLevel } from "@rakazo/contracts";
import { EQUITY_ACCESS_LEVELS } from "@rakazo/contracts";

/** The level the reference recommends for each group; the server uses it until one is saved. */
export const RECOMMENDED_LEVEL: Record<EquityAccessGroupKey, EquityAccessLevel> = {
  founders: "full_detail",
  investors: "advanced",
  employees: "basic",
  former_employees: "basic",
  other: "basic",
};

export const levelLabel = (level: EquityAccessLevel): string =>
  ({
    full_detail: t`Full detail`,
    advanced: t`Advanced`,
    basic: t`Basic`,
    restricted: t`Restricted`,
    none: t`No access`,
  })[level];

export const ACCESS_LEVELS = EQUITY_ACCESS_LEVELS;

export const groupText = (key: EquityAccessGroupKey): { name: string; description: string } =>
  ({
    founders: { name: t`Founders`, description: t`Stakeholders with a founder relationship` },
    investors: {
      name: t`Investors`,
      description: t`Stakeholders with an investor or board member relationship`,
    },
    employees: {
      name: t`Employees`,
      description: t`Employee, executive, advisor, and officer relationships`,
    },
    former_employees: {
      name: t`Former employees`,
      description: t`Former employees and advisors`,
    },
    other: {
      name: t`Other stakeholders`,
      description: t`Consultants and stakeholders with "other" or no relationship`,
    },
  })[key];

/** The group a relationship falls in; the same rule as the server's `equityAccessGroupOf`. */
export function accessGroupOf(relationship: string | null): EquityAccessGroupKey {
  if (relationship === "founder") return "founders";
  if (relationship === "investor" || relationship === "board_member") return "investors";
  if (
    relationship === "employee" ||
    relationship === "executive" ||
    relationship === "advisor" ||
    relationship === "officer" ||
    relationship === "international_employee"
  )
    return "employees";
  if (relationship?.startsWith("ex_")) return "former_employees";
  return "other";
}
