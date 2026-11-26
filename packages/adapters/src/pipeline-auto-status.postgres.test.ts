import type { PrismaClient } from "@rakazo/db";
import { createDb, runAsSystem, runAsTenant, saveContact, saveProspect } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPipelineAutoStatus } from "./pipeline-auto-status.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const NOW = new Date("2027-03-01T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describePostgres("pipeline auto-status run (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `pautorun-org-${suffix}`;
  const scope = { spaceId: `pautorun-space-${suffix}`, userId: `pautorun-user-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(() => runAsSystem("pipeline auto-status fixture", seed));

  async function seed() {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: scope.userId, name: scope.userId, email: `${scope.userId}@example.test` },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Pautorun Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: scope.spaceId, organizationId, name: scope.spaceId },
    });
    await prisma.connection.create({
      data: { ...scope, provider: "gmail", displayName: "Gmail", status: "connected" },
    });
  }

  afterAll(async () => {
    if (!prisma) return;
    await runAsSystem("pipeline auto-status cleanup", async () => {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: scope.userId } });
    });
    await close();
  });

  /** A prospect on a record plus a sent message to it five days ago. */
  const prospect = async (name: string, email: string) => {
    const contact = await saveContact(prisma, scope, { name, kind: "prospect", email });
    await saveProspect(prisma, scope, { id: contact.id, status: "not_reached" });
    const record = (
      await prisma.pipelineRecordPerson.findFirstOrThrow({
        where: { ...scope, contactId: contact.id },
        include: { record: true },
      })
    ).record;
    const connection = await prisma.connection.findFirstOrThrow({ where: scope });
    await prisma.cachedMailMessage.create({
      data: {
        ...scope,
        connectionId: connection.id,
        providerMessageId: `msg-${record.id}`,
        threadId: `thread-${record.id}`,
        fromAddress: "me@example.test",
        toAddresses: [email],
        ccAddresses: [],
        subject: `Intro to ${name}`,
        snippet: "",
        receivedAt: daysAgo(5),
        unread: false,
        seenAt: NOW,
        fromSelf: true,
      },
    });
    return record;
  };

  it("keeps a status the user set by hand, and still applies one they did not undo", async () => {
    // One record whose auto "reached_out" the user undid by setting the status themselves,
    // one untouched record with the same evidence.
    const held = await runAsSystem("pipeline auto-status fixture", () =>
      prospect("Held Investor", "held@fund.test"),
    );
    await runAsSystem("pipeline auto-status fixture", () =>
      prisma.pipelineEvent.create({
        data: {
          ...scope,
          recordId: held.id,
          kind: "auto",
          actor: "auto:mail",
          payload: {
            before: { status: "not_reached", nextCallAt: null, nextCallHasTime: false },
            set: { status: "reached_out", nextCallAt: null, nextCallHasTime: false },
            summary: "Intro to Held Investor",
            evidenceAt: daysAgo(6).toISOString(),
            evidenceId: "msg-old",
            undoneAt: daysAgo(4).toISOString(),
          },
        },
      }),
    );
    await runAsSystem("pipeline auto-status fixture", () =>
      prospect("Fresh Investor", "fresh@fund.test"),
    );

    const result = await runAsTenant(scope, () =>
      runPipelineAutoStatus({ prisma, now: () => NOW }, scope),
    );

    // Both records gain a Last contact; only the fresh one moves status.
    expect(result).toEqual({ records: 2, changed: 2 });
    const records = await runAsSystem("pipeline auto-status check", () =>
      prisma.pipelineRecord.findMany({ where: scope }),
    );
    expect(records.find((record) => record.id === held.id)?.status).toBe("not_reached");
    const fresh = records.find((record) => record.id !== held.id);
    expect(fresh?.status).toBe("reached_out");
    // The job must not write another auto change against the record it was told to leave.
    expect(
      await runAsSystem("pipeline auto-status check", () =>
        prisma.pipelineEvent.count({ where: { recordId: held.id, kind: "auto" } }),
      ),
    ).toBe(1);
  });
});
