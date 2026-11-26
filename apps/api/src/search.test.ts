import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { querySpaceSearch } from "./search.js";

function makeSql(strings: TemplateStringsArray, ...interpolations: unknown[]) {
  let text = strings[0] ?? "";
  const values: unknown[] = [];
  for (let index = 0; index < interpolations.length; index += 1) {
    const interpolation = interpolations[index];
    if (typeof interpolation === "object" && interpolation !== null && "text" in interpolation) {
      const nested = interpolation as { text: string; values: unknown[] };
      text += nested.text;
      values.push(...nested.values);
    } else {
      text += "?";
      values.push(interpolation);
    }
    text += strings[index + 1] ?? "";
  }
  return { text, values };
}

vi.mock("@rakazo/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rakazo/db")>();
  return {
    ...actual,
    Prisma: {
      sql: makeSql,
      join: (parts: Array<{ text: string; values: unknown[] }>) => ({
        text: parts.map((part) => part.text).join(", "),
        values: parts.flatMap((part) => part.values),
      }),
    },
  };
});

const actor: Actor = { spaceId: "space-test", userId: "user-test" };

function fixture(count: number) {
  const artifacts = Array.from({ length: count }, (_, index) => ({
    id: `artifact-${index}`,
    botId: `bot-${index}`,
    bot: { name: "Bot" },
    name: "report.txt",
    mimeType: "text/plain",
    size: 10,
  }));
  const groupArtifacts = artifacts.map((artifact) => ({
    ...artifact,
    id: `group-${artifact.id}`,
    botId: null,
    bot: null,
    groupId: "group-test",
    group: { name: "Group" },
  }));
  const prisma = {
    bot: { findMany: vi.fn().mockResolvedValue([]) },
    chatGroup: { findMany: vi.fn().mockResolvedValue([]) },
    artifact: {
      findMany: vi.fn().mockResolvedValueOnce(artifacts).mockResolvedValueOnce(groupArtifacts),
    },
    routine: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn(makeSql).mockResolvedValue([]),
  };
  return { prisma, artifacts, groupArtifacts };
}

describe("artifact search batching", () => {
  it.each([1, 25])("uses one lookup per destination for %i matching artifacts", async (count) => {
    const { prisma } = fixture(count);
    await querySpaceSearch(prisma as unknown as PrismaClient, actor, "report");
    // Two artifact batches and the existing direct/group message searches.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    const direct = prisma.$queryRaw.mock.calls[0]?.[0];
    const group = prisma.$queryRaw.mock.calls[1]?.[0];
    expect(direct.text).toContain('t."botId" = candidate."targetId"');
    expect(group.text).toContain('t."groupId" = candidate."targetId"');
    for (const query of [direct, group]) {
      expect(query.values).toContain(actor.spaceId);
      expect(query.values).toContain(actor.userId);
      expect(query.text).toContain('ORDER BY m."createdAt" DESC');
    }
  });

  it("preserves artifact priority and skips missing messages regardless of batch row order", async () => {
    const { prisma } = fixture(3);
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { artifactId: "artifact-2", id: "message-2", seq: 8 },
        { artifactId: "artifact-0", id: "message-0", seq: 6 },
      ])
      .mockResolvedValueOnce([{ artifactId: "group-artifact-1", id: "group-message", seq: 3 }]);
    const hits = await querySpaceSearch(prisma as unknown as PrismaClient, actor, "report");
    expect(hits.map(({ artifactId, messageId, seq }) => ({ artifactId, messageId, seq }))).toEqual([
      { artifactId: "artifact-0", messageId: "message-0", seq: 6 },
      { artifactId: "artifact-2", messageId: "message-2", seq: 8 },
      { artifactId: "group-artifact-1", messageId: "group-message", seq: 3 },
    ]);
  });

  it("does not issue artifact queries for empty batches", async () => {
    const { prisma } = fixture(0);
    expect(await querySpaceSearch(prisma as unknown as PrismaClient, actor, "report")).toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("search filters", () => {
  it("excludes archived groups from group and artifact search", async () => {
    const { prisma } = fixture(0);
    await querySpaceSearch(prisma as unknown as PrismaClient, actor, "report");

    expect(prisma.chatGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
    expect(prisma.artifact.findMany.mock.calls[1]?.[0]).toMatchObject({
      where: { group: { archivedAt: null } },
    });
    const groupMessages = prisma.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray;
    expect(groupMessages.join("")).toContain('g."archivedAt" IS NULL');
  });

  it("escapes percent and underscore in name and message searches", async () => {
    const { prisma } = fixture(0);
    await querySpaceSearch(prisma as unknown as PrismaClient, actor, "50%_off");

    for (const query of prisma.$queryRaw.mock.calls) {
      expect(query.slice(1)).toContain("%50\\%\\_off%");
    }
    expect(prisma.chatGroup.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { name: { contains: "50\\%\\_off" } },
    });
  });
});
