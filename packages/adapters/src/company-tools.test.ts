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

  const entity = (
    id: string,
    displayName: string,
    attrs: unknown,
    evidenceRows: unknown[] = [evidence(id)],
  ) =>
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
      readAllowed: true,
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

  it("keeps nested Data Room relationships out of sanitized entity projections", async () => {
    const gmailEvidence = {
      ...evidence("gmail-evidence", "gmail"),
      sourceItemId: "gmail-message-1",
      sourceUrl: "https://mail.example.test/message/1",
      quote: "PRIVATE_GMAIL_QUOTE",
      extractorModel: "PRIVATE_MODEL_METADATA",
    };
    const edgeEvidence = {
      ...evidence("data-room-edge-evidence", "data_room"),
      quote: "PRIVATE_DATA_ROOM_EDGE_QUOTE",
      extractorModel: "PRIVATE_MODEL_METADATA",
    };
    const corroboratingEdgeEvidence = {
      ...evidence("gmail-edge-evidence", "gmail"),
      factKind: "edge",
      factId: "data-room-edge",
    };
    const eventEvidence = {
      ...evidence("data-room-event-evidence", "data_room"),
      quote: "PRIVATE_DATA_ROOM_EVENT_QUOTE",
      extractorModel: "PRIVATE_MODEL_METADATA",
    };
    const corroboratingEventEvidence = {
      ...evidence("gmail-event-evidence", "gmail"),
      factKind: "event",
      factId: "data-room-event",
    };
    const hiddenEndpoint = entity("hidden-person", "Hidden Data Room Person", {}, [
      evidence("hidden-endpoint-evidence", "data_room"),
    ]);
    const dataRoomEdge = {
      id: "data-room-edge",
      fromId: "person-1",
      toId: "hidden-person",
      relation: "works_with",
      role: null,
      confidence: 0.2,
      status: "suggested",
      visibility: "private",
      evidence: [edgeEvidence, corroboratingEdgeEvidence],
    } as never;
    const dataRoomEvent = {
      id: "data-room-event",
      stream: "private",
      kind: "meeting",
      title: "Private Data Room Event",
      occursOn: { date: "2026-01-01", precision: "day" },
      endsOn: null,
      entityIds: ["person-1", "hidden-person"],
      confidence: 0.2,
      status: "suggested",
      visibility: "private",
      evidence: [eventEvidence, corroboratingEventEvidence],
    } as never;
    const personWithNestedRelationships = {
      ...(entity("person-1", "Gmail Person", {}, [gmailEvidence]) as object),
      edges: [dataRoomEdge],
      events: [dataRoomEvent],
    } as never;
    companyStoreMock.current = {
      list: vi.fn(async () => [personWithNestedRelationships, hiddenEndpoint]),
      listEdges: vi.fn(async () => [dataRoomEdge]),
      listEvents: vi.fn(async () => [dataRoomEvent]),
      candidates: vi.fn(async () => []),
      teamFacts: vi.fn(async () => ({ entities: [], edges: [], events: [] })),
    };
    const deps = {
      prisma: {} as PrismaClient,
      actor,
      ownerRun: true,
      companyAgent: false,
      importer: false,
      readAllowed: true,
      dataRoomAllowed: async () => false,
    };

    const deniedSearch = await companyToolFromTool(deps, "company_search", {
      text: "Gmail Person",
    });
    const deniedGet = await companyToolFromTool(deps, "company_get", {
      kind: "entity",
      id: "person-1",
    });
    const deniedReview = await companyToolFromTool(deps, "company_review_next", {});
    const deniedOutput = JSON.stringify([deniedSearch, deniedGet, deniedReview]);
    expect(deniedOutput).not.toContain("hidden-person");
    expect(deniedOutput).not.toContain("data-room-edge");
    expect(deniedOutput).not.toContain("data-room-event");
    expect(deniedOutput).not.toContain("PRIVATE_DATA_ROOM");
    expect((deniedGet.fact as { record: { edges: unknown[]; events: unknown[] } }).record).toEqual(
      expect.objectContaining({ edges: [], events: [] }),
    );

    const authorizedDeps = { ...deps, dataRoomAllowed: async () => true };
    const authorizedSearch = await companyToolFromTool(authorizedDeps, "company_search", {});
    const authorizedGet = await companyToolFromTool(authorizedDeps, "company_get", {
      kind: "entity",
      id: "person-1",
    });
    const authorizedReview = await companyToolFromTool(authorizedDeps, "company_review_next", {});
    const authorizedOutput = JSON.stringify([authorizedSearch, authorizedGet, authorizedReview]);
    expect(authorizedOutput).not.toContain("PRIVATE_GMAIL_QUOTE");
    expect(authorizedOutput).not.toContain("PRIVATE_DATA_ROOM");
    expect(authorizedOutput).not.toContain("PRIVATE_MODEL_METADATA");
    expect(authorizedOutput).not.toContain("extractorModel");

    const facts = authorizedSearch.facts as Array<{
      kind: string;
      record: {
        id: string;
        evidence?: Array<Record<string, unknown>>;
        edges?: unknown[];
        events?: unknown[];
      };
    }>;
    const personFact = facts.find(
      (fact) => fact.kind === "entity" && fact.record.id === "person-1",
    );
    const edgeFact = facts.find(
      (fact) => fact.kind === "edge" && fact.record.id === "data-room-edge",
    );
    const eventFact = facts.find(
      (fact) => fact.kind === "event" && fact.record.id === "data-room-event",
    );
    expect(personFact?.record).toMatchObject({ edges: [], events: [] });
    expect(personFact?.record.evidence?.[0]).toMatchObject({
      sourceItemId: "gmail-message-1",
      sourceUrl: "https://mail.example.test/message/1",
    });
    expect(edgeFact?.record.evidence?.[0]).toMatchObject({
      id: "data-room-edge-evidence",
      dataRoomItemId: "dr-item-1",
      sourceItemId: "data-room-edge-evidence-source",
    });
    expect(eventFact?.record.evidence?.[0]).toMatchObject({
      id: "data-room-event-evidence",
      dataRoomItemId: "dr-item-1",
      sourceItemId: "data-room-event-evidence-source",
    });
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
        readAllowed: true,
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
        {
          id: "source-2",
          sourceKind: "data_room",
          connectionId: null,
          scope: {},
          plan: {},
        },
        {
          id: "source-3",
          sourceKind: "mcp",
          connectionId: null,
          mcpServerId: "mcp-server-1",
          scope: { reader: "slack" },
          plan: {},
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
        readAllowed: false,
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
          { sourceKind: "data_room", connectionId: null, scope: {}, plan: null },
          {
            sourceKind: "mcp",
            connectionId: null,
            mcpServerId: "mcp-server-1",
            scope: { reader: "slack" },
            plan: null,
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("consents");
    expect(JSON.stringify(result)).not.toContain("must not be returned");

    const empty = await companyToolFromTool(
      {
        prisma: {
          companyImportRun: { findFirst: vi.fn(async () => null) },
        } as unknown as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        readAllowed: false,
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

  it.each([
    ["budget_reached", true],
    ["paused", false],
  ])("handles resume for an import with %s status", async (status, budgetReached) => {
    const progress = vi.fn(async () => ({ status }));
    const action = vi.fn(async () => ({ status: "running" }));
    const result = await companyToolFromTool(
      {
        prisma: {} as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        readAllowed: false,
        dataRoomAllowed: async () => false,
        companyImport: { progress, action } as never,
      },
      "company_import_resume",
      { runId: "import-1" },
    );

    expect(progress).toHaveBeenCalledExactlyOnceWith(actor, "import-1");
    if (budgetReached) {
      expect(result).toMatchObject({
        untrusted: true,
        budgetRequired: true,
        link: "/app/company/import",
      });
      expect(result.message).toContain("Raise the token cap");
      expect(action).not.toHaveBeenCalled();
    } else {
      expect(action).toHaveBeenCalledExactlyOnceWith(actor, "import-1", "resume");
      expect(result).toEqual({ untrusted: true, progress: { status: "running" } });
    }
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

  it("offers shared reads through explicit read eligibility", () => {
    const authorized = companyToolsForRun({
      ownerRun: true,
      companyAgent: false,
      importer: false,
      readAllowed: true,
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
        readAllowed: true,
      }).map((tool) => tool.name),
    ).toEqual(["company_search", "company_get", "timeline_query", "calendar_query"]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: true,
        importer: false,
        readAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: false,
        importer: true,
        readAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: true,
        companyAgent: false,
        importer: false,
        readAllowed: false,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: true,
        companyAgent: true,
        importer: false,
        readAllowed: true,
      }).map((tool) => tool.name),
    ).toContain("company_fact_upsert");
    expect(
      companyToolsForRun({
        ownerRun: true,
        companyAgent: false,
        importer: true,
        readAllowed: true,
      }).map((tool) => tool.name),
    ).not.toContain("company_fact_upsert");
  });

  it("requires an owner run and a server-recorded approval for mutations", async () => {
    const prisma = {} as PrismaClient;
    const unauthorizedRead = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: false,
        readAllowed: false,
        dataRoomAllowed: async () => true,
      },
      "company_search",
      { text: "Company" },
    );
    expect(unauthorizedRead.error).toMatch(/not authorized/i);

    const outsideOwnerRead = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        readAllowed: false,
        dataRoomAllowed: async () => true,
      },
      "company_search",
      { text: "Company" },
    );
    expect(outsideOwnerRead.error).toMatch(/not authorized/i);

    const outsideOwner = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        readAllowed: false,
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
        readAllowed: true,
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
        readAllowed: false,
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
        readAllowed: true,
        dataRoomAllowed,
      },
      "company_search",
      { text: "Acme", userId: "other", spaceId: "other" },
    );
    expect(result.error).toBeDefined();
    expect(dataRoomAllowed).not.toHaveBeenCalled();
  });
});
