import { describe, expect, it } from "vitest";
import type { HealthInput } from "./views-health.js";
import { runHealthChecks } from "./views-health.js";

const clean: HealthInput = {
  asOf: "2026-10-15",
  classes: [{ id: "common", name: "Common", classType: "common", authorizedShares: 10_000_000n }],
  certificates: [
    {
      id: "cs-1",
      stakeholderId: "ada",
      shareClassId: "common",
      quantity: 5_000_000n,
      status: "outstanding",
      issueDate: "2024-01-01",
      cashPaidCents: 0n,
    },
  ],
  plans: [{ id: "plan", name: "2024 Plan", shareClassId: "common", reservedShares: 2_000_000n }],
  optionGrants: [
    {
      id: "es-1",
      stakeholderId: "cy",
      planId: "plan",
      quantity: 1_000_000n,
      exercisedQuantity: 0n,
      canceledQuantity: 0n,
      status: "outstanding",
      grantDate: "2025-01-01",
    },
  ],
  convertibles: [],
  stakeholders: [
    { id: "ada", name: "Ada Founder", email: "ada@example.test" },
    { id: "cy", name: "Cy Engineer", email: "cy@example.test" },
  ],
};

const checks = (input: HealthInput) => runHealthChecks(input).map((finding) => finding.check);

describe("runHealthChecks", () => {
  it("finds nothing in a clean ledger", () => {
    expect(runHealthChecks(clean)).toEqual([]);
  });

  it("flags a class issued and reserved over its authorized shares", () => {
    const [finding] = runHealthChecks({
      ...clean,
      classes: [{ ...clean.classes[0]!, authorizedShares: 6_000_000n }],
    });
    expect(finding).toMatchObject({
      check: "class-over-issued",
      tag: "share_classes",
      severity: "required",
    });
    expect(finding?.rows[0]).toMatchObject({
      recordKind: "share_class",
      recordId: "common",
      detail: "7,000,000 issued or reserved of 6,000,000 authorized",
    });
  });

  it("flags options granted above the pool", () => {
    const input = { ...clean, plans: [{ ...clean.plans[0]!, reservedShares: 500_000n }] };
    expect(checks(input)).toContain("options-above-pool");
  });

  it("flags securities with no shares", () => {
    const input = { ...clean, certificates: [{ ...clean.certificates[0]!, quantity: 0n }] };
    expect(runHealthChecks(input)[0]?.rows[0]).toMatchObject({
      recordKind: "certificate",
      detail: "No shares",
    });
  });

  it("recommends an email for holders, but not for people holding nothing", () => {
    const input = {
      ...clean,
      stakeholders: [
        { id: "ada", name: "Ada Founder", email: null },
        { id: "cy", name: "Cy Engineer", email: "cy@example.test" },
        { id: "zed", name: "Zed Former", email: null },
      ],
    };
    const [finding] = runHealthChecks(input);
    expect(finding).toMatchObject({ check: "holder-missing-email", severity: "recommended" });
    expect(finding?.rows.map((row) => row.recordId)).toEqual(["ada"]);
  });

  it("flags stakeholders sharing an email, required before recommended", () => {
    const input = {
      ...clean,
      stakeholders: [
        { id: "ada", name: "Ada Founder", email: "Ada@example.test" },
        { id: "ada2", name: "Ada F.", email: "ada@example.test" },
        { id: "cy", name: "Cy Engineer", email: null },
      ],
    };
    expect(checks(input)).toEqual(["duplicated-stakeholder", "holder-missing-email"]);
  });
});
