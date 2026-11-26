import type { CompanyFact } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { companyFactTitle } from "./company-format.js";

const edge = {
  kind: "edge",
  record: {
    fromId: "p",
    toId: "c",
    relation: "works_at",
    role: "Head of Sales",
  },
} as unknown as CompanyFact;
const names: Record<string, string> = { p: "Sam Ortiz" };

it("names the endpoints of an edge when given a name lookup", () => {
  expect(companyFactTitle(edge, (id: string) => names[id])).toBe("Sam Ortiz · Head of Sales");
});

it("keeps the bare role without a name lookup", () => {
  expect(companyFactTitle(edge)).toBe("Head of Sales");
});

it("falls back to the relation with spaces", () => {
  const noRole = {
    kind: "edge",
    record: { fromId: "p", toId: "c", relation: "works_at", role: null },
  };
  expect(companyFactTitle(noRole as unknown as CompanyFact, (id: string) => names[id])).toBe(
    "Sam Ortiz · works at",
  );
});

it("uses an optional relation label and preserves the default English title", () => {
  const noRole = {
    kind: "edge",
    record: { fromId: "p", toId: "c", relation: "works_at", role: null },
  } as unknown as CompanyFact;
  expect(companyFactTitle(noRole, undefined, () => "T:works at")).toBe("T:works at");
  expect(companyFactTitle(noRole)).toBe("works at");
  expect(companyFactTitle(edge, undefined, () => "T:works at")).toBe("Head of Sales");
});
