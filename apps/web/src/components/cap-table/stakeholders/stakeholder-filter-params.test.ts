import { expect, it } from "vitest";
import type { StakeholderFilterValue } from "./stakeholder-filter-params";
import { activeFilterCount, readFilters, writeFilters } from "./stakeholder-filter-params";

function roundTrip(value: StakeholderFilterValue): StakeholderFilterValue {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(writeFilters(value))) {
    if (raw !== undefined) params.set(key, raw);
  }
  return readFilters(params);
}

it("reads no filters from an empty URL", () => {
  expect(readFilters(new URLSearchParams())).toEqual({});
  expect(activeFilterCount({})).toBe(0);
});

it("writes every group into its own URL key", () => {
  expect(
    writeFilters({
      relationship: ["investor", "none"],
      costCenter: ["Engineering"],
      holdings: ["has"],
      addressCompleteness: ["incomplete"],
      country: ["USA", "Portugal"],
      createdFrom: "2025-01-01",
      createdTo: "2025-12-31",
    }),
  ).toEqual({
    rel: "investor,none",
    cc: "Engineering",
    hold: "has",
    addr: "incomplete",
    country: "USA,Portugal",
    from: "2025-01-01",
    to: "2025-12-31",
  });
});

it("writes undefined for groups that filter nothing, so the key leaves the URL", () => {
  expect(writeFilters({ costCenter: [] })).toEqual({
    rel: undefined,
    cc: undefined,
    hold: undefined,
    addr: undefined,
    country: undefined,
    from: undefined,
    to: undefined,
  });
});

it("round trips every filter group", () => {
  const value: StakeholderFilterValue = {
    relationship: ["ex_employee", "none"],
    costCenter: ["Engineering", "Design"],
    holdings: ["has", "none"],
    addressCompleteness: ["complete", "incomplete", "none"],
    country: ["USA", "None entered"],
    createdFrom: "2024-02-29",
    createdTo: "2026-01-31",
  };
  expect(roundTrip(value)).toEqual(value);
});

it("round trips a single group without inventing the others", () => {
  const value: StakeholderFilterValue = { holdings: ["none"] };
  expect(roundTrip(value)).toEqual(value);
});

it("reads a hand-written URL, ignoring blanks, padding and unknown keys", () => {
  const params = new URLSearchParams("rel=investor,%20founder&hold=&country=&from=&page=2");
  expect(readFilters(params)).toEqual({ relationship: ["investor", "founder"] });
});

it("counts the filter groups that are active", () => {
  expect(activeFilterCount({ relationship: ["investor"] })).toBe(1);
  expect(
    activeFilterCount({ relationship: ["investor", "founder"], createdFrom: "2025-01-01" }),
  ).toBe(2);
  expect(activeFilterCount({ relationship: [], costCenter: [], createdFrom: " " })).toBe(0);
  expect(
    activeFilterCount({
      relationship: ["none"],
      costCenter: ["Design"],
      holdings: ["has"],
      addressCompleteness: ["none"],
      country: ["USA"],
      createdFrom: "2025-01-01",
    }),
  ).toBe(6);
});
