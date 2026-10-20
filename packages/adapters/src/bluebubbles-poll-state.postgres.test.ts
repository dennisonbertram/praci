import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BlueBubblesAdapter } from "./bluebubbles-adapter.js";
import { BlueBubblesEmulator, createEmulatedBlueBubblesPlatform } from "./bluebubbles-emulator.js";
import { createBlueBubblesPollState } from "./bluebubbles-poll-state.js";
import { ChatSdkMessagingSurface } from "./chat-sdk-surface.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("BlueBubbles catch-up poll with shared state (PostgreSQL)", () => {
  const provider = `bluebubbles-${randomUUID().slice(0, 8)}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(() => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
  });
  afterAll(async () => {
    await prisma.messagingPollCursor.deleteMany({ where: { provider } });
    await close();
  });

  async function replica(emulator: BlueBubblesEmulator) {
    const platform = createEmulatedBlueBubblesPlatform(emulator, {
      pollIntervalMs: 60_000,
      pollState: createBlueBubblesPollState(prisma, provider),
    });
    const surface = new ChatSdkMessagingSurface([platform]);
    const handles: string[] = [];
    surface.onInbound(async (event) => {
      if (event.type === "message") handles.push(event.handle);
    });
    await surface.initialize();
    const adapter = platform.adapter as BlueBubblesAdapter;
    await adapter.disconnect();
    return { adapter, handles };
  }

  it("lets one replica poll per lease, persists the cursor, and resumes after a restart", async () => {
    const emulator = new BlueBubblesEmulator();
    const a = await replica(emulator);
    const b = await replica(emulator);
    const first = emulator.addMessage({
      from: "+15551230001",
      text: "one",
      dateCreated: Date.now() - 2000,
    });

    const [countA, countB] = await Promise.all([a.adapter.poll(), b.adapter.poll()]);
    expect([countA, countB].sort()).toEqual([0, 1]);
    expect([...a.handles, ...b.handles]).toEqual([first.guid]);

    const saved = await prisma.messagingPollCursor.findUniqueOrThrow({ where: { provider } });
    expect(Number(saved.cursorMs)).toBe(first.dateCreated);

    // A restarted process starts from the saved cursor, not from "10 minutes ago".
    await prisma.messagingPollCursor.update({ where: { provider }, data: { leaseUntil: null } });
    const restarted = await replica(emulator);
    await restarted.adapter.poll();
    expect(emulator.queries.at(-1)?.after).toBe(first.dateCreated);
  });
});
