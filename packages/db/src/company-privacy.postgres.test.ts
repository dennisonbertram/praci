import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { CompanyPrivacyBusinessError, companyForActor } from "./company.js";
import {
  claimCompanyImportUnit,
  completeCompanyImportUnit,
  createCompanyImportRun,
  startCompanyImportRun,
} from "./company-import.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company privacy controls (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-privacy-org-${suffix}`;
  const spaceId = `company-privacy-space-${suffix}`;
  const otherSpaceId = `company-privacy-other-space-${suffix}`;
  const ownerId = `company-privacy-owner-${suffix}`;
  const memberId = `company-privacy-member-${suffix}`;
  const eventOwnerId = `company-privacy-event-owner-${suffix}`;
  const actor = (userId: string, actorSpaceId = spaceId): Actor => ({
    spaceId: actorSpaceId,
    userId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(ownerId);
  const member = actor(memberId);
  const eventOwner = actor(eventOwnerId);
  const otherSpaceOwner = actor(ownerId, otherSpaceId);
  const evidence = (sourceItemId: string, contentHash: string) => ({
    stance: "supports" as const,
    sourceKind: "slack" as const,
    sourceItemId,
    quote: "Synthetic source quote.",
    contentHash,
    extractedAt: "2026-01-02T03:04:05.000Z",
    extractorModel: null,
    confidence: 0.9,
  });
  const person = (displayName: string, sourceItemId: string, email: string) => ({
    entity: {
      kind: "person" as const,
      displayName,
      attrs: { workEmails: [email] },
      confidence: 0.9,
    },
    evidence: evidence(sourceItemId, `${sourceItemId}-hash`),
  });
  const record = <T extends object>(value: T) => {
    if ("suppressed" in value || "deferred" in value)
      throw new Error("Expected a persisted company record");
    return value as Exclude<T, { suppressed: true } | { deferred: true }>;
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const createdAt = new Date();
    await prisma.user.createMany({
      data: [
        { id: ownerId, name: ownerId, email: `${ownerId}@example.test` },
        { id: memberId, name: memberId, email: `${memberId}@example.test` },
        { id: eventOwnerId, name: eventOwnerId, email: `${eventOwnerId}@example.test` },
      ],
    });
    await prisma.organization.create({
      data: { id: organizationId, name: organizationId, slug: organizationId, createdAt },
    });
    await prisma.space.createMany({
      data: [
        { id: spaceId, organizationId, name: "Company privacy test space" },
        { id: otherSpaceId, organizationId, name: "Company privacy other space" },
      ],
    });
    await prisma.member.createMany({
      data: [
        {
          id: `company-privacy-member-owner-${suffix}`,
          organizationId,
          userId: ownerId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-privacy-member-user-${suffix}`,
          organizationId,
          userId: memberId,
          role: "member",
          createdAt,
        },
        {
          id: `company-privacy-member-event-owner-${suffix}`,
          organizationId,
          userId: eventOwnerId,
          role: "member",
          createdAt,
        },
      ],
    });
    await prisma.spaceMember.createMany({
      data: [
        {
          id: `company-privacy-space-owner-${suffix}`,
          spaceId,
          organizationId,
          userId: ownerId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-privacy-space-user-${suffix}`,
          spaceId,
          organizationId,
          userId: memberId,
          role: "member",
          createdAt,
        },
        {
          id: `company-privacy-space-event-owner-${suffix}`,
          spaceId,
          organizationId,
          userId: eventOwnerId,
          role: "member",
          createdAt,
        },
        {
          id: `company-privacy-space-other-owner-${suffix}`,
          spaceId: otherSpaceId,
          organizationId,
          userId: ownerId,
          role: "owner",
          createdAt,
        },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, memberId, eventOwnerId] } },
    });
    await close();
  });

  it("enforces exclusion, semantic unsharing, source disconnect, and redacted team reads", async () => {
    const company = companyForActor(prisma, owner);
    const reader = companyForActor(prisma, member);
    const first = record(
      await company.importEntity(person("Privacy Alice", "privacy-alice", "alice@example.test")),
    );
    const second = record(
      await company.importEntity(person("Privacy Blair", "privacy-blair", "blair@example.test")),
    );
    const excludedRoot = record(
      await company.importEntity(
        person("Privacy Casey root", "privacy-casey-root", "casey-root@example.test"),
      ),
    );
    const excluded = record(
      await company.importEntity(person("Privacy Casey", "privacy-casey", "casey@example.test")),
    );
    await company.merge(excluded.id, excludedRoot.id);
    const privatePerson = record(
      await company.importEntity(
        person("Private Endpoint", "privacy-private", "private@example.test"),
      ),
    );
    for (const entity of [first, second]) await company.confirm(entity.id);
    await company.visibility({ kind: "entity", id: first.id, visibility: "team" });
    await expect(
      company.visibility({ kind: "entity", id: excluded.id, visibility: "team" }),
    ).rejects.toBeInstanceOf(CompanyPrivacyBusinessError);
    await expect(
      company.visibility({ kind: "entity", id: excluded.id, visibility: "team" }),
    ).rejects.toThrow("Confirm this fact first");
    await company.confirm(second.id);
    await company.visibility({ kind: "entity", id: second.id, visibility: "team" });

    const edgeInput = {
      edge: {
        fromId: first.id,
        toId: second.id,
        relation: "works_at" as const,
        startsOn: null,
        endsOn: null,
        role: "Engineer",
        confidence: 0.9,
      },
      evidence: evidence("privacy-edge", "privacy-edge-hash"),
    };
    const privateEdge = record(
      await company.importEdge({
        ...edgeInput,
        edge: { ...edgeInput.edge, toId: privatePerson.id },
        evidence: evidence("privacy-private-edge", "privacy-private-edge-hash"),
      }),
    );
    await company.confirmEdge(privateEdge.id);
    await expect(
      company.visibility({ kind: "edge", id: privateEdge.id, visibility: "team" }),
    ).rejects.toThrow("Share linked facts first");

    const edge = record(await company.importEdge(edgeInput));
    await company.confirmEdge(edge.id);
    await company.visibility({ kind: "edge", id: edge.id, visibility: "team" });
    await company.editEdge({ edgeId: edge.id, confidence: 0.7 });
    expect((await reader.teamFacts()).edges.map((item) => item.id)).toContain(edge.id);
    await company.editEdge({ edgeId: edge.id, role: "Director" });
    expect((await reader.teamFacts()).edges.map((item) => item.id)).not.toContain(edge.id);
    await company.visibility({ kind: "edge", id: edge.id, visibility: "team" });
    await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Privacy Alice",
        attrs: { workEmails: ["alice@example.test"], aliases: ["Alice updated"] },
        confidence: 0.9,
      },
      evidence: evidence("privacy-alice-updated", "privacy-alice-updated-hash"),
    });
    expect((await reader.teamFacts()).entities.map((item) => item.id)).not.toContain(first.id);
    expect((await reader.teamFacts()).edges.map((item) => item.id)).not.toContain(edge.id);
    await company.visibility({ kind: "entity", id: first.id, visibility: "team" });
    expect((await reader.teamFacts()).edges.map((item) => item.id)).not.toContain(edge.id);
    await company.visibility({ kind: "edge", id: edge.id, visibility: "team" });

    const eventInput = {
      event: {
        stream: "people" as const,
        kind: "hire" as const,
        title: "Privacy event",
        occursOn: null,
        endsOn: null,
        entityIds: [first.id],
        amountCents: null,
        currency: null,
        confidence: 0.9,
      },
      evidence: evidence("privacy-event", "privacy-event-hash"),
    };
    const event = record(await company.importEvent(eventInput));
    await company.confirmEvent(event.id);
    await company.visibility({ kind: "event", id: event.id, visibility: "team" });
    await company.importEvent(eventInput);
    expect((await reader.teamFacts()).events.map((item) => item.id)).toContain(event.id);
    await company.editEvent({ eventId: event.id, title: "Updated privacy event" });
    expect((await reader.teamFacts()).events.map((item) => item.id)).not.toContain(event.id);
    await company.visibility({ kind: "event", id: event.id, visibility: "team" });
    await company.editEvent({ eventId: event.id, entityIds: [second.id] });
    expect((await reader.teamFacts()).events.map((item) => item.id)).not.toContain(event.id);

    const mixedEvent = record(
      await company.importEvent({
        event: {
          stream: "people",
          kind: "hire",
          title: "Mixed event",
          occursOn: null,
          endsOn: null,
          entityIds: [excluded.id, privatePerson.id],
          amountCents: null,
          currency: null,
          confidence: 0.8,
        },
        evidence: evidence("privacy-mixed-event", "privacy-mixed-event-hash"),
      }),
    );
    const soleEvent = record(
      await company.importEvent({
        event: {
          stream: "people",
          kind: "hire",
          title: "Sole event",
          occursOn: null,
          endsOn: null,
          entityIds: [excluded.id],
          amountCents: null,
          currency: null,
          confidence: 0.8,
        },
        evidence: evidence("privacy-sole-event", "privacy-sole-event-hash"),
      }),
    );
    const pendingRelation = await prisma.companyCandidate.create({
      data: {
        spaceId,
        ownerUserId: ownerId,
        kind: "event",
        reason: "unresolved_import_subjects",
        entityIds: [],
        proposedFact: {
          entities: [
            {
              ref: "excluded-person",
              entity: {
                kind: "person",
                displayName: "Privacy Casey",
                attrs: { workEmails: ["casey@example.test"] },
                confidence: 0.9,
              },
            },
          ],
        },
        sourceKind: "slack",
        connectionId: null,
        mcpServerId: null,
        dataRoomItemId: null,
        sourceItemId: "privacy-pending-relation",
        sourceKey: `privacy-pending-relation-${suffix}`,
        quote: "Synthetic unresolved relation.",
        contentHash: `privacy-pending-relation-${suffix}`,
      },
      select: { id: true },
    });
    await company.excludePerson(excluded.id);
    expect(await company.detail(excluded.id)).toBeNull();
    expect(await company.detail(excludedRoot.id)).toBeNull();
    expect(
      await prisma.companyCandidate.findUnique({ where: { id: pendingRelation.id } }),
    ).toBeNull();
    expect(await company.eventDetail(mixedEvent.id)).toMatchObject({
      entityIds: [privatePerson.id],
    });
    expect(await company.eventDetail(soleEvent.id)).toBeNull();
    expect(
      await company.importEntity(
        person("Privacy Casey", "privacy-casey-new", "casey@example.test"),
      ),
    ).toMatchObject({ suppressed: true, record: null });
    expect(
      await company.importEntity(
        person("Privacy Casey", "privacy-casey-name-only", "changed@example.test"),
      ),
    ).toMatchObject({ suppressed: true, record: null });

    const connection = await prisma.connection.create({
      data: {
        spaceId,
        userId: ownerId,
        connectorId: "google",
        provider: "google",
        displayName: "Privacy data room connection",
        status: "connected",
      },
    });
    const roomItem = await prisma.dataRoomItem.create({
      data: {
        spaceId,
        userId: ownerId,
        source: "drive",
        sha256: `privacy-room-${suffix}`,
        name: "Privacy room document",
        mimeType: "text/plain",
        size: 12,
        sourceConnectionId: connection.id,
      },
    });
    const roomFact = record(
      await company.importEntity({
        entity: {
          kind: "organisation",
          displayName: "Privacy room organization",
          attrs: {},
          confidence: 0.8,
        },
        evidence: {
          ...evidence("privacy-room-item", "privacy-room-hash"),
          sourceKind: "data_room",
          connectionId: connection.id,
          dataRoomItemId: roomItem.id,
        },
      }),
    );
    await company.sourceControl(
      { sourceKind: "data_room", connectionId: connection.id, mcpServerId: null },
      false,
    );
    expect(await company.detail(roomFact.id)).toBeNull();
    await expect(
      company.importEntity({
        entity: {
          kind: "organisation",
          displayName: "Privacy room organization",
          attrs: {},
          confidence: 0.8,
        },
        evidence: {
          ...evidence("privacy-room-item-late", "privacy-room-late-hash"),
          sourceKind: "data_room",
          connectionId: null,
          dataRoomItemId: roomItem.id,
        },
      }),
    ).rejects.toThrow("Company source is disconnected");
    await expect(
      company.importEntity({
        entity: {
          kind: "organisation",
          displayName: "Privacy room organization",
          attrs: {},
          confidence: 0.8,
        },
        evidence: {
          ...evidence(roomItem.id, "privacy-room-late-source-item-hash"),
          sourceKind: "data_room",
          connectionId: null,
        },
      }),
    ).rejects.toThrow("Company source is disconnected");
    await company.sourceControl(
      { sourceKind: "data_room", connectionId: null, mcpServerId: null },
      false,
    );
    expect(
      (await company.privacy()).sources.some(
        (source) => source.sourceKind === "data_room" && source.connectionId === connection.id,
      ),
    ).toBe(false);
    await company.sourceControl(
      { sourceKind: "data_room", connectionId: null, mcpServerId: null },
      true,
    );
    expect(
      (await company.privacy()).sources.find(
        (source) => source.sourceKind === "data_room" && source.connectionId === connection.id,
      ),
    ).toMatchObject({ blocked: true });
    await expect(
      company.sourceControl(
        { sourceKind: "manual", connectionId: null, mcpServerId: null } as never,
        false,
      ),
    ).rejects.toThrow("Manual evidence cannot be disconnected");

    const blockedPerson = record(
      await company.importEntity(
        person("Disconnected", "privacy-disconnect", "disconnect@example.test"),
      ),
    );
    await company.edit({
      entityId: blockedPerson.id,
      kind: "person",
      displayName: "Owner correction",
    });
    await company.reject(privatePerson.id, "Retained ordinary rejection");
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: ownerId, sourceKind: "slack" },
      }),
    ).toBe(0);
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: ownerId, sourceKind: "manual" },
      }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.companyRejection.count({
        where: { spaceId, ownerUserId: ownerId, excludedPerson: false },
      }),
    ).toBeGreaterThan(0);
    expect((await company.privacy()).sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "slack", connectionId: null, blocked: true }),
      ]),
    );
    await expect(
      company.importEntity(person("Blocked import", "privacy-blocked", "blocked@example.test")),
    ).rejects.toThrow("Company source is disconnected");

    const sharedByMember = record(
      await reader.importEntity(
        person("Member shared", "member-shared", "member-shared@example.test"),
      ),
    );
    await reader.confirm(sharedByMember.id);
    await reader.visibility({ kind: "entity", id: sharedByMember.id, visibility: "team" });
    const teamFacts = await company.teamFacts();
    expect(teamFacts.entities.map((item) => item.id)).toContain(sharedByMember.id);
    expect(teamFacts.entities.find((item) => item.id === sharedByMember.id)).toMatchObject({
      readOnly: true,
      evidence: [],
      identities: [],
      mergedFrom: [],
      lockedFields: [],
      confirmedAt: null,
      confirmedByUserId: null,
    });
    expect(
      teamFacts.edges.some(
        (item) => item.fromId === privatePerson.id || item.toId === privatePerson.id,
      ),
    ).toBe(false);
    expect((await reader.export()).entities.some((item) => item.id === first.id)).toBe(false);
    const exportData = await company.export();
    expect(exportData.version).toBe(1);
    expect(exportData.entities.some((item) => item.id === first.id)).toBe(true);
    expect(exportData.entities.some((item) => item.id === sharedByMember.id)).toBe(false);
    const foreignSpaceCompany = companyForActor(prisma, otherSpaceOwner);
    const foreignSpaceFact = record(
      await foreignSpaceCompany.importEntity(
        person("Other space private", "other-space-private", "other-space@example.test"),
      ),
    );
    expect((await company.export()).entities.some((item) => item.id === foreignSpaceFact.id)).toBe(
      false,
    );
    expect((await foreignSpaceCompany.export()).entities.some((item) => item.id === first.id)).toBe(
      false,
    );
    await expect(
      foreignSpaceCompany.visibility({ kind: "entity", id: first.id, visibility: "team" }),
    ).rejects.toThrow("Company fact not found");
    await expect(
      foreignSpaceCompany.sourceControl(
        { sourceKind: "data_room", connectionId: connection.id, mcpServerId: null },
        false,
      ),
    ).rejects.toThrow("Company source not found");
    await expect(
      reader.visibility({ kind: "entity", id: first.id, visibility: "team" }),
    ).rejects.toThrow("Company fact not found");
    await expect(
      reader.sourceControl(
        { sourceKind: "data_room", connectionId: connection.id, mcpServerId: null },
        false,
      ),
    ).rejects.toThrow("Company source not found");

    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      true,
    );
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    await reader.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    const slackBlocks = await prisma.companySourceBlock.findMany({
      where: {
        spaceId,
        sourceKind: "slack",
        connectionId: null,
        mcpServerId: null,
      },
      select: { id: true, ownerUserId: true },
    });
    expect(slackBlocks.map((block) => block.ownerUserId).sort()).toEqual(
      [memberId, ownerId].sort(),
    );
    expect(new Set(slackBlocks.map((block) => block.id)).size).toBe(2);
    const memberBlock = slackBlocks.find((block) => block.ownerUserId === memberId)!;
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      true,
    );
    expect(
      await prisma.companySourceBlock.findUnique({ where: { id: memberBlock.id } }),
    ).not.toBeNull();
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    const run = await prisma.companyImportRun.create({
      data: {
        id: `company-privacy-run-${suffix}`,
        spaceId,
        ownerUserId: ownerId,
        status: "running",
        tokenCap: 100n,
        disclosureVersion: "privacy-test",
      },
    });
    await company.eraseMap();
    expect(
      await prisma.companySourceBlock.count({ where: { spaceId, ownerUserId: ownerId } }),
    ).toBe(0);
    expect(
      await prisma.companySourceBlock.findUnique({ where: { id: memberBlock.id } }),
    ).not.toBeNull();
    expect(await prisma.companyImportRun.findUnique({ where: { id: run.id } })).toBeNull();
  });

  it("returns standalone team events and filters shared relations independently", async () => {
    const reader = companyForActor(prisma, owner);
    const memberCompany = companyForActor(prisma, member);
    const searchEvidence = (sourceItemId: string) => ({
      ...evidence(sourceItemId, `${sourceItemId}-hash`),
      sourceKind: "github" as const,
    });
    const searchPerson = (displayName: string, sourceItemId: string, email: string) => ({
      entity: {
        kind: "person" as const,
        displayName,
        attrs: { workEmails: [email] },
        confidence: 0.9,
      },
      evidence: searchEvidence(sourceItemId),
    });
    const first = record(
      await memberCompany.importEntity(
        searchPerson("Search endpoint one", "search-endpoint-one", "one@example.test"),
      ),
    );
    const second = record(
      await memberCompany.importEntity(
        searchPerson("Search endpoint two", "search-endpoint-two", "two@example.test"),
      ),
    );
    for (const entity of [first, second]) {
      await memberCompany.confirm(entity.id);
      await memberCompany.visibility({ kind: "entity", id: entity.id, visibility: "team" });
    }
    const edge = record(
      await memberCompany.importEdge({
        edge: {
          fromId: first.id,
          toId: second.id,
          relation: "works_at",
          startsOn: null,
          endsOn: null,
          role: "Distinctive role needle",
          confidence: 0.9,
        },
        evidence: searchEvidence("distinctive-role-edge"),
      }),
    );
    await memberCompany.confirmEdge(edge.id);
    await memberCompany.visibility({ kind: "edge", id: edge.id, visibility: "team" });
    const roleSearch = await reader.teamFacts("Distinctive role needle");
    expect(roleSearch.entities).toEqual([]);
    expect(roleSearch.edges.map((item) => item.id)).toContain(edge.id);

    const eventCompany = companyForActor(prisma, eventOwner);
    const standaloneEvent = record(
      await eventCompany.importEvent({
        event: {
          stream: "people",
          kind: "hire",
          title: "Standalone event search needle",
          occursOn: null,
          endsOn: null,
          entityIds: [],
          amountCents: null,
          currency: null,
          confidence: 0.9,
        },
        evidence: searchEvidence("standalone-event"),
      }),
    );
    await eventCompany.confirmEvent(standaloneEvent.id);
    await eventCompany.visibility({ kind: "event", id: standaloneEvent.id, visibility: "team" });
    expect((await reader.teamFacts()).events.map((item) => item.id)).toContain(standaloneEvent.id);
    const titleSearch = await reader.teamFacts("Standalone event search needle");
    expect(titleSearch.events.map((item) => item.id)).toContain(standaloneEvent.id);
  });

  it("cleans Data Room and MCP orphans and fences claimed imports after disconnect or erase", async () => {
    const company = companyForActor(prisma, owner);
    const roomItem = await prisma.dataRoomItem.create({
      data: {
        spaceId,
        userId: ownerId,
        source: "upload",
        sha256: `privacy-delete-room-${suffix}`,
        name: "Synthetic deleted document",
        mimeType: "text/plain",
        size: 10,
      },
    });
    const roomFact = record(
      await company.importEntity({
        entity: {
          kind: "organisation",
          displayName: "Deleted document organization",
          attrs: {},
          confidence: 0.8,
        },
        evidence: {
          ...evidence(roomItem.id, `privacy-delete-room-evidence-${suffix}`),
          sourceKind: "data_room",
          dataRoomItemId: roomItem.id,
        },
      }),
    );
    await prisma.dataRoomItem.delete({ where: { id: roomItem.id } });
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: ownerId, factId: roomFact.id },
      }),
    ).toBe(0);
    expect(await company.detail(roomFact.id)).toBeNull();

    const mcpServer = await prisma.mcpServer.create({
      data: {
        spaceId,
        userId: ownerId,
        slug: `privacy-mcp-${suffix}`,
        name: "Synthetic MCP",
        transport: "http",
      },
    });
    const mcpFact = record(
      await company.importEntity({
        entity: {
          kind: "organisation",
          displayName: "Removed MCP organization",
          attrs: {},
          confidence: 0.8,
        },
        evidence: {
          ...evidence("privacy-mcp-item", `privacy-mcp-evidence-${suffix}`),
          sourceKind: "mcp",
          mcpServerId: mcpServer.id,
        },
      }),
    );
    await prisma.mcpServer.delete({ where: { id: mcpServer.id } });
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: ownerId, factId: mcpFact.id },
      }),
    ).toBe(0);
    expect(await company.detail(mcpFact.id)).toBeNull();

    async function claimRun(sourceKind: "slack" | "github") {
      const run = await createCompanyImportRun(prisma, owner, {
        tokenCap: 100,
        sources: [{ sourceKind, scope: {} }],
      });
      await startCompanyImportRun(prisma, owner, run.id);
      const unit = await prisma.companyImportUnit.findFirstOrThrow({
        where: { spaceId, ownerUserId: ownerId, runId: run.id },
      });
      const claim = await claimCompanyImportUnit(prisma, owner, {
        runId: run.id,
        unitId: unit.id,
      });
      if (!claim) throw new Error("Expected a claimed import unit");
      return { runId: run.id, claim };
    }
    const disconnected = await claimRun("slack");
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    await expect(
      completeCompanyImportUnit(prisma, owner, {
        runId: disconnected.runId,
        sourceId: disconnected.claim.sourceId,
        unitId: disconnected.claim.id,
        claimToken: disconnected.claim.claimToken,
        nextCursor: null,
        done: true,
        itemsDiscovered: 0,
        itemsRead: 0,
        facts: [],
      }),
    ).rejects.toMatchObject({ code: "stale_claim" });

    const erased = await claimRun("github");
    await company.eraseMap();
    await expect(
      completeCompanyImportUnit(prisma, owner, {
        runId: erased.runId,
        sourceId: erased.claim.sourceId,
        unitId: erased.claim.id,
        claimToken: erased.claim.claimToken,
        nextCursor: null,
        done: true,
        itemsDiscovered: 0,
        itemsRead: 0,
        facts: [],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("cascades Company state when its space is deleted", async () => {
    const company = companyForActor(prisma, otherSpaceOwner);
    const fact = record(
      await company.importEntity(
        person("Cascade space fact", "cascade-space-fact", "cascade@example.test"),
      ),
    );
    await company.sourceControl(
      { sourceKind: "github", connectionId: null, mcpServerId: null },
      false,
    );
    const run = await createCompanyImportRun(prisma, otherSpaceOwner, {
      tokenCap: 100,
      sources: [{ sourceKind: "slack", scope: {} }],
    });
    await prisma.space.delete({ where: { id: otherSpaceId } });
    expect(await prisma.companyEntity.findUnique({ where: { id: fact.id } })).toBeNull();
    expect(await prisma.companySourceBlock.count({ where: { spaceId: otherSpaceId } })).toBe(0);
    expect(await prisma.companyImportRun.findUnique({ where: { id: run.id } })).toBeNull();
  });
});
