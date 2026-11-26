import { describe, expect, it } from "vitest";
import type { Iso100kGrant } from "./options-iso100k.js";
import { ISO_100K_LIMIT_CENTS, iso100k } from "./options-iso100k.js";
import type { WireVestingSchedule } from "./options-vesting.js";

const vesting = (overrides: Partial<WireVestingSchedule> = {}): WireVestingSchedule => ({
  startDate: "2024-01-01",
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  ...overrides,
});

const grant = (overrides: Partial<Iso100kGrant> = {}): Iso100kGrant => ({
  stakeholderId: "sh-1",
  stakeholderName: "Ada Example",
  optionType: "iso",
  quantity: "48000",
  exercisePrice: "0.10",
  grantDate: "2024-01-01",
  earlyExercise: false,
  status: "outstanding",
  vestingSchedule: vesting(),
  ...overrides,
});

describe("iso100k", () => {
  it("spreads a 48 month, 1 year cliff ISO across the years it vests in", () => {
    const rows = iso100k([grant()]);
    expect(rows.map((row) => [row.year, row.valueCents, row.overLimitCents])).toEqual([
      [2025, 230_000n, 0n],
      [2026, 120_000n, 0n],
      [2027, 120_000n, 0n],
      [2028, 10_000n, 0n],
    ]);
    expect(rows.every((row) => row.stakeholderName === "Ada Example")).toBe(true);
  });

  it("counts an early exercise grant in full in its grant year", () => {
    const rows = iso100k([
      grant({
        quantity: "100000",
        exercisePrice: "1",
        earlyExercise: true,
        grantDate: "2025-03-01",
      }),
    ]);
    expect(rows.map((row) => [row.year, row.valueCents, row.overLimitCents])).toEqual([
      [2025, 10_000_000n, 0n],
    ]);
  });

  it("marks the part over $100,000 in a year as an NSO", () => {
    const rows = iso100k([
      grant({
        stakeholderName: "Grace Example",
        quantity: "200000",
        exercisePrice: "1",
        earlyExercise: true,
        grantDate: "2025-06-01",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.valueCents).toBe(20_000_000n);
    expect(rows[0]?.overLimitCents).toBe(10_000_000n);
    expect(20_000_000n - ISO_100K_LIMIT_CENTS).toBe(10_000_000n);
  });

  it("ignores NSOs and canceled, forfeited or expired ISOs", () => {
    const rows = iso100k([
      grant({ stakeholderId: "sh-2", stakeholderName: "Bo Example", optionType: "nso" }),
      grant({ stakeholderId: "sh-3", stakeholderName: "Cy Example", status: "canceled" }),
      grant({ stakeholderId: "sh-4", stakeholderName: "Di Example", status: "forfeited" }),
      grant({ stakeholderId: "sh-5", stakeholderName: "Eli Example", status: "expired" }),
    ]);
    expect(rows).toEqual([]);
  });

  it("sorts by holder name and then year", () => {
    const rows = iso100k([
      grant({ stakeholderId: "sh-2", stakeholderName: "Bo Example" }),
      grant({ stakeholderId: "sh-1", stakeholderName: "Ada Example" }),
    ]);
    expect(rows.map((row) => [row.stakeholderName, row.year])).toEqual([
      ["Ada Example", 2025],
      ["Ada Example", 2026],
      ["Ada Example", 2027],
      ["Ada Example", 2028],
      ["Bo Example", 2025],
      ["Bo Example", 2026],
      ["Bo Example", 2027],
      ["Bo Example", 2028],
    ]);
  });

  it("counts an ISO with no schedule at its grant date", () => {
    const rows = iso100k([
      grant({ vestingSchedule: null, quantity: "1000", exercisePrice: "0.50" }),
    ]);
    expect(rows.map((row) => [row.year, row.valueCents])).toEqual([[2024, 50_000n]]);
  });
});
