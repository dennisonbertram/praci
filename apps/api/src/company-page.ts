import type { Actor, CompanyFact, CompanyPageData } from "@rakazo/contracts";
import { companyFactIsVisible } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor } from "@rakazo/db";

export async function companyPage(prisma: PrismaClient, actor: Actor): Promise<CompanyPageData> {
  const store = companyForActor(prisma, actor);
  const [entities, edges, events, shared] = await Promise.all([
    store.list(),
    store.listEdges(),
    store.listEvents(),
    store.teamFacts(),
  ]);
  const visible = entities.filter(companyFactIsVisible);
  const ids = new Set(visible.map((row) => row.id));
  const visibleEdges = edges.filter(
    (row) => companyFactIsVisible(row) && ids.has(row.fromId) && ids.has(row.toId),
  );
  const visibleEvents = events.filter(
    (row) => companyFactIsVisible(row) && row.entityIds.every((id) => ids.has(id)),
  );
  const latestRun = await prisma.companyImportRun.findFirst({
    where: { spaceId: actor.spaceId, ownerUserId: actor.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  return {
    entities: [...visible, ...shared.entities].map((row) => ({
      ...row,
      edges: visibleEdges.filter((edge) => edge.fromId === row.id || edge.toId === row.id),
      events: visibleEvents.filter((event) => event.entityIds.includes(row.id)),
    })),
    edges: [...visibleEdges, ...shared.edges],
    events: [...visibleEvents, ...shared.events],
    latestRun,
  };
}

export async function companyFact(
  prisma: PrismaClient,
  actor: Actor,
  input: { kind: "entity" | "edge" | "event"; id: string },
): Promise<CompanyFact | null> {
  const store = companyForActor(prisma, actor);
  if (input.kind === "entity") {
    const record = (await companyPage(prisma, actor)).entities.find((row) => row.id === input.id);
    return record ? { kind: "entity", record } : null;
  }
  if (input.kind === "edge") {
    const record = await store.edgeDetail(input.id);
    if (!record) {
      const shared = await store.teamFacts();
      const teamRecord = shared.edges.find((edge) => edge.id === input.id);
      return teamRecord ? { kind: "edge", record: teamRecord } : null;
    }
    if (!companyFactIsVisible(record)) return null;
    const [from, to] = await Promise.all([store.detail(record.fromId), store.detail(record.toId)]);
    return from && companyFactIsVisible(from) && to && companyFactIsVisible(to)
      ? { kind: "edge", record }
      : null;
  }
  const record = await store.eventDetail(input.id);
  if (!record) {
    const shared = await store.teamFacts();
    const teamRecord = shared.events.find((event) => event.id === input.id);
    return teamRecord ? { kind: "event", record: teamRecord } : null;
  }
  if (!record || !companyFactIsVisible(record)) return null;
  const entities = await Promise.all(record.entityIds.map((id) => store.detail(id)));
  return entities.every((entity) => entity && companyFactIsVisible(entity))
    ? { kind: "event", record }
    : null;
}
