import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { CompanyPrivacyBusinessError, companyForActor } from "./company.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company privacy controls (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-privacy-org-${suffix}`;
  const spaceId = `company-privacy-space-${suffix}`;
  const ownerId = `company-privacy-owner-${suffix}`;
  const memberId = `company-privacy-member-${suffix}`;
  const actor = (userId: string): Actor => ({
    spaceId,
    userId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(ownerId);
  const member = actor(memberId);
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
      ],
    });
    await prisma.organization.create({
      data: { id: organizationId, name: organizationId, slug: organizationId, createdAt },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "Company privacy test space" },
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
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
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
    const excluded = record(
      await company.importEntity(person("Privacy Casey", "privacy-casey", "casey@example.test")),
    );
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
    await company.excludePerson(excluded.id);
    expect(await company.detail(excluded.id)).toBeNull();
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

    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      true,
    );
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
    expect(await prisma.companyImportRun.findUnique({ where: { id: run.id } })).toBeNull();
  });
});
