import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { loadStoppedRunWork } from "./stopped-work.js";

const entry = (tool: string) => ({
  id: "t1",
  tool,
  args: "{}",
  ok: true,
  result: `${tool} result`,
});
const row = (status: string, goalEvidence: unknown, flags: Record<string, boolean> = {}) => ({
  status,
  goalEvidence,
  externalTaint: false,
  readOutsideContent: false,
  readDesktop: false,
  ...flags,
});
const scope = {
  spaceId: "space-1",
  threadId: "thread-1",
  botId: "bot-1",
  userId: "user-1",
  runId: "run-now",
  before: new Date("2026-11-05T12:00:00Z"),
};
function prismaWith(rows: unknown[]) {
  const findMany = vi.fn(async () => rows);
  return { prisma: { run: { findMany } } as unknown as PrismaClient, findMany };
}

describe("loadStoppedRunWork", () => {
  it("returns stopped runs oldest first and stops at a completed run", async () => {
    const { prisma } = prismaWith([
      row("cancelled", [entry("c")]),
      row("cancelled", [entry("b")]),
      row("completed", [entry("done")]),
      row("cancelled", [entry("old")]),
    ]);
    const work = await loadStoppedRunWork(prisma, scope);
    expect(work.runs.map((log) => log[0]?.tool)).toEqual(["b", "c"]);
  });

  it("skips runs that finished nothing and drops malformed data", async () => {
    const { prisma } = prismaWith([
      row("cancelled", null),
      row("cancelled", [{ nope: true }]),
      row("cancelled", [entry("a")]),
    ]);
    expect((await loadStoppedRunWork(prisma, scope)).runs).toHaveLength(1);
  });

  it("carries restriction markers from the columns, so a log that trimmed away its first calls changes nothing", async () => {
    const { prisma } = prismaWith([
      row("cancelled", [entry("only_own_state_tool_is_left")], {
        readOutsideContent: true,
        readDesktop: true,
        externalTaint: true,
      }),
    ]);
    expect(await loadStoppedRunWork(prisma, scope)).toMatchObject({
      restricted: true,
      readOutsideContent: true,
      readDesktop: true,
    });
  });

  it("reads only this space, user, thread and bot, and only earlier runs", async () => {
    const { prisma, findMany } = prismaWith([]);
    await loadStoppedRunWork(prisma, scope);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-1",
          threadId: "thread-1",
          botId: "bot-1",
          userId: "user-1",
          id: { not: "run-now" },
          createdAt: { lt: scope.before },
        }),
      }),
    );
  });
});
