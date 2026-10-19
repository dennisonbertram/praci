import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  deletePushTokens,
  endSessionPushTokens,
  listPushEndpoints,
  PushSessionEndedError,
  savePushToken,
} from "./push-endpoints.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("push endpoints (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const a = `push-user-a-${suffix}`;
  const b = `push-user-b-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const tokens = async (userId: string) =>
    (await listPushEndpoints(prisma, userId)).map((e) => e.address).sort();

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [a, b].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [a, b] } } });
    await close();
  });

  it("registers per device, replaces a rotated token, and removes by session", async () => {
    await savePushToken(prisma, a, "ExponentPushToken[phone]", "s-phone");
    await savePushToken(prisma, a, "ExponentPushToken[tablet]", "s-tablet");
    expect(await tokens(a)).toEqual(["ExponentPushToken[phone]", "ExponentPushToken[tablet]"]);
    // Registering the same token again keeps one row.
    await savePushToken(prisma, a, "ExponentPushToken[phone]", "s-phone");
    expect(await tokens(a)).toHaveLength(2);
    // Two devices sharing a session keep both tokens.
    await savePushToken(prisma, a, "ExponentPushToken[phone-b]", "s-phone");
    expect(await tokens(a)).toHaveLength(3);
    await deletePushTokens(prisma, a, "s-phone");
    await savePushToken(prisma, a, "ExponentPushToken[phone]", "s-phone");
    // The phone's token rotated and the client says which token it replaces.
    await savePushToken(prisma, a, "ExponentPushToken[phone2]", "s-phone", {
      replacesToken: "ExponentPushToken[phone]",
    });
    expect(await tokens(a)).toEqual(["ExponentPushToken[phone2]", "ExponentPushToken[tablet]"]);
    // replacesToken only ever removes the caller's own token.
    await savePushToken(prisma, b, "ExponentPushToken[b-dev]", "s-b");
    await savePushToken(prisma, a, "ExponentPushToken[phone3]", "s-phone", {
      replacesToken: "ExponentPushToken[b-dev]",
    });
    expect(await tokens(b)).toEqual(["ExponentPushToken[b-dev]"]);
    await deletePushTokens(prisma, b);
    await savePushToken(prisma, a, "ExponentPushToken[phone2]", "s-phone", {
      replacesToken: "ExponentPushToken[phone3]",
    });
    // Signing out of the tablet removes only its token.
    await deletePushTokens(prisma, a, "s-tablet");
    expect(await tokens(a)).toEqual(["ExponentPushToken[phone2]"]);
    // Replacing the phone's session keeps its token; ending it removes it.
    await endSessionPushTokens(prisma, a, "s-phone", "s-phone-2");
    expect((await listPushEndpoints(prisma, a))[0]?.sessionId).toBe("s-phone-2");
    await endSessionPushTokens(prisma, a, "s-phone-2");
    expect(await tokens(a)).toEqual([]);
  });

  it("hands a device to the account that registers it last, and isolates accounts", async () => {
    await savePushToken(prisma, a, "ExponentPushToken[shared]", "s1");
    await savePushToken(prisma, b, "ExponentPushToken[other]", "s2");
    await deletePushTokens(prisma, b);
    expect(await tokens(a)).toEqual(["ExponentPushToken[shared]"]);
    await savePushToken(prisma, b, "ExponentPushToken[shared]", "s3");
    expect(await tokens(b)).toEqual(["ExponentPushToken[shared]"]);
    expect(await tokens(a)).toEqual([]);
    await deletePushTokens(prisma, a);
    await deletePushTokens(prisma, b);
  });

  it("keeps one owner when two accounts claim a token together", async () => {
    await Promise.all([
      savePushToken(prisma, a, "ExponentPushToken[race]", "s1"),
      savePushToken(prisma, b, "ExponentPushToken[race]", "s2"),
    ]);
    const owners = (await tokens(a)).length + (await tokens(b)).length;
    expect(owners).toBe(1);
    await deletePushTokens(prisma, a);
    await deletePushTokens(prisma, b);
  });

  it("does not save when the session is no longer active", async () => {
    await expect(
      savePushToken(prisma, a, "ExponentPushToken[late]", "s1", {
        sessionActive: async () => false,
      }),
    ).rejects.toBeInstanceOf(PushSessionEndedError);
    expect(await tokens(a)).toEqual([]);
  });

  it("removes a user's tokens when the user is deleted", async () => {
    const id = `push-user-c-${suffix}`;
    await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    await savePushToken(prisma, id, "ExponentPushToken[gone]", "s1");
    await prisma.user.delete({ where: { id } });
    expect(await prisma.notificationEndpoint.count({ where: { userId: id } })).toBe(0);
  });

  it("keeps one owner of an address when accounts race with other tokens in between", async () => {
    const other = createDb(databaseUrl!);
    try {
      for (let round = 0; round < 15; round += 1) {
        const shared = `ExponentPushToken[shared${round}]`;
        await Promise.all([
          savePushToken(prisma, a, shared, "s-a", { replacesToken: "ExponentPushToken[old-a]" }),
          savePushToken(other.prisma, b, shared, "s-b", {
            replacesToken: "ExponentPushToken[old-b]",
          }),
          savePushToken(prisma, a, `ExponentPushToken[a-own${round}]`, "s-a"),
          savePushToken(other.prisma, b, `ExponentPushToken[b-own${round}]`, "s-b"),
        ]);
        expect(await prisma.notificationEndpoint.count({ where: { address: shared } })).toBe(1);
      }
    } finally {
      await deletePushTokens(prisma, a);
      await deletePushTokens(prisma, b);
      await other.prisma.$disconnect();
      await other.pool.end();
    }
  });

  it("refuses a second endpoint for an address at the database", async () => {
    await savePushToken(prisma, a, "ExponentPushToken[unique]", "s1");
    await expect(
      prisma.notificationEndpoint.create({
        data: { userId: b, channel: "push", address: "ExponentPushToken[unique]", deviceId: "d" },
      }),
    ).rejects.toThrow();
    await deletePushTokens(prisma, a);
  });

  it("sign-out waits for a registration whose session check is in flight", async () => {
    const other = createDb(databaseUrl!);
    try {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let checking!: () => void;
      const started = new Promise<void>((resolve) => {
        checking = resolve;
      });
      const registering = savePushToken(prisma, a, "ExponentPushToken[late]", "s-out", {
        sessionActive: async () => {
          checking();
          await gate;
          return true;
        },
      });
      await started;
      // The sign-out cleanup runs on another connection while the registration holds the lock.
      const ending = endSessionPushTokens(other.prisma, a, "s-out");
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await Promise.all([registering, ending]);
      expect(await tokens(a)).toEqual([]);

      // And a registration that checks after the session ended is refused.
      await expect(
        savePushToken(prisma, a, "ExponentPushToken[after]", "s-out", {
          sessionActive: async () => false,
        }),
      ).rejects.toBeInstanceOf(PushSessionEndedError);
      expect(await tokens(a)).toEqual([]);
    } finally {
      await other.prisma.$disconnect();
      await other.pool.end();
    }
  });

  it("session replacement waits for a registration, so the token follows the new session", async () => {
    const other = createDb(databaseUrl!);
    try {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let checking!: () => void;
      const started = new Promise<void>((resolve) => {
        checking = resolve;
      });
      const registering = savePushToken(prisma, a, "ExponentPushToken[moved]", "s-old", {
        sessionActive: async () => {
          checking();
          await gate;
          return true;
        },
      });
      await started;
      const replacing = endSessionPushTokens(other.prisma, a, "s-old", "s-new");
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await Promise.all([registering, replacing]);
      expect((await listPushEndpoints(prisma, a)).map((e) => e.sessionId)).toEqual(["s-new"]);
    } finally {
      await deletePushTokens(prisma, a);
      await other.prisma.$disconnect();
      await other.pool.end();
    }
  });
});
