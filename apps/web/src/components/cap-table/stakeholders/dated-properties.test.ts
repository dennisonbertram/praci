import type { EquityDatedPropertyKind } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { toUpdateProperties, validateDatedRows } from "./dated-properties";

const row = (kind: EquityDatedPropertyKind, effectiveDate: string, value: string) => ({
  kind,
  effectiveDate,
  value,
});

describe("validateDatedRows", () => {
  it("accepts complete rows", () => {
    expect(
      validateDatedRows([
        row("relationship", "2025-01-01", "employee"),
        row("relationship", "2024-03-01", "consultant"),
        row("job_title", "2025-01-01", "Engineer"),
      ]),
    ).toEqual([]);
  });

  it("requires a date and a value on every row", () => {
    expect(validateDatedRows([row("relationship", "", "employee")])).toEqual([
      "Enter a date for Relationship",
    ]);
    expect(validateDatedRows([row("job_title", "2025-01-01", "  ")])).toEqual([
      "Enter a value for Job title",
    ]);
  });

  it("rejects two rows of one kind on the same date, naming the kind and date", () => {
    expect(
      validateDatedRows([
        row("relationship", "2025-01-01", "employee"),
        row("relationship", "2025-01-01", "advisor"),
        row("cost_center", "2025-01-01", "R&D"),
      ]),
    ).toEqual(["Two Relationship entries are dated 2025-01-01"]);
  });
});

describe("toUpdateProperties", () => {
  it("trims values and drops nothing else", () => {
    expect(toUpdateProperties([row("department", "2025-01-01", " Engineering ")])).toEqual([
      { kind: "department", effectiveDate: "2025-01-01", value: "Engineering" },
    ]);
  });
});
