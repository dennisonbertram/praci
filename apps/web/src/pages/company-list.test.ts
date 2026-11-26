import type { CompanyEdgeRecord, CompanyEntityRecord } from "@rakazo/contracts";
import { companyRelationKind } from "@rakazo/core";
import { expect, it } from "vitest";
import type { CompanyRow } from "./company-list";
import { companyRows, companySince, companySources } from "./company-list";

const row = (
  name: string,
  source: string,
  role: string | null,
  since: string | null,
): CompanyRow => ({
  entity: {
    displayName: name,
    evidence: [{ sourceKind: source }],
  } as unknown as CompanyEntityRecord,
  role,
  since,
});
const rows = [
  row("Bea", "slack", "Designer", "2023-01-01"),
  row("Al", "gmail", "Engineer", null),
  row("Cy", "gmail", null, "2022-05-01"),
];
const names = (list: CompanyRow[]) => list.map((r) => r.entity.displayName);

it("searches name and role and filters source", () => {
  const asc = { field: "name", dir: "asc" } as const;
  expect(names(companyRows(rows, { q: "eng" }, asc))).toEqual(["Al"]);
  expect(names(companyRows(rows, { q: "c" }, asc))).toEqual(["Cy"]);
  expect(names(companyRows(rows, { source: "gmail" }, asc))).toEqual(["Al", "Cy"]);
  expect(companySources(rows.map((r) => r.entity))).toEqual(["gmail", "slack"]);
});

it("sorts by name, role and since with missing values last", () => {
  expect(names(companyRows(rows, {}, { field: "name", dir: "desc" }))).toEqual(["Cy", "Bea", "Al"]);
  expect(names(companyRows(rows, {}, { field: "role", dir: "asc" }))).toEqual(["Bea", "Al", "Cy"]);
  expect(names(companyRows(rows, {}, { field: "since", dir: "desc" }))).toEqual([
    "Bea",
    "Cy",
    "Al",
  ]);
});

const edge = (startsOn: string | null, endsOn: string | null) =>
  ({
    startsOn: startsOn ? { date: startsOn, precision: "day" } : null,
    endsOn: endsOn ? { date: endsOn, precision: "day" } : null,
  }) as unknown as Pick<CompanyEdgeRecord, "startsOn" | "endsOn">;
const today = "2026-11-09";

it("names the organisation's side of a relationship in either direction", () => {
  const relationship = (relation: CompanyEdgeRecord["relation"], fromId: string, toId: string) =>
    ({ relation, fromId, toId }) as CompanyEdgeRecord;
  expect(companyRelationKind(relationship("vendor_of", "org", "company"), "company")).toBe(
    "supplier",
  );
  expect(companyRelationKind(relationship("vendor_of", "company", "org"), "company")).toBe(
    "customer",
  );
  expect(companyRelationKind(relationship("customer_of", "org", "company"), "company")).toBe(
    "customer",
  );
  expect(companyRelationKind(relationship("customer_of", "company", "org"), "company")).toBe(
    "supplier",
  );
  expect(companyRelationKind(relationship("invested_in", "org", "company"), "company")).toBe(
    "investor",
  );
  expect(companyRelationKind(relationship("invested_in", "company", "org"), "company")).toBeNull();
  expect(companyRelationKind(relationship("counsel_for", "org", "company"), "company")).toBe(
    "lawFirm",
  );
  expect(companyRelationKind(relationship("counsel_for", "company", "org"), "company")).toBeNull();
  expect(companyRelationKind(relationship("part_of", "org", "company"), "company")).toBeNull();
  expect(companyRelationKind(relationship("part_of", "company", "org"), "company")).toBeNull();
  expect(companyRelationKind(relationship("party_to", "org", "company"), "company")).toBeNull();
  expect(companyRelationKind(relationship("works_on", "org", "company"), "company")).toBeNull();
  expect(companyRelationKind(relationship("vendor_of", "org", "other"), "company")).toBeNull();
});

it("Since is the start of the current role, not an earlier ended one", () => {
  expect(companySince([edge("2019-03-01", "2019-12-31"), edge("2022-04-01", null)], today)).toBe(
    "2022-04-01",
  );
  expect(companySince([edge("2019-03-01", "2019-12-31")], today)).toBe("2019-03-01");
  expect(companySince([edge(null, null)], today)).toBeNull();
});

it("does not count a planned role that starts later as current", () => {
  const later = `${Number(today.slice(0, 4)) + 1}-01-01`;
  expect(companySince([edge("2022-04-01", null), edge(later, null)], today)).toBe("2022-04-01");
  // With the held role undated, its start is unknown: not the planned role's date.
  expect(companySince([edge(null, null), edge(later, null)], today)).toBeNull();
});
