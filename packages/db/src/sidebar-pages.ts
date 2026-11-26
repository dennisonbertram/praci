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
type Db = Pick<PrismaClient, "sidebarPage" | "spaceMember" | "botPage">;

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

/** Bot pages the user may open: their own non-archived bots in this space (the rule `repos.getBot` applies). */
const ownPage = ({ spaceId, userId }: Scope) => ({ spaceId, bot: { userId, archivedAt: null } });

/** The user's added pages (oldest first), the template keys they may still add, and their other bot pages by bot. */
export async function listSidebarPages(
  prisma: Db,
  actor: Scope,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  const rows = await prisma.sidebarPage.findMany({
    where: { spaceId, userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      page: {
        select: { title: true, botId: true, bot: { select: { userId: true, archivedAt: true } } },
      },
    },
  });
  const owner = templates.some((t) => t.ownerOnly) && (await isSpaceOwner(prisma, actor));
  const pages: SidebarPagesState["pages"] = [];
  for (const row of rows) {
    if (row.pageId) {
      // A page whose bot the user can no longer open (archived) is left out.
      const page = row.page;
      if (page && !page.bot.archivedAt && page.bot.userId === userId) {
        pages.push({ pageId: row.pageId, botId: page.botId, title: page.title });
      }
    } else if (
      // A saved owner-only page stays hidden while the user is not the space owner.
      row.templateKey &&
      (owner || !templates.find((t) => t.key === row.templateKey)?.ownerOnly)
    ) {
      pages.push({ templateKey: row.templateKey });
    }
  }
  const addable = templates
    .filter((t) => !addBlocker(t, owner) && !rows.some((row) => row.templateKey === t.key))
    .map((t) => t.key);
  const open = await prisma.botPage.findMany({
    where: { ...ownPage(actor), sidebarPages: { none: { spaceId, userId } } },
    orderBy: [
      { bot: { pinned: "desc" } },
      { bot: { position: "asc" } },
      { bot: { createdAt: "asc" } },
      { createdAt: "asc" },
    ],
    select: { id: true, title: true, botId: true },
  });
  const botPages: SidebarPagesState["botPages"] = [];
  for (const { id, title, botId } of open) {
    const group = botPages.find((entry) => entry.botId === botId);
    if (group) group.pages.push({ id, title });
    else botPages.push({ botId, pages: [{ id, title }] });
  }
  return { pages, addable, botPages };
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

/** Adds one of the user's bot pages; one they cannot open, or that is not theirs, is "unknown". */
export async function addSidebarBotPage(
  prisma: Db,
  actor: Scope,
  pageId: string,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  const page = await prisma.botPage.findFirst({
    where: { id: pageId, ...ownPage(actor) },
    select: { id: true },
  });
  if (!page) throw new SidebarPageError("unknown", "Unknown page");
  const last = await prisma.sidebarPage.aggregate({
    where: { spaceId, userId },
    _max: { position: true },
  });
  await prisma.sidebarPage.upsert({
    where: { spaceId_userId_pageId: { spaceId, userId, pageId } },
    create: { spaceId, userId, pageId, position: (last._max.position ?? -1) + 1 },
    update: {},
  });
  return listSidebarPages(prisma, actor, templates);
}

/** Removes a bot page from the sidebar; one the user does not have there is a no-op. */
export async function removeSidebarBotPage(
  prisma: Db,
  actor: Scope,
  pageId: string,
  templates: readonly SidebarPageTemplate[] = SIDEBAR_PAGE_TEMPLATES,
): Promise<SidebarPagesState> {
  const { spaceId, userId } = actor;
  await prisma.sidebarPage.deleteMany({ where: { spaceId, userId, pageId } });
  return listSidebarPages(prisma, actor, templates);
}
