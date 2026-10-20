import { describe, expect, it } from "vitest";
import {
  CompanyEntityEditInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEvidenceInputSchema,
  CompanyPartialDateSchema,
} from "./company.js";

const entity = {
  kind: "person" as const,
  displayName: "Ada Lovelace",
  attrs: { workEmails: ["ada@example.test"] },
  confidence: 0.9,
};

const evidence = {
  sourceKind: "slack" as const,
  sourceItemId: "message-1",
  quote: "Ada leads the platform team.",
  contentHash: "hash-1",
  extractedAt: "2026-01-02T03:04:05.000Z",
  extractorModel: null,
  confidence: 0.9,
};

describe("company contracts", () => {
  it("requires a strict discriminated fact shape and bounded evidence", () => {
    expect(CompanyEntityImportInputSchema.safeParse({ entity, evidence }).success).toBe(true);
    expect(
      CompanyEntityImportInputSchema.safeParse({
        entity: { ...entity, status: "confirmed" },
        evidence,
      }).success,
    ).toBe(false);
    expect(
      CompanyEvidenceInputSchema.safeParse({
        ...evidence,
        quote: "q".repeat(241),
      }).success,
    ).toBe(false);
  });

  it("keeps owner-authored evidence out of extraction inputs", () => {
    expect(
      CompanyEntityImportInputSchema.safeParse({
        entity,
        evidence: { ...evidence, sourceKind: "manual" },
      }).success,
    ).toBe(false);
  });

  it("validates explicit date precision", () => {
    expect(
      CompanyPartialDateSchema.safeParse({ date: "2025-01-01", precision: "year" }).success,
    ).toBe(true);
    expect(
      CompanyPartialDateSchema.safeParse({ date: "2025-02-01", precision: "quarter" }).success,
    ).toBe(false);
    expect(
      CompanyPartialDateSchema.safeParse({ date: "2025-04-01", precision: "quarter" }).success,
    ).toBe(true);
  });

  it("allows only kind-specific editable values and no status or lock fields", () => {
    expect(
      CompanyEntityEditInputSchema.safeParse({
        entityId: "person-1",
        kind: "person",
        attrs: { workEmails: ["new@example.test"] },
      }).success,
    ).toBe(true);
    expect(
      CompanyEntityEditInputSchema.safeParse({
        entityId: "person-1",
        kind: "person",
        status: "confirmed",
        lockedFields: ["displayName"],
      }).success,
    ).toBe(false);
    expect(
      CompanyEntityEditInputSchema.safeParse({
        entityId: "person-1",
        kind: "person",
        attrs: { performanceReview: "private" },
      }).success,
    ).toBe(false);
  });
});
