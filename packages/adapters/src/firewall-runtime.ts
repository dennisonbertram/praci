import type { PrismaClient } from "@rakazo/db";
import { contactMatchWhere, likeLiteral } from "@rakazo/db";

type Scope = { spaceId: string; userId: string };

/**
 * Agents in the space with the Firewall switch on, read fresh each time so a switch change applies
 * to the next call. Rows without `firewall: true` are ignored, whatever the query returned.
 */
export async function firewalledBotIds(
  prisma: Pick<PrismaClient, "bot">,
  spaceId: string,
): Promise<Set<string>> {
  const rows = await prisma.bot.findMany({
    where: { spaceId, firewall: true },
    select: { id: true, firewall: true },
  });
  return new Set(rows.filter((row) => row.firewall === true).map((row) => row.id));
}

/** A group that has a firewalled member loads that member's text into every member's run. */
export async function groupHasFirewalledMember(
  prisma: Pick<PrismaClient, "chatGroupMember">,
  groupId: string,
  firewalled: ReadonlySet<string>,
): Promise<boolean> {
  if (firewalled.size === 0) return false;
  const members = await prisma.chatGroupMember.findMany({
    where: { groupId, botId: { in: [...firewalled] } },
    select: { botId: true },
  });
  return members.some((member) => firewalled.has(member.botId));
}

/** Tools whose results can carry records another agent wrote (see `readsFirewalledContent`). */
export const FIREWALL_CONTENT_READERS: ReadonlySet<string> = new Set([
  "agent_context",
  "search_agent_history",
  "read_agent_history",
  "calendar_agenda",
  "board_tickets",
  "ticket_get",
  "contacts_list",
  "contacts_add",
  "contacts_save",
]);

/**
 * A group run is tainted when a firewalled agent is a member, or wrote any message in the history
 * the run loaded (a member that has since left still wrote what the others read).
 */
export async function groupTaintedByFirewall(
  prisma: Pick<PrismaClient, "chatGroupMember">,
  groupId: string,
  historyAuthors: readonly (string | null | undefined)[],
  firewalled: ReadonlySet<string>,
): Promise<boolean> {
  if (firewalled.size === 0) return false;
  if (historyAuthors.some((id) => id != null && firewalled.has(id))) return true;
  return groupHasFirewalledMember(prisma, groupId, firewalled);
}

const AGENT_RECORD_TOOLS = new Set(["agent_context", "search_agent_history", "read_agent_history"]);

/**
 * Whether a call reads records a firewalled agent wrote. Pages, pins and an agent's own to-do list
 * are scoped to the calling agent, so they only cross agents through the readers below. Each is
 * narrowed to what the call asks for: the agenda's date range, the board's status and owner
 * filters, the one ticket named. Checked by author, so the records carry no mark.
 */
