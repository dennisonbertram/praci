import type { PrismaClient } from "@rakazo/db";
import { createDb, savePushToken } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ExpoPushProvider } from "./expo-push.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("expo push handover (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const [first, second] = [`push-h1-${suffix}`, `push-h2-${suffix}`];
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL!);
    prisma = db.prisma;
    await prisma.user.createMany({
      data: [first, second].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
  });
  afterAll(async () => {
    if (!db) return;
    await prisma.user.deleteMany({ where: { id: { in: [first, second] } } });
    await prisma.$disconnect();
    await db.pool.end();
  });

  it("sends the previous owner's push to no device once the device moved accounts", async () => {
    const device = "ExponentPushToken[handover]";
    await savePushToken(prisma, first, device, "s1");
    await savePushToken(prisma, second, device, "s2");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const push = new ExpoPushProvider(prisma);
      const message = {
        kind: "completion",
        title: "t",
        body: "private",
        botId: "b",
        threadId: "x",
      } as const;
      const context = (userId: string) => ({
        operationId: "n",
        traceId: "n",
        spaceId: "w",
        userId,
        signal: new AbortController().signal,
      });
      await expect(push.deliver(message, context(first))).resolves.toBe("undeliverable");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
