import { t } from "@lingui/core/macro";
import type { InvestorUpdate, InvestorUpdateStatus } from "@rakazo/contracts";
import type { Sort } from "./list-params";
import { sortBy } from "./list-params";

export const UPDATE_SORTS = ["date", "subject"] as const;
export type UpdateSort = (typeof UPDATE_SORTS)[number];
/** The server lists newest first; that stays the default. */
export const DEFAULT_UPDATE_SORT: Sort<UpdateSort> = { field: "date", dir: "desc" };

/** The day an update went out, or was drafted while it has not. */
const updateDay = (update: InvestorUpdate) => update.sentAt ?? update.createdAt;

export const updateStatusNames = (): Record<InvestorUpdateStatus, string> => ({
  draft: t`Draft`,
  sending: t`Sending`,
  sent: t`Sent`,
  partly_sent: t`Partly sent`,
  posted: t`Posted`,
});

export const filterUpdates = (updates: InvestorUpdate[], status: string | undefined) =>
  status ? updates.filter((update) => update.status === status) : updates;

export const sortUpdates = (updates: InvestorUpdate[], { field, dir }: Sort<UpdateSort>) =>
  sortBy(updates, (update) => (field === "date" ? updateDay(update) : update.subject.trim()), dir);
