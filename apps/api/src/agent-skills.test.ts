import { fetchSafeWebText } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { buildSkillMd } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createAgentSkillsService, rawSkillUrl } from "./agent-skills.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
};

function savedSkill(name: string, source = "user") {
  return {
    id: "saved-1",
    spaceId: actor.spaceId,
    userId: actor.userId,
    name,
    description: "Saved review recipe",
    content: buildSkillMd({ name, description: "Saved review recipe", body: "Saved steps" }),
    source,
    origin: "user",
    status: "active",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

// Every actor sees several always-on builtins; these tests are about Interrogate, so drop the others.
const withoutInboxSearch = <T extends { id: string }>(skills: T[]) =>
  skills.filter((skill) => !skill.id.startsWith("builtin:") || skill.id === "builtin:Interrogate");

function setup(rows: ReturnType<typeof savedSkill>[] = []) {
  type Where = { id?: string; spaceId: string; userId: string; source?: string };
  const matches = (row: ReturnType<typeof savedSkill>, where: Where) =>
    Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value);
  const agentSkill = {
    findMany: vi.fn(async ({ where }: { where: Where }) =>
      rows.filter((row) => matches(row, where)),
    ),
    findFirst: vi.fn(async ({ where }: { where: Where }) =>
      rows.find((row) => matches(row, where)),
    ),
    updateMany: vi.fn(async ({ where, data }: { where: Where; data: object }) => {
      const row = rows.find((row) => matches(row, where));
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Where }) => {
      const index = rows.findIndex((row) => matches(row, where));
      if (index < 0) return { count: 0 };
      rows.splice(index, 1);
      return { count: 1 };
    }),
  };
  return {
    agentSkill,
    service: createAgentSkillsService({ agentSkill } as unknown as PrismaClient),
  };
}

describe("built-in skill precedence in the API", () => {
  it.each(["interrogate", " Interrogate "])(
    "keeps %j listed, readable and mutable",
    async (name) => {
      const { service } = setup([savedSkill(name)]);
      await expect(service.list(actor).then(withoutInboxSearch)).resolves.toEqual([
        expect.objectContaining({ id: "saved-1", name, readOnly: false }),
      ]);
      await expect(service.listWithContent(actor).then(withoutInboxSearch)).resolves.toEqual([
        expect.objectContaining({ id: "saved-1", content: expect.stringContaining("Saved steps") }),
      ]);
      await expect(service.get(actor, { name: " INTERROGATE " })).resolves.toMatchObject({
        id: "saved-1",
        source: "user",
      });
      await expect(service.get(actor, { skillId: "saved-1" })).resolves.toMatchObject({ name });
      await expect(
        service.update(actor, { skillId: "saved-1", description: "Updated recipe" }),
      ).resolves.toMatchObject({ name: name.trim(), description: "Updated recipe" });
      await expect(service.remove(actor, "saved-1")).resolves.toEqual({ ok: true });
      await expect(service.get(actor, { name: "Interrogate" })).resolves.toMatchObject({
        id: "builtin:Interrogate",
        readOnly: true,
      });
    },
  );

  it("preserves plugin precedence and read-only enforcement", async () => {
    const { service, agentSkill } = setup([savedSkill(" Interrogate ", "plugin")]);
    await expect(service.get(actor, { name: "interrogate" })).resolves.toMatchObject({
      id: "saved-1",
      source: "plugin",
      readOnly: true,
    });
    await expect(service.update(actor, { skillId: "saved-1", body: "Changed" })).rejects.toThrow(
      "read-only",
    );
    await expect(service.remove(actor, "saved-1")).rejects.toThrow("read-only");
    expect(agentSkill.updateMany).not.toHaveBeenCalled();
    expect(agentSkill.deleteMany).not.toHaveBeenCalled();
  });

  it.each([{ spaceId: "other-space" }, { userId: "other-user" }])(
    "does not let foreign skills shadow the builtin: %j",
    async (foreignOwner) => {
      const { service } = setup([{ ...savedSkill(" Interrogate "), ...foreignOwner }]);
      await expect(service.get(actor, { name: "interrogate" })).resolves.toMatchObject({
        id: "builtin:Interrogate",
        readOnly: true,
      });
      await expect(service.list(actor).then(withoutInboxSearch)).resolves.toEqual([
        expect.objectContaining({ id: "builtin:Interrogate" }),
      ]);
      await expect(service.get(actor, { skillId: "saved-1" })).rejects.toThrow();
    },
  );
});

