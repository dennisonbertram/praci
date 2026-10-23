import { describe, expect, it } from "vitest";
import {
  CompanyEntityEditInputSchema,
  CompanyEntityImportInputSchema,
  CompanyEntityRecordSchema,
  CompanyEvidenceInputSchema,
  CompanyIdentityRecordSchema,
  CompanyPartialDateSchema,
  companyEntityIdentifiers,
} from "./company.js";
import { CompanyTrackerScopeSchema } from "./company-extraction.js";
import { CompanyImportSourceInputSchema } from "./company-import.js";

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
  it("parses the shared merged entity output shape with closed enums", () => {
    const record = {
      id: "company-1",
      kind: "person",
      displayName: "Synthetic Person",
      normalizedName: "synthetic person",
      attrs: { aliases: ["Synthetic Alias"] },
      confidence: 0.9,
      status: "confirmed",
      visibility: "team",
      lockedFields: ["attrs.aliases"],
      confirmedAt: "2026-01-02T03:04:05.000Z",
      confirmedByUserId: "user-1",
      identities: [
        { id: "identity-1", identityType: "email", identityValue: "synthetic@example.test" },
      ],
      evidence: [],
      mergedFrom: ["company-2"],
      edges: [],
      events: [],
      contactId: null,
      legalContractId: null,
      dataRoomItemId: null,
    };

    expect(CompanyEntityRecordSchema.safeParse(record).success).toBe(true);
    expect(CompanyEntityRecordSchema.safeParse({ ...record, kind: "person-like" }).success).toBe(
      false,
    );
    expect(CompanyEntityRecordSchema.safeParse({ ...record, status: "archived" }).success).toBe(
      false,
    );
    expect(
      CompanyEntityRecordSchema.safeParse({
        ...record,
        identities: [{ id: "identity-1", identityType: "unknown", identityValue: "x" }],
      }).success,
    ).toBe(false);
  });

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

  it("keeps tracker scopes strict and matches the reader to its source kind", () => {
    expect(CompanyTrackerScopeSchema.parse({})).toEqual({ allTime: true });
    expect(CompanyTrackerScopeSchema.parse({ reader: "linear" })).toEqual({
      reader: "linear",
      allTime: true,
    });
    expect(CompanyTrackerScopeSchema.safeParse({ allTime: false }).success).toBe(false);
    expect(CompanyTrackerScopeSchema.safeParse({ after: "2025-01-01" }).success).toBe(false);
    expect(
      CompanyImportSourceInputSchema.safeParse({
        sourceKind: "github",
        connectionId: "github-connection",
        scope: { reader: "github", allTime: true },
      }).success,
    ).toBe(true);
    expect(
      CompanyImportSourceInputSchema.safeParse({
        sourceKind: "github",
        connectionId: "github-connection",
        scope: { reader: "linear" },
      }).success,
    ).toBe(false);
    expect(
      CompanyImportSourceInputSchema.safeParse({
        sourceKind: "mcp",
        mcpServerId: "linear-server",
        scope: { reader: "linear" },
      }).success,
    ).toBe(true);
    expect(
      CompanyImportSourceInputSchema.safeParse({
        sourceKind: "linear",
        connectionId: "linear-connection",
        scope: { reader: "linear" },
      }).success,
    ).toBe(false);
  });

  it("uses the exact tracker URL for project identity without truncating identity records", () => {
    const trackerUrl = `https://linear.example.test/project/${"x".repeat(700)}`;
    expect(
      companyEntityIdentifiers({
        kind: "project",
        displayName: "Same project",
        attrs: { trackerUrl },
        confidence: 0.9,
      }),
    ).toEqual([`tracker:${trackerUrl}`]);
    expect(
      CompanyIdentityRecordSchema.safeParse({
        id: "identity-1",
        identityType: "tracker",
        identityValue: trackerUrl,
      }).success,
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
