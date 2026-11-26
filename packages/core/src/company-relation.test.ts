import type { CompanyEdgeRecord } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { companyRelationKind } from "./company-relation.js";

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
  expect(companyRelationKind(relationship("party_to", "org", "company"), "company")).toBeNull();
  expect(companyRelationKind(relationship("works_on", "org", "company"), "company")).toBeNull();
  expect(companyRelationKind(relationship("vendor_of", "org", "other"), "company")).toBeNull();
});
