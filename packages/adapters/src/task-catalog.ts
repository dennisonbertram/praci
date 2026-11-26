import type { ConnectorTool } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { listSchedulesFromTool } from "./schedule-tools.js";
import { listScratchpadItems } from "./scratchpad-tools.js";
import { listAgentSkillRecords } from "./skill-tools.js";

export type TaskCatalogToolDeps = {
  prisma: PrismaClient;
};

type TaskCatalogInput = {
  spaceId: string;
  botId: string;
  userId: string;
  threadId?: string;
  tools: readonly Pick<ConnectorTool, "name" | "description" | "readOnly">[];
};

/**
 * Guidance injected alongside the catalog tool. Keep this short: the live
 * records returned by task_catalog are the source of truth for names and ids.
 */
export const TASK_CATALOG_GUIDANCE = [
  "Task execution: task_catalog lists this bot's open work, routines, skills, and exposed tools. An empty list does not cancel what the user asked for in this conversation.",
  "When a request refers to an existing routine, skill, capability or saved to-do you cannot see in these instructions, call task_catalog once and use the exact returned id/name. Do not call it before every step.",
  "For an open task, perform the work with the exposed tools, then use scratchpad_update or scratchpad_complete.",
  "For a schedule, provide exactly one timing mode to schedule_create (cron, every+unit, runAt, delayMinutes, or delaySeconds). Change an existing routine with schedule_update, not cancel and recreate.",
].join("\n");

export async function taskCatalogFromTool(deps: TaskCatalogToolDeps, input: TaskCatalogInput) {
  const [tasks, schedules, taughtSkills, skills] = await Promise.all([
    listScratchpadItems(deps, {
      spaceId: input.spaceId,
      userId: input.userId,
      botId: input.botId,
      includeDone: false,
    }),
    listSchedulesFromTool(deps, {
      spaceId: input.spaceId,
      botId: input.botId,
      userId: input.userId,
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
    deps.prisma.taughtSkill.findMany({
      where: {
        spaceId: input.spaceId,
        botId: input.botId,
        status: "saved",
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, goal: true, status: true },
    }),
    listAgentSkillRecords(deps.prisma, {
      spaceId: input.spaceId,
      userId: input.userId,
    }),
  ]);

  // Approved tools the bot can call with tool_run, with the input each one takes.
  const toolRows = await deps.prisma.agentSkill.findMany({
    where: {
      spaceId: input.spaceId,
      userId: input.userId,
      status: "active",
      toolSource: { not: null },
      toolSourceHash: { not: null },
    },
    select: { id: true, name: true, description: true, toolInputSchema: true },
    orderBy: { name: "asc" },
  });
  const enabledIds = new Set(
    (
      await listAgentSkillRecords(deps.prisma, {
        spaceId: input.spaceId,
        userId: input.userId,
        botId: input.botId,
      })
    ).map((skill) => skill.id),
  );
  const savedTools = toolRows
    .filter((row) => enabledIds.has(row.id))
    .map((row) => ({
      name: row.name,
      description: row.description,
      inputSchema: row.toolInputSchema,
    }));

  const seenTools = new Set<string>();
  const exposedTools = input.tools.flatMap((tool) => {
    if (seenTools.has(tool.name)) return [];
    seenTools.add(tool.name);
    return [
      {
        name: tool.name,
        description: tool.description,
        readOnly: tool.readOnly ?? false,
      },
    ];
  });

  return {
    guidance: TASK_CATALOG_GUIDANCE,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      notes: task.notes,
      source: "scratchpad",
    })),
    routines: schedules.routines,
    savedTools,
    taughtSkills: taughtSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      goal: skill.goal,
      status: skill.status,
      source: "taught_skill",
    })),
    skills: skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      source: skill.source,
      readOnly: skill.readOnly,
    })),
    tools: exposedTools,
  };
}
