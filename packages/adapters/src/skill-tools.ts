import type { SkillRecord, SkillSource } from "@rakazo/core";
import {
  buildSkillMd,
  findSkillByName,
  isSkillReadOnly,
  mergeBuiltinSkills,
  parseSkillMd,
  validateToolInput,
  validateToolInputSchema,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { BUILTIN_AGENT_SKILLS } from "./builtin-skills.js";
import { runTool, TOOL_LIMITS, toolSourceHash } from "./tool-runner.js";

export const SKILL_TOOL_NAMES = new Set([
  "skill_read",
  "skill_create",
  "skill_update",
  "skill_delete",
  "tool_run",
]);

/** Match CreateAgentSkillInput / UpdateAgentSkillInput / parseSkillMd bounds. */
const MAX_SKILL_CONTENT_CHARS = 100_000;
const MAX_SKILL_NAME_CHARS = 80;
const MAX_SKILL_DESCRIPTION_CHARS = 2000;

type SkillOwner = {
  spaceId: string;
  userId: string;
};

type AgentSkillRow = {
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
  origin?: string;
  status?: string;
  pendingContent?: string | null;
  toolSource?: string | null;
  toolInputSchema?: unknown;
};

/** The tool arguments skill_create and skill_update accept. */
export type SkillToolArgs = {
  toolSource?: string;
  toolInputSchema?: unknown;
  reads?: string;
  writes?: string;
  sampleInput?: unknown;
  sampleOutput?: unknown;
};

/** Picks the tool arguments out of a model's tool call. */
export function skillToolArgs(args: Record<string, unknown>): SkillToolArgs {
  return {
    ...(args.toolSource !== undefined ? { toolSource: String(args.toolSource) } : {}),
    ...(args.toolInputSchema !== undefined ? { toolInputSchema: args.toolInputSchema } : {}),
    ...(args.reads !== undefined ? { reads: String(args.reads) } : {}),
    ...(args.writes !== undefined ? { writes: String(args.writes) } : {}),
    ...(args.sampleInput !== undefined ? { sampleInput: args.sampleInput } : {}),
    ...(args.sampleOutput !== undefined ? { sampleOutput: args.sampleOutput } : {}),
  };
}

type ToolFields = {
  source: string;
  inputSchema: Record<string, unknown>;
  notes: Record<string, unknown>;
};

const MAX_NOTE_CHARS = 500;
const MAX_SAMPLE_CHARS = 4000;

/** A bounded JSON copy of a sample, or undefined if it is not JSON or too long. */
function boundedSample(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const text = JSON.stringify(value);
    return text !== undefined && text.length <= MAX_SAMPLE_CHARS ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

/** Checks the tool arguments and returns the stored shape, or an error message. */
function resolveToolFields(
  args: SkillToolArgs,
  prior?: { source?: string | null; inputSchema?: unknown; notes?: unknown },
): ToolFields | { error: string } | null {
  if (args.toolSource === undefined) {
    if (args.toolInputSchema !== undefined) return { error: "toolInputSchema needs toolSource." };
    return null;
  }
  const source = String(args.toolSource);
  if (!source.trim()) return { error: "toolSource is empty." };
  if (source.length > TOOL_LIMITS.maxSourceChars) {
    return { error: `toolSource must be at most ${TOOL_LIMITS.maxSourceChars} characters.` };
  }
  const inputSchema = args.toolInputSchema ?? prior?.inputSchema;
  if (inputSchema === undefined) return { error: "Provide toolInputSchema with toolSource." };
  const badSchema = validateToolInputSchema(inputSchema);
  if (badSchema) return { error: badSchema };
  const priorNotes = (prior?.notes ?? {}) as Record<string, unknown>;
  const note = (value: unknown, kept: unknown) =>
    value === undefined ? kept : String(value).slice(0, MAX_NOTE_CHARS);
  const notes: Record<string, unknown> = {
    reads: note(args.reads, priorNotes.reads),
    writes: note(args.writes, priorNotes.writes),
    sampleInput:
      args.sampleInput === undefined ? priorNotes.sampleInput : boundedSample(args.sampleInput),
    sampleOutput:
      args.sampleOutput === undefined ? priorNotes.sampleOutput : boundedSample(args.sampleOutput),
  };
  return { source, inputSchema: inputSchema as Record<string, unknown>, notes };
}

function asSource(value: string): SkillSource {
  if (value === "builtin" || value === "plugin" || value === "user") return value;
  return "user";
}

function toRecord(row: AgentSkillRow): SkillRecord & { id: string } {
  const source = asSource(row.source);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    source,
    readOnly: isSkillReadOnly(source),
  };
}

/** Every stored row, drafts included. Only `listAgentSkillRecords` hides drafts. */
async function ownedRows(prisma: PrismaClient, owner: SkillOwner) {
  return prisma.agentSkill.findMany({
    where: { spaceId: owner.spaceId, userId: owner.userId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

function nameTaken(
  rows: AgentSkillRow[],
  name: string,
  exceptId?: string,
): AgentSkillRow | SkillRecord | undefined {
  const lower = name.toLowerCase();
  return (
    rows.find((row) => row.id !== exceptId && row.name.toLowerCase() === lower) ??
    builtinRecords().find((skill) => skill.name.toLowerCase() === lower)
  );
}

function builtinRecords(): Array<SkillRecord & { id: string }> {
  return BUILTIN_AGENT_SKILLS.map((skill) => ({
    id: `builtin:${skill.name}`,
    name: skill.name,
    description: skill.description,
    content: skill.content,
    source: "builtin" as const,
    readOnly: true,
  }));
}

function rejectOversizedContent(content: string): string | undefined {
  if (content.length > MAX_SKILL_CONTENT_CHARS) {
    return `Skill content must be at most ${MAX_SKILL_CONTENT_CHARS} characters.`;
  }
  return undefined;
}

function rejectInvalidSkillFields(name: string, description: string): string | undefined {
  if (!name) return "Skill name is required.";
  if (!description) return "Skill description is required.";
  if (name.length > MAX_SKILL_NAME_CHARS) {
    return `Skill name must be at most ${MAX_SKILL_NAME_CHARS} characters.`;
  }
  if (description.length > MAX_SKILL_DESCRIPTION_CHARS) {
    return `Skill description must be at most ${MAX_SKILL_DESCRIPTION_CHARS} characters.`;
  }
  return undefined;
}

/** The user's skills and built-ins; with `botId`, minus the skills switched off for that bot. */
export async function listAgentSkillRecords(
  prisma: Pick<PrismaClient, "agentSkill" | "botSkillSetting">,
  owner: SkillOwner & { botId?: string },
): Promise<Array<SkillRecord & { id: string }>> {
  const [rows, off] = await Promise.all([
    prisma.agentSkill.findMany({
      where: { spaceId: owner.spaceId, userId: owner.userId, status: "active" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    owner.botId
      ? prisma.botSkillSetting.findMany({
          where: { spaceId: owner.spaceId, botId: owner.botId, enabled: false },
          select: { skillKey: true },
        })
      : Promise.resolve([]),
  ]);
  const disabled = new Set(off.map((row) => row.skillKey));
  return mergeBuiltinSkills(builtinRecords(), rows.map(toRecord)).filter(
    (skill) => !disabled.has(skill.id),
  );
}

async function findOwnedSkill(
  prisma: PrismaClient,
  owner: SkillOwner & { botId?: string },
  input: { skillId?: string; name?: string },
): Promise<(SkillRecord & { id: string }) | null> {
  const skills = await listAgentSkillRecords(prisma, owner);
  if (input.skillId) {
    return skills.find((skill) => skill.id === input.skillId) ?? null;
  }
  if (input.name) return findSkillByName(skills, input.name) ?? null;
  return null;
}

export async function skillReadFromTool(
  prisma: PrismaClient,
  owner: SkillOwner & { botId?: string },
  input: { name?: string; skillId?: string },
): Promise<Record<string, unknown>> {
  const skill = await findOwnedSkill(prisma, owner, input);
  if (!skill) return { error: "Skill not found." };
  // The owner's own tool script, so the bot can propose a change to it with skill_update.
  const toolRow =
    skill.source === "user"
      ? (await ownedRows(prisma, owner)).find((row) => row.id === skill.id)
      : undefined;
  return {
    name: skill.name,
    description: skill.description,
    source: skill.source,
    readOnly: skill.readOnly,
    content: skill.content,
    ...(toolRow?.toolSource
      ? { toolSource: toolRow.toolSource, toolInputSchema: toolRow.toolInputSchema }
      : {}),
  };
}

export const TOOL_CHANGED_MESSAGE = "This tool changed since it was approved.";

/**
 * Runs an owner's tool by skill name. An active tool runs only if its stored source still hashes
 * to the value the owner approved. A draft may be test-run only when `allowDraft` (attended runs).
 */
export async function toolRunFromTool(
  prisma: PrismaClient,
  owner: SkillOwner & { botId?: string },
  input: { name?: string; input?: unknown },
  options: { allowDraft: boolean },
): Promise<Record<string, unknown>> {
  const name = String(input.name ?? "").trim();
  if (!name) return { error: "Provide the tool name." };
  const row = findSkillByName(await ownedRows(prisma, owner), name);
  if (!row?.toolSource) return { error: "Tool not found." };
  if (row.status === "draft") {
    if (!options.allowDraft) {
      return { error: "This tool is a draft and the owner has not approved it yet." };
    }
  } else {
    const enabled = await listAgentSkillRecords(prisma, owner);
    if (!enabled.some((skill) => skill.id === row.id)) return { error: "Tool not found." };
    if (!row.toolSourceHash || toolSourceHash(row.toolSource) !== row.toolSourceHash) {
      return { error: TOOL_CHANGED_MESSAGE };
    }
  }
  const invalid = validateToolInput(row.toolInputSchema, input.input ?? {});
  if (invalid) return { error: invalid };
  const out = await runTool(row.toolSource, input.input ?? {});
  return "error" in out ? { error: out.error } : { result: out.result };
}

export async function skillCreateFromTool(
  prisma: PrismaClient,
  owner: SkillOwner,
  input: { name?: string; description?: string; body?: string; content?: string } & SkillToolArgs,
): Promise<Record<string, unknown>> {
  const tool = resolveToolFields(input);
  if (tool && "error" in tool) return { error: tool.error };
  let name = "";
  let description = "";
  let content = "";
  if (input.content?.trim()) {
    const parsed = parseSkillMd(input.content);
    if ("error" in parsed) return { error: parsed.error };
    name = parsed.name;
    description = parsed.description;
    content = buildSkillMd(parsed);
  } else {
    name = String(input.name ?? "").trim();
    description = String(input.description ?? "").trim();
    const body = String(input.body ?? "").trim();
    if (!name || !description) {
      return {
        error: "Provide name and description (and optional body), or full SKILL.md content.",
      };
    }
    const invalid = rejectInvalidSkillFields(name, description);
    if (invalid) return { error: invalid };
    content = buildSkillMd({ name, description, body });
  }

  const oversized = rejectOversizedContent(content);
  if (oversized) return { error: oversized };

  const taken = nameTaken(await ownedRows(prisma, owner), name);
  if (taken) return { error: `A skill named "${taken.name}" already exists.` };

  try {
    // An agent never activates its own skill: the owner approves it first.
    const row = await prisma.agentSkill.create({
      data: {
        spaceId: owner.spaceId,
        userId: owner.userId,
        name,
        description,
        content,
        source: "user",
        origin: "agent",
        status: "draft",
        // The hash stays null until the owner approves this exact source.
        ...(tool
          ? {
              toolSource: tool.source,
              toolInputSchema: tool.inputSchema as object,
              toolNotes: tool.notes as object,
            }
          : {}),
      },
    });
    return {
      ok: true,
      id: row.id,
      name: row.name,
      status: "draft",
      message: "Drafted; awaiting the owner's approval. It is not usable until they approve it.",
    };
  } catch {
    return { error: "Could not create skill (name may already exist)." };
  }
}

export async function skillUpdateFromTool(
  prisma: PrismaClient,
  owner: SkillOwner,
  input: {
    name?: string;
    skillId?: string;
    newName?: string;
    description?: string;
    body?: string;
    content?: string;
  } & SkillToolArgs,
): Promise<Record<string, unknown>> {
  const rows = await ownedRows(prisma, owner);
  const existing = input.skillId
    ? rows.find((row) => row.id === input.skillId)
    : input.name
      ? findSkillByName(rows, input.name)
      : undefined;
  if (!existing) {
    const builtin =
      input.skillId?.startsWith("builtin:") ||
      (input.name && findSkillByName(builtinRecords(), input.name));
    return { error: builtin ? "Builtin and plugin skills are read-only." : "Skill not found." };
  }
  if (existing.source !== "user") return { error: "Builtin and plugin skills are read-only." };

  let nextContent = existing.content;
  let nextName = existing.name;
  let nextDescription = existing.description;

  if (input.content?.trim()) {
    const parsed = parseSkillMd(input.content);
    if ("error" in parsed) return { error: parsed.error };
    nextName = parsed.name;
    nextDescription = parsed.description;
    nextContent = buildSkillMd(parsed);
  } else {
    const prior = parseSkillMd(existing.content);
    if ("error" in prior) return { error: prior.error };
    // `name` is only a lookup key (see findOwnedSkill above); renames require `newName`.
    nextName = String(input.newName ?? existing.name).trim() || existing.name;
    nextDescription =
      input.description !== undefined ? String(input.description).trim() : existing.description;
    const body = input.body !== undefined ? String(input.body) : prior.body;
    const invalidFields = rejectInvalidSkillFields(nextName, nextDescription);
    if (invalidFields) return { error: invalidFields };
    nextContent = buildSkillMd({
      name: nextName,
      description: nextDescription,
      body,
      frontmatter: prior.frontmatter,
    });
  }

  const invalid = rejectInvalidSkillFields(nextName, nextDescription);
  if (invalid) return { error: invalid };
  const oversized = rejectOversizedContent(nextContent);
  if (oversized) return { error: oversized };

  if (!findSkillByName([existing], nextName)) {
    const clash = nameTaken(rows, nextName, existing.id);
    if (clash) return { error: `A skill named "${clash.name}" already exists.` };
  }

  // A draft is still unapproved, so edit it in place. An active skill keeps working until the
  // owner approves the proposed revision.
  const isDraft = existing.status === "draft";
  const tool = resolveToolFields(input, {
    source: existing.toolSource,
    inputSchema: existing.toolInputSchema,
    notes: existing.toolNotes,
  });
  if (tool && "error" in tool) return { error: tool.error };
  try {
    // Re-scope mutate to owner + user source so a stale id cannot cross tenants.
    const updated = await prisma.agentSkill.updateMany({
      where: {
        id: existing.id,
        spaceId: owner.spaceId,
        userId: owner.userId,
        source: "user",
      },
      // A tool revision on an active skill waits in pendingTool; toolSource and toolSourceHash keep
      // the approved script until the owner approves.
      data: isDraft
        ? {
            name: nextName,
            description: nextDescription,
            content: nextContent,
            ...(tool
              ? {
                  toolSource: tool.source,
                  toolInputSchema: tool.inputSchema as object,
                  toolNotes: tool.notes as object,
                }
              : {}),
          }
        : {
            pendingContent: nextContent,
            ...(tool ? { pendingTool: tool as unknown as object } : {}),
          },
    });
    if (updated.count !== 1) return { error: "Could not update skill." };
    return {
      ok: true,
      id: existing.id,
      name: nextName,
      status: isDraft ? "draft" : "revision_pending",
      message: isDraft
        ? "Draft updated; awaiting the owner's approval."
        : "Revision proposed; the current version stays in use until the owner approves it.",
    };
  } catch {
    return { error: "Could not update skill." };
  }
}

export async function skillDeleteFromTool(
  prisma: PrismaClient,
  owner: SkillOwner,
  input: { name?: string; skillId?: string },
): Promise<Record<string, unknown>> {
  const existing = await findOwnedSkill(prisma, owner, input);
  if (!existing) return { error: "Skill not found." };
  if (existing.readOnly || existing.source !== "user" || existing.id.startsWith("builtin:")) {
    return { error: "Builtin and plugin skills are read-only." };
  }
  const deleted = await prisma.agentSkill.deleteMany({
    where: {
      id: existing.id,
      spaceId: owner.spaceId,
      userId: owner.userId,
      source: "user",
    },
  });
  if (deleted.count !== 1) return { error: "Could not delete skill." };
  return { ok: true, name: existing.name };
}