describe("per-bot skill switches", () => {
  function bots() {
    const settings: Array<{ botId: string; skillKey: string; enabled: boolean }> = [];
    const prisma = {
      bot: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
          where.id === "bot-1" && where.userId === actor.userId ? { id: "bot-1" } : null,
        ),
      },
      agentSkill: { findMany: vi.fn(async () => [savedSkill("Mine")]) },
      botSkillSetting: {
        findMany: vi.fn(async () => settings.filter((row) => !row.enabled)),
        upsert: vi.fn(
          async ({ create }: { create: { botId: string; skillKey: string; enabled: boolean } }) => {
            const index = settings.findIndex((row) => row.skillKey === create.skillKey);
            if (index >= 0) settings[index] = create;
            else settings.push(create);
          },
        ),
      },
    };
    return { prisma, service: createAgentSkillsService(prisma as unknown as PrismaClient) };
  }

  it("lists every skill on until one is switched off", async () => {
    const { service } = bots();
    expect((await service.forBot(actor, "bot-1")).every((skill) => skill.enabled)).toBe(true);
    await service.setEnabled(actor, { botId: "bot-1", skillKey: "saved-1", enabled: false });
    const list = await service.forBot(actor, "bot-1");
    expect(list.find((skill) => skill.id === "saved-1")?.enabled).toBe(false);
    expect(list.find((skill) => skill.id.startsWith("builtin:"))?.enabled).toBe(true);
  });

  it("refuses another user's bot and unknown skill keys", async () => {
    const { service, prisma } = bots();
    const stranger = { ...actor, userId: "user-2" };
    await expect(service.forBot(stranger, "bot-1")).rejects.toThrow();
    await expect(
      service.setEnabled(stranger, { botId: "bot-1", skillKey: "saved-1", enabled: false }),
    ).rejects.toThrow();
    await expect(
      service.setEnabled(actor, { botId: "bot-1", skillKey: "other-users-skill", enabled: false }),
    ).rejects.toThrow();
    expect(prisma.botSkillSetting.upsert).not.toHaveBeenCalled();
  });
});

describe("importing a skill from a URL", () => {
  const publicHost = async () => [{ address: "203.0.113.10", family: 4 as const }];
  const body = "---\nname: Remote\ndescription: From the web\n---\n\nSteps\n";

  function importer(text: string, requested: string[] = []) {
    const created: Array<{ data: { content: string; source: string } }> = [];
    const prisma = {
      agentSkill: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          created.push(args as never);
          return { ...savedSkill("Remote"), ...args.data };
        }),
      },
    };
    const service = createAgentSkillsService(prisma as unknown as PrismaClient, {
      resolveHostname: publicHost,
      fetchText: (url, options) =>
        fetchSafeWebText(url, {
          ...options,
          fetch: (async (input: RequestInfo | URL) => {
            requested.push(String(input));
            return new Response(text);
          }) as typeof fetch,
        }),
    });
    return { service, created };
  }

  it("turns a GitHub blob link into the raw file", () => {
    expect(rawSkillUrl("https://github.com/acme/skills/blob/main/a/SKILL.md")).toBe(
      "https://raw.githubusercontent.com/acme/skills/main/a/SKILL.md",
    );
    expect(rawSkillUrl("https://example.com/SKILL.md")).toBe("https://example.com/SKILL.md");
  });

  it("stores the skill as a user skill and records where it came from", async () => {
    const requested: string[] = [];
    const { service, created } = importer(body, requested);
    const link = "https://github.com/acme/skills/blob/main/SKILL.md";
    await service.importFromUrl(actor, { url: link });
    expect(requested[0]).toBe("https://raw.githubusercontent.com/acme/skills/main/SKILL.md");
    expect(created[0]?.data.source).toBe("user");
    expect(created[0]?.data.content).toContain("source-url");
    expect(created[0]?.data.content).toContain(link);
  });

  it("refuses private hosts and plain http without fetching", async () => {
    const { service } = importer(body);
    for (const url of [
      "https://localhost/SKILL.md",
      "https://10.0.0.5/SKILL.md",
      "https://169.254.169.254/SKILL.md",
      "http://example.com/SKILL.md",
    ]) {
      await expect(service.importFromUrl(actor, { url })).rejects.toThrow();
    }
  });

  it("refuses a host that resolves to a private address", async () => {
    const service = createAgentSkillsService({} as PrismaClient, {
      resolveHostname: async () => [{ address: "10.1.2.3", family: 4 as const }],
    });
    await expect(
      service.importFromUrl(actor, { url: "https://example.com/SKILL.md" }),
    ).rejects.toThrow(/private/i);
  });

  it("refuses files over the size limit and files without a name", async () => {
    await expect(
      importer("x".repeat(100_001)).service.importFromUrl(actor, {
        url: "https://example.com/SKILL.md",
      }),
    ).rejects.toThrow(/too large/i);
    await expect(
      importer("# no frontmatter").service.importFromUrl(actor, {
        url: "https://example.com/SKILL.md",
      }),
    ).rejects.toThrow(/name and description/i);
  });

  it("reads name and description from an uploaded SKILL.md the same way", async () => {
    const { service } = importer(body);
    const skill = await service.create(actor, { content: body.replace("Remote", "Uploaded") });
    expect(skill.name).toBe("Uploaded");
    expect(skill.description).toBe("From the web");
    await expect(
      service.create(actor, { content: "---\nname: Only name\n---\nBody" }),
    ).rejects.toThrow(/description/);
  });
});

describe("agent skill drafts", () => {
  const draftRow = () => ({
    ...savedSkill("Agent draft"),
    id: "draft-1",
    origin: "agent",
    status: "draft",
  });

  it("keeps drafts out of the catalog", async () => {
    const { service } = setup([draftRow() as never]);
    expect((await service.list(actor)).map((skill) => skill.name)).not.toContain("Agent draft");
  });
});
