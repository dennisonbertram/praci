import type { SidebarPage, SidebarPageTemplate } from "@rakazo/contracts";
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

/** The user's added pages in this space, oldest first. */
export async function listSidebarPages(prisma: Db, actor: Scope): Promise<SidebarPage[]> {
  const { spaceId, userId } = actor;
  const rows = await prisma.sidebarPage.findMany({
    where: { spaceId, userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({ templateKey: row.templateKey }));
}

/** Adds a page; adding one the user already has is a no-op. */
export async function addSidebarPage(
  prisma: Db,
  actor: Scope,
  templateKey: string,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<void> {
  const { spaceId, userId } = actor;
  const template = templates.find((t) => t.key === templateKey);
  if (!template) throw new SidebarPageError("unknown", "Unknown page");
  if (!template.available) throw new SidebarPageError("unavailable", "Page is not available");
  if (template.ownerOnly) {
    const member = await prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      select: { role: true },
    });
    if (member?.role !== "owner") {
      throw new SidebarPageError("owner_only", "Only the space owner can add this page");
    }
  }
  const last = await prisma.sidebarPage.aggregate({
    where: { spaceId, userId },
    _max: { position: true },
  });
  await prisma.sidebarPage.upsert({
    where: { spaceId_userId_templateKey: { spaceId, userId, templateKey } },
    create: {
      spaceId,
      userId,
      templateKey,
      position: (last._max.position ?? -1) + 1,
    },
    update: {},
  });
}

/** Removes a page; a page the user does not have is a no-op. */
export async function removeSidebarPage(
  prisma: Db,
  actor: Scope,
  templateKey: string,
): Promise<void> {
  const { spaceId, userId } = actor;
  await prisma.sidebarPage.deleteMany({
    where: { spaceId, userId, templateKey },
  });
}
