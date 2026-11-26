import { formatSkillRunPrompt } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { parsePlaybook } from "./teaching-session.js";

/**
 * The prompt for a routine that runs a taught skill: the skill's playbook as it is now, so an
 * edit to the skill reaches the routine. Stamps the skill's last run. Null when the routine has
 * no skill or the skill is gone, and the caller keeps the routine's own prompt.
 */
export async function taughtSkillPromptForRoutine(
  prisma: Pick<PrismaClient, "taughtSkill">,
  routine: { taughtSkillId: string | null; spaceId: string; userId: string; botId: string },
  options: { test?: boolean } = {},
): Promise<string | null> {
  if (!routine.taughtSkillId) return null;
  const skill = await prisma.taughtSkill.findFirst({
    where: {
      id: routine.taughtSkillId,
      spaceId: routine.spaceId,
      userId: routine.userId,
      botId: routine.botId,
      status: "saved",
    },
  });
  if (!skill) return null;
  await prisma.taughtSkill.update({ where: { id: skill.id }, data: { lastRunAt: new Date() } });
  return formatSkillRunPrompt(
    skill.name || skill.goal.slice(0, 80),
    parsePlaybook(skill.playbook),
    options.test,
  );
}
