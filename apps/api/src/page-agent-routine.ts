import { ORPCError } from "@orpc/server";
import type { JobPublisher } from "@rakazo/adapter-kit";
import { routineWakeupJob } from "@rakazo/adapter-kit";
import { lockAgentBot } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { nextCronDateAcrossStrict } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { lockLiveBot } from "./bot-lock.js";

export type AgentRoutineSpec = {
  /** The agent kind, which names the advisory lock shared with the agent's runs. */
  kind: string;
  spawnKey: string;
  name: string;
  prompt: string;
  /** Earlier defaults; a routine still holding one moves to `prompt`. */
  pastPrompts?: readonly string[];
  crons: readonly string[];
  /** Time zone for the schedule; "UTC" unless the account's own is wanted. */
  timezone: string;
  notify: boolean;
};

/**
 * Creates the agent's routine once, under the agent's advisory lock and after checking the bot is
 * still live, so racing calls leave one routine and none is made for an archived bot. A routine that
 * exists is returned as it is, apart from moving a past default prompt to the current one.
 */
export async function ensureAgentRoutine(
  deps: { prisma: Pick<PrismaClient, "$transaction">; jobs: Pick<JobPublisher, "enqueue"> },
  actor: Actor,
  botId: string,
  spec: AgentRoutineSpec,
) {
  const crons = [...spec.crons];
  const nextRunAt = nextCronDateAcrossStrict(crons, new Date(), spec.timezone);
  const { routine, created } = await deps.prisma.$transaction(async (tx) => {
    await lockAgentBot(tx, spec.kind, botId);
    if (!(await lockLiveBot(tx, actor, botId, spec.spawnKey)))
      throw new ORPCError("CONFLICT", { message: "The agent is no longer active" });
    const existing = await tx.routine.findFirst({
      where: { spaceId: actor.spaceId, userId: actor.userId, botId, name: spec.name },
    });
    if (existing) {
      if (!spec.pastPrompts?.includes(existing.prompt))
        return { routine: existing, created: false };
      const updated = await tx.routine.update({
        where: { id: existing.id },
        data: { prompt: spec.prompt, promptUpdatedAt: new Date() },
      });
      return { routine: updated, created: false };
    }
    const row = await tx.routine.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId,
        name: spec.name,
        prompt: spec.prompt,
        crons,
        timezone: spec.timezone,
        active: true,
        notify: spec.notify,
        nextRunAt,
      },
    });
    return { routine: row, created: true };
  });
  if (created && nextRunAt) await deps.jobs.enqueue(routineWakeupJob(routine.id, nextRunAt));
  return routine;
}
