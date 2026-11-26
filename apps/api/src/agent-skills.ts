import { ORPCError } from "@orpc/server";
import type { ResolveHostname } from "@rakazo/adapters";
import { BUILTIN_AGENT_SKILLS, fetchSafeWebText, toolSourceHash } from "@rakazo/adapters";
import type {
  Actor,
  AgentSkill,
  AgentSkillDraft,
  AgentSkillSource,
  BotAgentSkill,
} from "@rakazo/contracts";
import type { SkillSource } from "@rakazo/core";
import {
  buildSkillMd,
  findSkillByName,
  isSkillReadOnly,
  mergeBuiltinSkills,
  parseSkillMd,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { IsolationError, isUniqueViolation, Prisma } from "@rakazo/db";

type AgentSkillRow = {
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
  origin: string;
  toolSource?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function asSource(value: string): AgentSkillSource {
  if (value === "builtin" || value === "plugin" || value === "user") return value;
  return "user";
}

function mapAgentSkill(row: AgentSkillRow): AgentSkill {
  const source = asSource(row.source);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    source,
    origin: row.origin === "agent" ? "agent" : "user",
    readOnly: isSkillReadOnly(source as SkillSource),
    ...(row.toolSource ? { tool: true } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function builtinCatalog(): AgentSkill[] {
  return BUILTIN_AGENT_SKILLS.map((skill) => ({
    id: `builtin:${skill.name}`,
    name: skill.name,
    description: skill.description,
    content: skill.content,
    source: "builtin" as const,
    origin: "user" as const,
    readOnly: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

function resolveSkillContent(input: {
  content?: string;
  name?: string;
  description?: string;
  body?: string;
  prior?: { content: string };
}): { name: string; description: string; content: string } {
  const ensureContentLimit = (content: string): string => {
    if (content.length > 100_000) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Skill content must be at most 100000 characters.",
      });
    }
    return content;
  };

  if (input.content?.trim()) {
    const parsed = parseSkillMd(input.content);
    if ("error" in parsed) {
      throw new ORPCError("BAD_REQUEST", { message: parsed.error });
    }
    return {
      name: parsed.name,
      description: parsed.description,
      content: ensureContentLimit(buildSkillMd(parsed)),
    };
  }

  const priorParsed = input.prior ? parseSkillMd(input.prior.content) : null;
  if (priorParsed && "error" in priorParsed) {
    throw new ORPCError("BAD_REQUEST", { message: priorParsed.error });
  }

  const name = (input.name ?? priorParsed?.name ?? "").trim();
  const description = (input.description ?? priorParsed?.description ?? "").trim();
  const body = input.body ?? priorParsed?.body ?? "";
  if (!name || !description) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Provide content (SKILL.md) or name + description (+ optional body)",
    });
  }
  let content: string;
  try {
    content = buildSkillMd({
      name,
      description,
      body,
      frontmatter: priorParsed && !("error" in priorParsed) ? priorParsed.frontmatter : undefined,
    });
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Invalid skill fields.",
    });
  }
  const validated = parseSkillMd(content);
  if ("error" in validated) {
    throw new ORPCError("BAD_REQUEST", { message: validated.error });
  }
  return {
    name: validated.name,
    description: validated.description,
    content: ensureContentLimit(buildSkillMd(validated)),
  };
}

const MAX_SKILL_BYTES = 100_000;

type ProposedTool = { source: string; inputSchema: unknown; notes: Record<string, unknown> };

/** The tool script waiting for approval: the draft's own, or the pending revision of an active one. */
function pendingToolOf(
  row: {
    toolSource: string | null;
    toolInputSchema: unknown;
    toolNotes: unknown;
    pendingTool: unknown;
  },
  revision: boolean,
): ProposedTool | null {
  if (revision) {
    const pending = row.pendingTool as Partial<ProposedTool> | null;
    return pending && typeof pending.source === "string"
      ? { source: pending.source, inputSchema: pending.inputSchema, notes: pending.notes ?? {} }
      : null;
  }
  return row.toolSource
    ? {
        source: row.toolSource,
        inputSchema: row.toolInputSchema,
        notes: (row.toolNotes as Record<string, unknown> | null) ?? {},
      }
    : null;
}

