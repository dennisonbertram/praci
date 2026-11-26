import type { InvestorUpdate } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { filterUpdates, sortUpdates } from "./investor-updates-list";

const update = (
  id: string,
  status: string,
  subject: string,
  sentAt: string | null,
  createdAt: string,
) => ({ id, status, subject, sentAt, createdAt }) as InvestorUpdate;
const updates = [
  update("a", "sent", "Q2 update", "2026-07-10T00:00:00.000Z", "2026-07-01T00:00:00.000Z"),
  update("b", "draft", "Q4 update", null, "2026-10-20T00:00:00.000Z"),
  update("c", "posted", "Q3 update", "2026-10-05T00:00:00.000Z", "2026-10-01T00:00:00.000Z"),
];
const ids = (list: InvestorUpdate[]) => list.map((u) => u.id);

it("filters by status", () => {
  expect(ids(filterUpdates(updates, "draft"))).toEqual(["b"]);
  expect(ids(filterUpdates(updates, undefined))).toEqual(["a", "b", "c"]);
});

it("sorts by the day sent (the draft by the day created) or by subject", () => {
  expect(ids(sortUpdates(updates, { field: "date", dir: "desc" }))).toEqual(["b", "c", "a"]);
  expect(ids(sortUpdates(updates, { field: "date", dir: "asc" }))).toEqual(["a", "c", "b"]);
  expect(ids(sortUpdates(updates, { field: "subject", dir: "asc" }))).toEqual(["a", "c", "b"]);
});
