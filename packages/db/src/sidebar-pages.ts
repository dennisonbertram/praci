import type { SidebarPagesState, SidebarPageTemplate } from "@rakazo/contracts";
import { SIDEBAR_PAGE_TEMPLATES } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";

export class SidebarPageError extends Error {
  constructor(
    readonly code: "unknown" | "unavailable" | "owner_only",
    message: string,
  ) {
    super(message);
    this.name = "SidebarPageError";
  }
}

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "sidebarPage" | "spaceMember">;

const isSpaceOwner = async (prisma: Db, { spaceId, userId }: Scope) =>
  (
    await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      select: { role: true },
    })
  )?.role === "owner";

/** Why the template cannot be added by this caller, or null. The one eligibility rule. */
function addBlocker(template: SidebarPageTemplate | undefined, isOwner: boolean) {
  if (!template) return new SidebarPageError("unknown", "Unknown page");
  if (!template.available) return new SidebarPageError("unavailable", "Page is not available");
  if (template.ownerOnly && !isOwner) {
    return new SidebarPageError("owner_only", "Only the space owner can add this page");
  }
  return null;
}

/** The user's added pages (oldest first) and the template keys they may still add. */
export async function listSidebarPages(
  prisma: Db,
  actor: Scope,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  const rows = await prisma.sidebarPage.findMany({
    where: { spaceId, userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const owner = templates.some((t) => t.ownerOnly) && (await isSpaceOwner(prisma, actor));
  // A saved owner-only page stays hidden while the user is not the space owner.
  const pages = rows
    .filter((row) => owner || !templates.find((t) => t.key === row.templateKey)?.ownerOnly)
    .map((row) => ({ templateKey: row.templateKey }));
  const addable = templates
    .filter((t) => !addBlocker(t, owner) && !pages.some((p) => p.templateKey === t.key))
    .map((t) => t.key);
  return { pages, addable };
}

/** Adds a page; adding one the user already has is a no-op. Returns the new state. */
export async function addSidebarPage(
  prisma: Db,
  actor: Scope,
  templateKey: string,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  const template = templates.find((t) => t.key === templateKey);
  const blocker = addBlocker(
    template,
    template?.ownerOnly ? await isSpaceOwner(prisma, actor) : false,
  );
  if (blocker) throw blocker;
  const last = await prisma.sidebarPage.aggregate({
    where: { spaceId, userId },
    _max: { position: true },
  });
  await prisma.sidebarPage.upsert({
    where: { spaceId_userId_templateKey: { spaceId, userId, templateKey } },
    create: { spaceId, userId, templateKey, position: (last._max.position ?? -1) + 1 },
    update: {},
  });
  return listSidebarPages(prisma, actor, templates);
}

/** Removes a page; a page the user does not have is a no-op. Returns the new state. */
export async function removeSidebarPage(
  prisma: Db,
  actor: Scope,
  templateKey: string,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  await prisma.sidebarPage.deleteMany({ where: { spaceId, userId, templateKey } });
  return listSidebarPages(prisma, actor, templates);
}
