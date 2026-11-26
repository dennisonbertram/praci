import { ORPCError } from "@orpc/server";
import type { MemoryStore } from "@rakazo/adapter-kit";
import { MEMORY_REVISION_CONFLICT_ERROR } from "@rakazo/adapter-kit";
import type { CompanyContextRevision, CompanyContextSection } from "@rakazo/contracts";
import {
  COMPANY_SECTION_MAX_COUNT,
  companySectionContent,
  companySectionError,
  companySlug,
  parseCompanySection,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { IsolationError } from "@rakazo/db";

type Deps = { prisma: PrismaClient; memory: MemoryStore };
type Actor = { spaceId: string; userId: string };

const own = (actor: Actor) => ({
  spaceId: actor.spaceId,
  userId: actor.userId,
  scope: "company",
  botId: null,
});

const contextOf = (actor: Actor) => ({
  operationId: "company-context",
  traceId: "company-context",
  spaceId: actor.spaceId,
  userId: actor.userId,
  signal: new AbortController().signal,
});

function toSection(doc: {
  id: string;
  path: string;
  content: string;
  revision: number;
  updatedAt?: string | Date;
}): CompanyContextSection {
  const { title, body, summary } = parseCompanySection(doc.content);
  return {
    id: doc.id,
    slug: doc.path,
    title,
    summary,
    text: body,
    revision: doc.revision,
    updatedAt: new Date(doc.updatedAt ?? Date.now()).toISOString(),
  };
}

const bad = (message: string) => new ORPCError("BAD_REQUEST", { message });
const changed = () =>
  new ORPCError("CONFLICT", { message: "This section changed since it was opened" });

const taken = () => new ORPCError("CONFLICT", { message: "That name is taken." });

/** A name is taken when another section's current title gives the same key. */
async function ensureNameFree(deps: Deps, actor: Actor, id: string, title: string) {
  const key = companySlug(title);
  const others = await deps.prisma.memoryDocument.findMany({
    where: { ...own(actor), id: { not: id } },
    select: { content: true },
  });
  if (others.some((doc) => companySlug(parseCompanySection(doc.content).title) === key))
    throw taken();
}

async function commit(
  deps: Deps,
  actor: Actor,
  path: string,
  content: string,
  expectedRevision: number | undefined,
) {
  try {
    return await deps.memory.commit(
      { scope: "company", path, content, expectedRevision },
      contextOf(actor),
    );
  } catch (error) {
    if (error instanceof Error && error.message === MEMORY_REVISION_CONFLICT_ERROR) throw changed();
    throw error;
  }
}

async function ownDoc(deps: Deps, actor: Actor, id: string) {
  const doc = await deps.prisma.memoryDocument.findFirst({ where: { id, ...own(actor) } });
  if (!doc) throw new IsolationError();
  return doc;
}

export async function listCompanyContext(deps: Deps, actor: Actor) {
  const snapshot = await deps.memory.read({ scope: "company" }, contextOf(actor));
  return snapshot.documents
    .map(toSection)
    .sort((a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug));
}

export async function saveCompanyContext(
  deps: Deps,
  actor: Actor,
  input: { id?: string; title: string; text: string; expectedRevision?: number },
) {
  const invalid = companySectionError(input.title, input.text);
  if (invalid) throw bad(invalid);
  const content = companySectionContent(input.title, input.text);
  if (!input.id) {
    try {
      // The lock makes the count, the name check and the insert one step per user, so two creates
      // cannot both pass. The rows are written here, not through memory.commit, which would open
      // a second transaction on another pooled connection while this one holds its own.
      return await deps.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company-context:${actor.spaceId}:${actor.userId}`}))`;
        const docs = await tx.memoryDocument.findMany({ where: own(actor) });
        if (docs.length >= COMPANY_SECTION_MAX_COUNT) throw bad("The page is full.");
        const key = companySlug(input.title);
        if (docs.some((doc) => companySlug(parseCompanySection(doc.content).title) === key))
          throw taken();
        const paths = new Set(docs.map((doc) => doc.path));
        let path = key;
        for (let n = 2; paths.has(path); n += 1) {
          const suffix = `-${n}`;
          path = `${key.slice(0, 60 - suffix.length).replace(/-+$/g, "")}${suffix}`;
        }
        const doc = await tx.memoryDocument.create({ data: { ...own(actor), path, content } });
        await tx.memoryRevision.create({
          data: { documentId: doc.id, revision: doc.revision, content },
        });
        return toSection(doc);
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002") throw taken();
      throw error;
    }
  }
  // An update without the revision it started from would overwrite a newer save.
  if (input.expectedRevision === undefined) throw bad("Reload the page and try again.");
  const doc = await ownDoc(deps, actor, input.id);
  await ensureNameFree(deps, actor, doc.id, input.title);
  const saved = await commit(deps, actor, doc.path, content, input.expectedRevision);
  return toSection({ ...saved, updatedAt: new Date() });
}

export async function companyContextHistory(
  deps: Deps,
  actor: Actor,
  id: string,
): Promise<CompanyContextRevision[]> {
  const doc = await ownDoc(deps, actor, id);
  const rows = await deps.prisma.memoryRevision.findMany({
    where: { documentId: doc.id },
    orderBy: { revision: "desc" },
    take: 50,
  });
  return rows.map((row) => {
    const { title, body } = parseCompanySection(row.content);
    return {
      revision: row.revision,
      title,
      text: body,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function restoreCompanyContext(
  deps: Deps,
  actor: Actor,
  input: { id: string; revision: number; expectedRevision: number },
) {
  const doc = await ownDoc(deps, actor, input.id);
  const old = await deps.prisma.memoryRevision.findFirst({
    where: { documentId: doc.id, revision: input.revision },
  });
  if (!old) throw new IsolationError();
  await ensureNameFree(deps, actor, doc.id, parseCompanySection(old.content).title);
  const saved = await commit(deps, actor, doc.path, old.content, input.expectedRevision);
  return toSection({ ...saved, updatedAt: new Date() });
}

export async function removeCompanyContext(
  deps: Deps,
  actor: Actor,
  input: { id: string; revision: number },
) {
  // Revisions go with the document (ON DELETE CASCADE).
  const { count } = await deps.prisma.memoryDocument.deleteMany({
    where: { id: input.id, ...own(actor), revision: input.revision },
  });
  if (count === 0) {
    await ownDoc(deps, actor, input.id);
    throw changed();
  }
  return { ok: true as const };
}
