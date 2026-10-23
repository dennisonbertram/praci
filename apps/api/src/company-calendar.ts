import type { Actor, CompanyCalendarItem } from "@rakazo/contracts";
import { companyCalendarItems, companyCalendarMonth } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { companyPage } from "./company-page.js";

export async function companyCalendar(
  prisma: PrismaClient,
  actor: Actor,
  input: { month: string; anniversaries: boolean },
): Promise<CompanyCalendarItem[]> {
  // The page helper checks membership and applies owner/team fact visibility.
  const page = await companyPage(prisma, actor);
  const { start, end } = companyCalendarMonth(input.month);
  const deadlines = await prisma.legalDeadline.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      status: "open",
      dueDate: { gte: new Date(`${start}T00:00:00Z`), lte: new Date(`${end}T00:00:00Z`) },
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return [
    ...companyCalendarItems(page, input.month, input.anniversaries),
    ...deadlines.map(
      (deadline): CompanyCalendarItem => ({
        id: `legal:${deadline.id}`,
        title: deadline.title,
        date: deadline.dueDate.toISOString().slice(0, 10),
        stream: "legal",
        status: "open",
        anniversary: false,
        fact: null,
        legalDeadlineId: deadline.id,
      }),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