export async function readsFirewalledContent(
  prisma: Pick<PrismaClient, "scratchpadItem" | "routine" | "ticket" | "ticketComment" | "contact">,
  scope: Scope,
  name: string,
  args: Record<string, unknown>,
  firewalled: ReadonlySet<string>,
): Promise<boolean> {
  if (firewalled.size === 0) return false;
  const authors = [...firewalled];
  const written = (rows: { botId?: string | null }[]) =>
    rows.some((row) => row.botId != null && firewalled.has(row.botId));
  if (AGENT_RECORD_TOOLS.has(name))
    return typeof args.botId === "string" && firewalled.has(args.botId);
  if (name === "calendar_agenda") {
    const from = args.from ? new Date(String(args.from)) : new Date();
    const to = args.to ? new Date(String(args.to)) : new Date(from.getTime() + 7 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return false;
    const [items, routines] = await Promise.all([
      prisma.scratchpadItem.findMany({
        where: {
          ...scope,
          botId: { in: authors },
          status: { not: "done" },
          dueAt: { gte: from, lt: to },
        },
        select: { botId: true },
        take: 50,
      }),
      prisma.routine.findMany({
        where: {
          ...scope,
          botId: { in: authors },
          active: true,
          managedKind: null,
          nextRunAt: { not: null, lt: to },
        },
        select: { botId: true },
        take: 50,
      }),
    ]);
    return written(items) || written(routines);
  }
  if (name === "contacts_list") {
    // Contact.botId is the agent that added the contact, lastEditedByBotId the one that last changed it.
    const text = typeof args.query === "string" ? args.query.trim() : "";
    const escapedText = text ? likeLiteral(text) : "";
    const contains = (field: string) => ({
      [field]: { contains: escapedText, mode: "insensitive" },
    });
    const rows = await prisma.contact.findMany({
      where: {
        ...scope,
        OR: [{ botId: { in: authors } }, { lastEditedByBotId: { in: authors } }],
        ...(typeof args.kind === "string" && args.kind ? { kind: args.kind } : {}),
        ...(text
          ? { AND: [{ OR: ["name", "email", "organization", "notes"].map((f) => contains(f)) }] }
          : {}),
      },
      select: { botId: true, lastEditedByBotId: true },
      take: 1,
    });
    return rows.some(
      (row) =>
        (row.botId != null && firewalled.has(row.botId)) ||
        (row.lastEditedByBotId != null && firewalled.has(row.lastEditedByBotId)),
    );
  }
  if (name === "contacts_add" || name === "contacts_save") {
    // An existing contact is returned whole, notes included: the same match contacts_add uses
    // (the email, or the name and organization without one).
    const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
    const person = typeof args.name === "string" ? args.name.trim() : "";
    const organization = typeof args.organization === "string" ? args.organization.trim() : "";
    if (!email && !person) return false;
    const rows = await prisma.contact.findMany({
      where: {
        ...scope,
        AND: [
          { OR: [{ botId: { in: authors } }, { lastEditedByBotId: { in: authors } }] },
          // contacts_save also reaches an email-less contact by name and organization, to add the email.
          email
            ? name === "contacts_save"
              ? {
                  OR: [
                    { email },
                    { email: null, ...contactMatchWhere({ name: person, organization }) },
                  ],
                }
              : { email }
            : contactMatchWhere({ name: person, organization }),
        ],
      },
      select: { botId: true, lastEditedByBotId: true },
      take: 1,
    });
    return rows.length > 0;
  }
  if (name === "board_tickets") {
    const rows = await prisma.ticket.findMany({
      where: {
        spaceId: scope.spaceId,
        createdByBotId: { in: authors },
        ...(typeof args.status === "string" && args.status
          ? { status: args.status }
          : { status: { not: "closed" } }),
        ...(typeof args.ownerBotId === "string" && args.ownerBotId
          ? { assigneeBotId: args.ownerBotId }
          : {}),
      },
      select: { createdByBotId: true },
      take: 50,
    });
    return rows.some((row) => row.createdByBotId != null && firewalled.has(row.createdByBotId));
  }
  if (name === "ticket_get") {
    const ref = typeof args.ref === "string" ? args.ref.trim() : "";
    if (!ref) return false;
    const number = Number(/(\d+)$/.exec(ref)?.[1]);
    const tickets = await prisma.ticket.findMany({
      where: {
        spaceId: scope.spaceId,
        OR: [{ id: ref }, ...(Number.isInteger(number) ? [{ number }] : [])],
      },
      select: { id: true, createdByBotId: true },
      take: 5,
    });
    if (tickets.some((row) => row.createdByBotId != null && firewalled.has(row.createdByBotId))) {
      return true;
    }
    if (tickets.length === 0) return false;
    const comments = await prisma.ticketComment.findMany({
      where: {
        spaceId: scope.spaceId,
        ticketId: { in: tickets.map((row) => row.id) },
        authorBotId: { in: authors },
      },
      select: { authorBotId: true },
      take: 50,
    });
    return comments.some((row) => row.authorBotId != null && firewalled.has(row.authorBotId));
  }
  return false;
}
