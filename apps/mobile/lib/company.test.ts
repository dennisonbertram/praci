import type { CompanyReviewCandidate } from "@rakazo/contracts";
import { CompanyReviewResolveSchema } from "@rakazo/contracts";
import { companyDate } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  companyCanCancel,
  companyCanPause,
  companyMonthOffset,
  companyReviewDecision,
  mobileCompanyAvailable,
} from "./company";

const candidate: CompanyReviewCandidate = {
  id: "candidate-1",
  version: "version-1",
  reason: "ambiguous_event_subjects",
  title: "Northwind launch",
  quote: "Alex led the launch",
  sourceKind: "gmail",
  details: [],
  choices: [{ id: "event-1", title: "Launch" }],
  allowSeparate: true,
  editableTitle: true,
  subjects: [{ ref: "person:alex", title: "Alex", entityId: null }],
  subjectChoices: [{ id: "person-1", title: "Alex Reed" }],
};

describe("native Company decisions", () => {
  it("keeps the Company entry unavailable until the shared gate is enabled", () => {
    expect(mobileCompanyAvailable()).toBe(false);
  });
  it("requires explicit valid match and subject choices, preserving the server version", () => {
    expect(companyReviewDecision(candidate, "confirm")).toBeNull();
    expect(companyReviewDecision(candidate, "confirm", "event-1")).toBeNull();
    expect(
      companyReviewDecision(candidate, "confirm", "unknown", { "person:alex": "person-1" }),
    ).toBeNull();
    const decision = companyReviewDecision(candidate, "confirm", "event-1", {
      "person:alex": "person-1",
    });
    expect(CompanyReviewResolveSchema.parse(decision)).toEqual({
      candidateId: "candidate-1",
      version: "version-1",
      action: "confirm",
      targetId: "event-1",
      separate: false,
      subjects: { "person:alex": "person-1" },
    });
  });
  it("supports Keep separate and rejects without inventing targets", () => {
    const decision = companyReviewDecision(
      candidate,
      "confirm",
      "separate",
      { "person:alex": "person-1" },
      " Revised launch ",
    );
    expect(decision).toMatchObject({ separate: true, title: "Revised launch" });
    expect(decision).not.toHaveProperty("targetId", "event-1");
    expect(
      companyReviewDecision({ ...candidate, allowSeparate: false }, "confirm", "separate", {
        "person:alex": "person-1",
      }),
    ).toBeNull();
    expect(CompanyReviewResolveSchema.parse(companyReviewDecision(candidate, "reject"))).toEqual({
      candidateId: "candidate-1",
      version: "version-1",
      action: "reject",
    });
  });
  it("only pauses running imports and never cancels terminal imports", () => {
    expect(companyCanPause("running")).toBe(true);
    for (const state of [
      "paused",
      "draft",
      "awaiting_consent",
      "budget_reached",
      "completed",
      "failed",
    ])
      expect(companyCanPause(state)).toBe(false);
    for (const state of ["running", "paused", "awaiting_consent", "budget_reached"])
      expect(companyCanCancel(state)).toBe(true);
    for (const state of ["cancelled", "discarded", "completed", "partial", "failed"])
      expect(companyCanCancel(state)).toBe(false);
  });
  it("keeps navigation and imprecise all-day dates timezone independent", () => {
    expect(companyMonthOffset("2024-01", -1)).toBe("2023-12");
    expect(companyMonthOffset("2024-12", 1)).toBe("2025-01");
    expect(companyDate({ date: "2024-04-01", precision: "quarter" })).toBe("2024 Q2");
    expect(companyDate({ date: "2024-04-01", precision: "day" })).toBe("2024-04-01");
  });
});
