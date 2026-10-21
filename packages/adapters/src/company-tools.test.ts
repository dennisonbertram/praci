import type { Actor } from "@rakazo/contracts";
import {
  CalendarQueryInputSchema,
  CompanyFactUpsertInputSchema,
  CompanyGetInputSchema,
  CompanyImportStartInputSchema,
  CompanySearchInputSchema,
  TimelineQueryInputSchema,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { companyToolFromTool, companyToolsForRun } from "./company-tools.js";

const companyStoreMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  companyForActor: vi.fn(() => companyStoreMock.current),
}));

const actor: Actor = {
  userId: "owner-1",
  spaceId: "space-1",
  email: "owner@example.test",
  isDeploymentOwner: false,
};

describe("Company tools", () => {
  const evidence = (id: string, sourceKind = "slack") => ({
    id,
    factKind: "entity",
    factId: "person-1",
    stance: "supports",
    sourceKind,
    connectionId: null,
    mcpServerId: null,
    dataRoomItemId: sourceKind === "data_room" ? "dr-item-1" : null,
    sourceItemId: `${id}-source`,
    sourceKey: `${id}-key`,
    sourceUrl: null,
    quote: "private synthetic quotation",
    contentHash: `${id}-hash`,
    extractedAt: "2026-01-01T00:00:00.000Z",
    extractorRunId: null,
    extractorModel: null,
    confidence: 0.9,
    confirmedByUserId: null,
    confirmedAt: null,
  });

  const entity = (id: string, displayName: string, attrs: unknown, evidenceRows = [evidence(id)]) =>
    ({
      id,
      kind: "person",
      displayName,
      attrs,
      confidence: 0.9,
      status: "suggested",
      visibility: "private",
      evidence: evidenceRows,
      identities: [],
      mergedFrom: [],
      edges: [],
      events: [],
    }) as never;

  it("searches after visibility filtering and preserves metadata without source quotes", async () => {
    const visible = entity("person-1", "Sam Example", { workEmails: ["sam@example.test"] });
    const hidden = entity("person-2", "Hidden Example", { workEmails: ["hidden@example.test"] }, [
      evidence("private-evidence", "data_room"),
    ]);
    const event = {
      id: "event-1",
      stream: "funding",
      kind: "funding_round",
      title: "Series A announcement",
      occursOn: { date: "2026-01-01", precision: "day" },
      endsOn: null,
      entityIds: ["person-1"],
      confidence: 0.9,
      status: "suggested",
      visibility: "private",
      evidence: [evidence("event-evidence")],
    } as never;
    const privateEvent = {
      ...(event as unknown as Record<string, unknown>),
      id: "private-event",
      title: "Confidential hidden-person event",
      entityIds: ["person-2"],
    } as never;
    const hiddenEdge = {
      id: "hidden-edge",
      fromId: "person-1",
      toId: "person-2",
      relation: "works_with",
      role: null,
      confidence: 0.9,
      status: "suggested",
      visibility: "private",
      evidence: [evidence("edge-evidence")],
    } as never;
    const shared = entity("shared-person", "Shared Example", {});
    companyStoreMock.current = {
      list: vi.fn(async () => [visible, hidden]),
      listEdges: vi.fn(async () => [hiddenEdge]),
      listEvents: vi.fn(async () => [event, privateEvent]),
      candidates: vi.fn(async () => [
        {
          id: "candidate-1",
          kind: "entity",
          reason: "ambiguous entity match",
          entityIds: ["person-1", "person-2"],
          sourceKind: "slack",
        },
        {
          id: "candidate-2",
          kind: "entity",
          reason: "Data Room candidate",
          entityIds: ["person-2"],
          sourceKind: "data_room",
        },
      ]),
      teamFacts: vi.fn(async () => ({ entities: [shared], edges: [], events: [] })),
    };
    const deps = {
      prisma: {} as PrismaClient,
      actor,
      ownerRun: true,
      companyAgent: false,
      importer: false,
      dataRoomAllowed: async () => false,
    };
    const byAttribute = await companyToolFromTool(deps, "company_search", {
      text: "sam@example.test",
    });
    expect(byAttribute.facts).toHaveLength(1);
    expect(JSON.stringify(byAttribute)).not.toContain("private synthetic quotation");
    expect(JSON.stringify(byAttribute)).toContain("person-1-hash");
    expect(JSON.stringify(byAttribute)).not.toContain("Hidden Example");

    const byEventTitle = await companyToolFromTool(deps, "company_search", {
      text: "Series A announcement",
    });
    expect(byEventTitle.facts).toHaveLength(1);
    const hiddenRelation = await companyToolFromTool(deps, "company_search", {
      text: "Confidential hidden-person event",
    });
    expect(hiddenRelation.facts).toEqual([]);

    const review = (await companyToolFromTool(deps, "company_review_next", {})) as {
      suggested: Array<{ kind: string; record: { id: string } }>;
      candidates: Array<{
        id: string;
        kind: string;
        reason: string;
        entityIds: string[];
      }>;
    };
    expect(review.suggested.map((fact) => [fact.kind, fact.record.id])).toEqual([
      ["entity", "person-1"],
      ["event", "event-1"],
    ]);
    expect(review.candidates).toEqual([
      {
        id: "candidate-1",
        kind: "entity",
        reason: "ambiguous entity match",
        entityIds: ["person-1"],
      },
    ]);
    expect(JSON.stringify(review)).not.toContain("person-2");
    expect(JSON.stringify(review)).not.toContain("Shared Example");
  });

  it("uses event precision and end dates, and withholds legal deadlines without consent", async () => {
    const personRecord = entity("person-1", "Visible Person", {});
    const eventRecord = (id: string, title: string, occursOn: unknown, endsOn: unknown = null) =>
      ({
        id,
        stream: "company",
        kind: "milestone",
        title,
        occursOn,
        endsOn,
        entityIds: ["person-1"],
        status: "suggested",
        confidence: 0.9,
        visibility: "private",
        evidence: [],
      }) as never;
    companyStoreMock.current = {
      list: vi.fn(async () => [personRecord]),
      listEdges: vi.fn(async () => []),
      listEvents: vi.fn(async () => [
        eventRecord("year", "Year precision", { date: "2025-01-01", precision: "year" }),
        eventRecord("month", "Month precision", { date: "2025-05-01", precision: "month" }),
        eventRecord("quarter", "Quarter precision", { date: "2025-04-01", precision: "quarter" }),
        eventRecord(
          "multiday",
          "Explicit end date",
          { date: "2025-06-28", precision: "day" },
          { date: "2025-07-02", precision: "day" },
        ),
      ]),
      teamFacts: vi.fn(async () => ({ entities: [], edges: [], events: [] })),
    };
    const result = await companyToolFromTool(
      {
        prisma: {} as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: false,
        dataRoomAllowed: async () => false,
      },
      "calendar_query",
      { from: "2025-05-31", to: "2025-06-30" },
    );
    expect((result.events as Array<{ title: string }>).map(({ title }) => title)).toEqual([
      "Year precision",
      "Month precision",
      "Quarter precision",
      "Explicit end date",
    ]);
    expect(result.deadlines).toEqual([]);
  });

  it("returns the current owner-scoped import plan without exposing consent or source content", async () => {
    const run = {
      id: "import-1",
      status: "configured",
      tokenCap: 1000n,
      mode: "sample",
      reservedTokens: 50n,
      inputTokensUsed: 20n,
      outputTokensUsed: 10n,
      sources: [
        {
          id: "source-1",
          sourceKind: "slack",
          connectionId: "connection-1",
          scope: { channels: ["synthetic-channel"] },
          plan: {
            itemCount: 10,
            tokensLower: 100,
            tokensUpper: 200,
            estimateBasis: "sample",
            body: "must not be returned",
          },
        },
      ],
    };
    const findFirst = vi.fn(async () => run);
    const result = await companyToolFromTool(
      {
        prisma: {
          companyImportRun: { findFirst },
        } as unknown as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: async () => false,
        companyImport: {
          consentStatus: vi.fn(async () => ({ allowed: false, recipient: null })),
          progress: vi.fn(async () => ({ status: "configured" })),
        } as never,
      },
      "company_import_plan",
      {},
    );
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      link: "/app/company/import",
      plan: {
        runId: "import-1",
        status: "configured",
        tokenCap: 1000,
        mode: "sample",
        usage: { reservedTokens: 50, inputTokensUsed: 20, outputTokensUsed: 10 },
        sources: [
          {
            sourceKind: "slack",
            connectionId: "connection-1",
            scope: { channels: ["synthetic-channel"] },
            plan: {
              itemCount: 10,
              tokensLower: 100,
              tokensUpper: 200,
              estimateBasis: "sample",
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("consents");

    const empty = await companyToolFromTool(
      {
        prisma: {
          companyImportRun: { findFirst: vi.fn(async () => null) },
        } as unknown as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: async () => false,
        companyImport: {
          consentStatus: vi.fn(async () => ({ allowed: false, recipient: null })),
          progress: vi.fn(async () => ({ status: "configured" })),
        } as never,
      },
      "company_import_plan",
      {},
    );
    expect(empty).toMatchObject({
      link: "/app/company/import",
      plan: null,
      progress: null,
    });
  });

  it("rejects caller-supplied scope, visibility, and review fields", () => {
    expect(CompanySearchInputSchema.safeParse({ text: "Acme", ownerUserId: "other" }).success).toBe(
      false,
    );
    expect(
      CompanyGetInputSchema.safeParse({ kind: "entity", id: "x", status: "confirmed" }).success,
    ).toBe(false);
    expect(
      TimelineQueryInputSchema.safeParse({
        from: "2026-01-01",
        to: "2026-12-31",
        spaceId: "other",
      }).success,
    ).toBe(false);
    expect(
      CalendarQueryInputSchema.safeParse({
        from: "2026-01-01",
        to: "2026-12-31",
        ownerUserId: "other",
      }).success,
    ).toBe(false);
    expect(
      CompanyFactUpsertInputSchema.safeParse({ operation: "create", ownerUserId: "other" }).success,
    ).toBe(false);
    expect(CompanyImportStartInputSchema.safeParse({ runId: "run-1", consent: true }).success).toBe(
      false,
    );
  });

  it("offers shared reads only through the owner and data-room authorization seam", () => {
    const authorized = companyToolsForRun({
      ownerRun: true,
      companyAgent: false,
      importer: false,
      dataRoomAllowed: true,
    });
    expect(authorized.map((tool) => tool.name)).toEqual([
      "company_search",
      "company_get",
      "timeline_query",
      "calendar_query",
    ]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: false,
        importer: false,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: true,
        companyAgent: false,
        importer: false,
        dataRoomAllowed: false,
      }),
    ).toEqual([]);
  });

  it("requires an owner run and a server-recorded approval for mutations", async () => {
    const prisma = {} as PrismaClient;
    const outsideOwnerRead = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_search",
      { text: "Company" },
    );
    expect(outsideOwnerRead.error).toMatch(/owner-started foreground run/i);

    const outsideOwner = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_fact_upsert",
      {},
    );
    expect(outsideOwner.error).toMatch(/owner-started/i);

    const noApproval = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: true,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_fact_upsert",
      {},
      { approvedByCard: false },
    );
    expect(noApproval.error).toMatch(/explicit owner approval/i);

    const noImportApproval = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: async () => true,
      },
      "company_import_start",
      { runId: "run-1" },
      { approvedByCard: false },
    );
    expect(noImportApproval.error).toMatch(/explicitly approved/i);
  });

  it("does not let tool arguments choose the Company actor", async () => {
    const dataRoomAllowed = vi.fn(async () => false);
    const companyTools = await import("./company-tools.js");
    const result = await companyTools.companyToolFromTool(
      {
        prisma: {} as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: false,
        dataRoomAllowed,
      },
      "company_search",
      { text: "Acme", userId: "other", spaceId: "other" },
    );
    expect(result.error).toBeDefined();
    expect(dataRoomAllowed).not.toHaveBeenCalled();
  });
});