function draftTool(
  row: Parameters<typeof pendingToolOf>[0],
  revision: boolean,
): AgentSkillDraft["tool"] {
  const tool = pendingToolOf(row, revision);
  if (!tool) return undefined;
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  return {
    source: tool.source,
    hash: toolSourceHash(tool.source),
    reads: text(tool.notes.reads),
    writes: text(tool.notes.writes),
    sampleInput: tool.notes.sampleInput,
    sampleOutput: tool.notes.sampleOutput,
  };
}

/** A github.com blob link becomes its raw file; any other URL is fetched as given. */
export function rawSkillUrl(value: string): string {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(value);
  return match ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}` : value;
}

export function createAgentSkillsService(
  prisma: PrismaClient,
  options: { resolveHostname?: ResolveHostname; fetchText?: typeof fetchSafeWebText } = {},
) {
  const fetchText = options.fetchText ?? fetchSafeWebText;

  async function ownedBot(actor: Actor, botId: string) {
    const bot = await prisma.bot.findFirst({
      where: { id: botId, spaceId: actor.spaceId, userId: actor.userId, archivedAt: null },
      select: { id: true },
    });
    if (!bot) throw new IsolationError();
  }

  /** An active skill. Drafts are invisible here; only approveDraft and discardDraft reach them. */
  async function owned(actor: Actor, skillId: string) {
    const row = await prisma.agentSkill.findFirst({
      where: {
        id: skillId,
        spaceId: actor.spaceId,
        userId: actor.userId,
        status: "active",
      },
    });
    if (!row) throw new IsolationError();
    return row;
  }

  return {
    async list(actor: Actor): Promise<Omit<AgentSkill, "content">[]> {
      const rows = await prisma.agentSkill.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId, status: "active" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return mergeBuiltinSkills(builtinCatalog(), rows.map(mapAgentSkill)).map(
        ({ content: _content, ...entry }) => entry,
      );
    },

    async listWithContent(actor: Actor): Promise<AgentSkill[]> {
      const rows = await prisma.agentSkill.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId, status: "active" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return mergeBuiltinSkills(builtinCatalog(), rows.map(mapAgentSkill));
    },

    async forBot(actor: Actor, botId: string): Promise<BotAgentSkill[]> {
      await ownedBot(actor, botId);
      const [catalog, off] = await Promise.all([
        this.list(actor),
        prisma.botSkillSetting.findMany({
          where: { spaceId: actor.spaceId, botId, enabled: false },
          select: { skillKey: true },
        }),
      ]);
      const disabled = new Set(off.map((row) => row.skillKey));
      return catalog.map((skill) => ({ ...skill, enabled: !disabled.has(skill.id) }));
    },

    async setEnabled(
      actor: Actor,
      input: { botId: string; skillKey: string; enabled: boolean },
    ): Promise<{ ok: true }> {
      await ownedBot(actor, input.botId);
      const catalog = await this.list(actor);
      if (!catalog.some((skill) => skill.id === input.skillKey)) throw new IsolationError();
      await prisma.botSkillSetting.upsert({
        where: { botId_skillKey: { botId: input.botId, skillKey: input.skillKey } },
        create: {
          spaceId: actor.spaceId,
          botId: input.botId,
          skillKey: input.skillKey,
          enabled: input.enabled,
        },
        update: { enabled: input.enabled },
      });
      return { ok: true };
    },

    async importFromUrl(actor: Actor, input: { url: string }): Promise<AgentSkill> {
      const url = rawSkillUrl(input.url.trim());
      if (!url.startsWith("https://")) {
        throw new ORPCError("BAD_REQUEST", { message: "Use an https:// link to a SKILL.md." });
      }
      let text: string;
      try {
        text = (
          await fetchText(url, {
            resolveHostname: options.resolveHostname,
            maxBytes: MAX_SKILL_BYTES,
            allowedPorts: [443],
          })
        ).body;
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Could not fetch the skill.",
        });
      }
      const parsed = parseSkillMd(text);
      if ("error" in parsed) throw new ORPCError("BAD_REQUEST", { message: parsed.error });
      // The origin is kept in the frontmatter, so the skill file says where it came from.
      const content = buildSkillMd({
        ...parsed,
        frontmatter: { ...parsed.frontmatter, "source-url": input.url.trim() },
      });
      return this.create(actor, { content });
    },

    async get(actor: Actor, input: { skillId?: string; name?: string }): Promise<AgentSkill> {
      if (input.skillId?.startsWith("builtin:")) {
        const builtin = builtinCatalog().find((skill) => skill.id === input.skillId);
        if (!builtin) throw new IsolationError();
        return builtin;
      }
      if (input.skillId) {
        return mapAgentSkill(await owned(actor, input.skillId));
      }
      const name = input.name?.trim() ?? "";
      const rows = await prisma.agentSkill.findMany({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          status: "active",
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      const row = findSkillByName(rows, name);
      if (row) return mapAgentSkill(row);
      const builtin = findSkillByName(builtinCatalog(), name);
      if (!builtin) throw new IsolationError();
      return builtin;
    },

    async create(
      actor: Actor,
      input: { content?: string; name?: string; description?: string; body?: string },
    ): Promise<AgentSkill> {
      const resolved = resolveSkillContent(input);
      const clash = await prisma.agentSkill.findFirst({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          name: { equals: resolved.name, mode: "insensitive" },
        },
      });
      if (
        clash ||
        builtinCatalog().some((s) => s.name.toLowerCase() === resolved.name.toLowerCase())
      ) {
        throw new ORPCError("CONFLICT", { message: "A skill with that name already exists." });
      }
      try {
        const row = await prisma.agentSkill.create({
          data: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            name: resolved.name,
            description: resolved.description,
            content: resolved.content,
            source: "user",
          },
        });
        return mapAgentSkill(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", { message: "A skill with that name already exists." });
        }
        throw error;
      }
    },

    async update(
      actor: Actor,
      input: {
        skillId: string;
        content?: string;
        name?: string;
        description?: string;
        body?: string;
      },
    ): Promise<AgentSkill> {
      const existing = await owned(actor, input.skillId);
      if (isSkillReadOnly(asSource(existing.source) as SkillSource)) {
        throw new ORPCError("BAD_REQUEST", { message: "Builtin and plugin skills are read-only." });
      }
      const resolved = resolveSkillContent({ ...input, prior: existing });
      if (!findSkillByName([existing], resolved.name)) {
        const clash = await prisma.agentSkill.findFirst({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            name: { equals: resolved.name, mode: "insensitive" },
            NOT: { id: existing.id },
          },
        });
        if (
          clash ||
          builtinCatalog().some((s) => s.name.toLowerCase() === resolved.name.toLowerCase())
        ) {
          throw new ORPCError("CONFLICT", { message: "A skill with that name already exists." });
        }
      }
      // Mutate only owner-scoped user rows (never builtin/plugin), even if source was tampered.
      try {
        const updated = await prisma.agentSkill.updateMany({
          where: {
            id: existing.id,
            spaceId: actor.spaceId,
            userId: actor.userId,
            source: "user",
          },
          data: {
            name: resolved.name,
            description: resolved.description,
            content: resolved.content,
            // The owner's own edit settles any revision an agent proposed.
            pendingContent: null,
            pendingTool: Prisma.DbNull,
          },
        });
        if (updated.count !== 1) throw new IsolationError();
      } catch (error) {
        if (error instanceof IsolationError) throw error;
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", { message: "A skill with that name already exists." });
        }
        throw error;
      }
      const row = await prisma.agentSkill.findFirst({
        where: {
          id: existing.id,
          spaceId: actor.spaceId,
          userId: actor.userId,
        },
      });
      if (!row) throw new IsolationError();
      return mapAgentSkill(row);
    },

    async drafts(actor: Actor): Promise<AgentSkillDraft[]> {
      const rows = await prisma.agentSkill.findMany({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          OR: [{ status: "draft" }, { pendingContent: { not: null } }],
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      });
      return rows.flatMap((row) => {
        const revision = row.status === "active";
        const content = revision ? (row.pendingContent ?? "") : row.content;
        const parsed = parseSkillMd(content);
        if ("error" in parsed) return [];
        const tool = draftTool(row, revision);
        return [
          {
            id: row.id,
            name: parsed.name,
            description: parsed.description,
            content,
            revision,
            ...(tool ? { tool } : {}),
          },
        ];
      });
    },

    async approveDraft(actor: Actor, skillId: string, toolHash?: string): Promise<AgentSkill> {
      const row = await prisma.agentSkill.findFirst({
        where: {
          id: skillId,
          spaceId: actor.spaceId,
          userId: actor.userId,
          OR: [{ status: "draft" }, { pendingContent: { not: null } }],
        },
      });
      if (!row) throw new IsolationError();
      const where = { id: row.id, spaceId: actor.spaceId, userId: actor.userId, source: "user" };
      // Approving a tool pins the hash of the exact source shown to the owner, in the same write
      // that activates it. tool_run refuses any source that does not hash to this value.
      const tool = pendingToolOf(row, row.status === "active");
      if (tool) {
        const hash = toolSourceHash(tool.source);
        if (toolHash !== hash) {
          throw new ORPCError("CONFLICT", {
            message: "The tool changed after you opened it. Review it again.",
          });
        }
      }
      if (row.status === "draft") {
        const activated = await prisma.agentSkill.updateMany({
          // toolSource in the filter: a draft the bot edited since we read it is not activated.
          where: { ...where, status: "draft", toolSource: row.toolSource },
          data: {
            status: "active",
            ...(tool ? { toolSourceHash: toolSourceHash(tool.source) } : {}),
          },
        });
        if (activated.count !== 1) {
          throw new ORPCError("CONFLICT", { message: "The skill changed. Review it again." });
        }
      } else {
        const parsed = parseSkillMd(row.pendingContent ?? "");
        if ("error" in parsed) throw new ORPCError("BAD_REQUEST", { message: parsed.error });
        const clash = await prisma.agentSkill.findFirst({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            name: { equals: parsed.name, mode: "insensitive" },
            NOT: { id: row.id },
          },
        });
        const nameTaken = "A skill with that name already exists.";
        if (
          clash ||
          builtinCatalog().some((s) => s.name.toLowerCase() === parsed.name.toLowerCase())
        ) {
          throw new ORPCError("CONFLICT", { message: nameTaken });
        }
        let applied: { count: number };
        try {
          applied = await prisma.agentSkill.updateMany({
            where: { ...where, pendingContent: row.pendingContent },
            data: {
              name: parsed.name,
              description: parsed.description,
              content: buildSkillMd(parsed),
              pendingContent: null,
              pendingTool: Prisma.DbNull,
              ...(tool
                ? {
                    toolSource: tool.source,
                    toolInputSchema: tool.inputSchema as object,
                    toolNotes: tool.notes as object,
                    toolSourceHash: toolSourceHash(tool.source),
                  }
                : {}),
            },
          });
        } catch (error) {
          if (isUniqueViolation(error)) throw new ORPCError("CONFLICT", { message: nameTaken });
          throw error;
        }
        if (applied.count !== 1) {
          throw new ORPCError("CONFLICT", { message: "The skill changed. Review it again." });
        }
      }
      const approved = await prisma.agentSkill.findFirst({
        where: { id: row.id, spaceId: actor.spaceId, userId: actor.userId },
      });
      if (!approved) throw new IsolationError();
      return mapAgentSkill(approved);
    },

    /** Deletes a new draft, or drops a proposed revision and keeps the active skill as it was. */
    async discardDraft(actor: Actor, skillId: string): Promise<{ ok: true }> {
      const scope = { id: skillId, spaceId: actor.spaceId, userId: actor.userId };
      const deleted = await prisma.agentSkill.deleteMany({ where: { ...scope, status: "draft" } });
      if (deleted.count === 0) {
        const cleared = await prisma.agentSkill.updateMany({
          where: { ...scope, status: "active", pendingContent: { not: null } },
          data: { pendingContent: null, pendingTool: Prisma.DbNull },
        });
        if (cleared.count !== 1) throw new IsolationError();
      }
      return { ok: true };
    },

    async remove(actor: Actor, skillId: string): Promise<{ ok: true }> {
      const existing = await owned(actor, skillId);
      if (isSkillReadOnly(asSource(existing.source) as SkillSource)) {
        throw new ORPCError("BAD_REQUEST", { message: "Builtin and plugin skills are read-only." });
      }
      const deleted = await prisma.agentSkill.deleteMany({
        where: {
          id: existing.id,
          spaceId: actor.spaceId,
          userId: actor.userId,
          source: "user",
        },
      });
      if (deleted.count !== 1) throw new IsolationError();
      return { ok: true };
    },
  };
}

export type AgentSkillsService = ReturnType<typeof createAgentSkillsService>;
