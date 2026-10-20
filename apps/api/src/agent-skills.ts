import { ORPCError } from "@orpc/server";
import { BUILTIN_AGENT_SKILLS, fetchSafeWebText, type ResolveHostname } from "@rakazo/adapters";
import type { Actor, AgentSkill, AgentSkillSource, BotAgentSkill } from "@rakazo/contracts";
import {
  buildSkillMd,
  findSkillByName,
  isSkillReadOnly,
  mergeBuiltinSkills,
  parseSkillMd,
  type SkillSource,
} from "@rakazo/core";
import { IsolationError, isUniqueViolation, type PrismaClient } from "@rakazo/db";

type AgentSkillRow = {
  id: string;
  name: string;
  description: string;
  content: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

function asSource(value: string): AgentSkillSource {
  if (value === "builtin" || value === "plugin" || value === "user") return value;
  return "user";
}

export function mapAgentSkill(row: AgentSkillRow): AgentSkill {
  const source = asSource(row.source);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    source,
    readOnly: isSkillReadOnly(source as SkillSource),
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
    readOnly: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}

export function resolveSkillContent(input: {
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

  async function owned(actor: Actor, skillId: string) {
    const row = await prisma.agentSkill.findFirst({
      where: {
        id: skillId,
        spaceId: actor.spaceId,
        userId: actor.userId,
      },
    });
    if (!row) throw new IsolationError();
    return row;
  }

  return {
    async list(actor: Actor): Promise<Omit<AgentSkill, "content">[]> {
      const rows = await prisma.agentSkill.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return mergeBuiltinSkills(builtinCatalog(), rows.map(mapAgentSkill)).map(
        ({ content: _content, ...entry }) => entry,
      );
    },

    async listWithContent(actor: Actor): Promise<AgentSkill[]> {
      const rows = await prisma.agentSkill.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
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
