import { investorsAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { fundraisingToolFromTool, fundraisingToolsAllowed } from "./fundraising-tools.js";

const scope = { spaceId: "s", userId: "u" };
/** A contact as the overview reads it: its pipeline fields come from its record. */
const row = ({ id = "c", name = "Harbor Angels", ...record }: Record<string, unknown>) => ({
  id,
  name,
  email: "h@example.test",
  organization: null as string | null,
  kind: "prospect",
  notes: null,
  bot: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  pipelinePeople: [
    {
      record: {
        id: `r-${id}`,
        name,
        status: "committed",
        amountCents: 5_000_000n,
        nextStep: "Send SAFE",
        roundId: "r1",
        waitingSince: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ...record,
      },
    },
  ],
});
/** The pipeline tables behind those contacts. */
const pipelineOf = (rows: ReturnType<typeof row>[]) => ({
  pipelineEvent: { findMany: async () => [] },
  pipelineRecord: { findMany: async () => rows.map((r) => r.pipelinePeople[0]?.record) },
  pipelineRecordPerson: {
    findMany: async () =>
      rows.map((r) => ({
        recordId: r.pipelinePeople[0]?.record.id,
        contactId: r.id,
        contact: { kind: r.kind, name: r.name },
      })),
  },
});
const round = (extra: Record<string, unknown>) => ({
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000n,
  capCents: 1_000_000_000n,
  closedAt: null,
  ...extra,
});

describe("fundraising_read", () => {
  it("returns the open round, pending and each prospect, read with the run owner's scope", async () => {
    const roundFind = vi.fn(async () => round({}));
    const contacts = [
      row({}),
      row({ id: "d", name: "Old Fund", roundId: "r0", amountCents: null, status: "committed" }),
    ];
    const contactFind = vi.fn(async () => contacts);
    const safeFind = vi.fn(async () => [
      {
        id: "s1",
        source: "native",
        contactId: null,
        roundId: "r1",
        investorName: "Lakeside Fund",
        amountCents: 2_500_000n,
        capCents: 1_000_000_000n,
        valuationType: "post_money_cap",
        mfn: false,
        proRata: false,
        sentAt: new Date("2026-02-01T00:00:00Z"),
        paidAt: null,
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    ]);
    const prisma = {
      fundraiseRound: { findFirst: roundFind },
      contact: { findMany: contactFind },
      safe: { findMany: safeFind },
      ...pipelineOf(contacts),
    } as never;
    const result = await fundraisingToolFromTool("fundraising_read", { prisma, scope });
    expect(result).toEqual({
      round: {
        id: "r1",
        name: "Seed",
        status: "open",
        targetUsd: 2_000_000,
        postMoneyCapUsd: 10_000_000,
        closedAt: null,
      },
      pendingUsd: 75_000,
      signedUsd: 0,
      fundedUsd: 0,
      safes: [
        {
          investor: "Lakeside Fund",
          source: "native",
          status: "sent",
          amountUsd: 25_000,
          postMoneyCapUsd: 10_000_000,
          sentAt: "2026-02-01T00:00:00.000Z",
          paidAt: null,
          inShownRound: true,
        },
      ],
      prospects: [
        expect.objectContaining({
          name: "Harbor Angels",
          checkSizeUsd: 50_000,
          countsInPending: true,
        }),
        expect.objectContaining({ name: "Old Fund", checkSizeUsd: null, countsInPending: false }),
      ],
    });
    expect(roundFind).toHaveBeenCalledWith({ where: { ...scope, closedAt: null } });
    expect(safeFind).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    expect(contactFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(scope) }),
    );
  });

  it("reports a closed round with nothing pending, and no round before the first", async () => {
    const closedAt = new Date("2026-03-01T00:00:00Z");
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(round({ closedAt }));
    const prisma = {
      fundraiseRound: { findFirst: find },
      contact: { findMany: async () => [row({})] },
      safe: { findMany: async () => [] },
      ...pipelineOf([row({})]),
    } as never;
    expect(await fundraisingToolFromTool("fundraising_read", { prisma, scope })).toMatchObject({
      round: { status: "closed", closedAt: closedAt.toISOString() },
      pendingUsd: 0,
      prospects: [{ countsInPending: false }],
    });
    const empty = {
      fundraiseRound: { findFirst: async () => null },
      contact: { findMany: async () => [] },
      safe: { findMany: async () => [] },
      ...pipelineOf([]),
    } as never;
    expect(await fundraisingToolFromTool("fundraising_read", { prisma: empty, scope })).toEqual({
      round: null,
      pendingUsd: 0,
      signedUsd: 0,
      fundedUsd: 0,
      safes: [],
      prospects: [],
    });
  });

  it("lists a prospect saved without a stage at Target", async () => {
    const prisma = {
      fundraiseRound: { findFirst: async () => null },
      contact: { findMany: async () => [{ ...row({}), pipelinePeople: [] }] },
      safe: { findMany: async () => [] },
      ...pipelineOf([]),
    } as never;
    expect(await fundraisingToolFromTool("fundraising_read", { prisma, scope })).toMatchObject({
      prospects: [{ stage: "target" }],
    });
  });

  it("returns each prospect's status, interest, next call and last call without the call note", async () => {
    const contacts = [
      row({
        status: "met",
        interest: "in",
        nextCallAt: new Date("2026-04-01T15:00:00Z"),
        nextCallHasTime: true,
      }),
      row({ id: "d", name: "Quiet Fund" }),
    ];
    const prisma = {
      fundraiseRound: { findFirst: async () => null },
      contact: { findMany: async () => contacts },
      safe: { findMany: async () => [] },
      ...pipelineOf(contacts),
      pipelineEvent: {
        findMany: async () => [
          {
            id: "e1",
            recordId: "r-c",
            kind: "call",
            at: new Date("2026-03-20T10:00:00Z"),
            payload: { outcome: "spoke", note: "private detail" },
          },
        ],
      },
    } as never;
    const result = (await fundraisingToolFromTool("fundraising_read", { prisma, scope })) as {
      prospects: Record<string, unknown>[];
    };
    expect(result.prospects[0]).toMatchObject({
      status: "met",
      interest: "in",
      nextCallAt: "2026-04-01T15:00:00.000Z",
      nextCallHasTime: true,
      lastCall: { outcome: "spoke", at: "2026-03-20T10:00:00.000Z" },
    });
    expect(JSON.stringify(result)).not.toContain("private detail");
    expect(result.prospects[1]).toMatchObject({ nextCallAt: null, lastCall: null });
  });

  it("with prospect, returns only the matches, each with its details, people, referrer and call note", async () => {
    const contacts = [
      row({
        group: "Wave 1",
        referredByContactId: "d",
        details: [
          { label: "Why them", value: "Deep fintech thesis", source: "list" },
          { label: "Pitch angle", value: "Receipts API first", source: "list" },
        ],
      }),
      row({ id: "d", name: "Quiet Fund" }),
    ];
    const prisma = {
      fundraiseRound: { findFirst: async () => null },
      contact: { findMany: async () => contacts },
      safe: { findMany: async () => [] },
      ...pipelineOf(contacts),
      pipelineEvent: {
        findMany: async () => [
          {
            id: "e1",
            recordId: "r-c",
            kind: "call",
            at: new Date("2026-03-20T10:00:00Z"),
            payload: { outcome: "spoke", note: "asked about burn multiple" },
          },
        ],
      },
    } as never;
    const result = (await fundraisingToolFromTool(
      "fundraising_read",
      { prisma, scope },
      { prospect: "harbor" },
    )) as { prospects: Record<string, unknown>[] };
    expect(result.prospects).toHaveLength(1);
    expect(result.prospects[0]).toMatchObject({
      name: "Harbor Angels",
      group: "Wave 1",
      people: [{ name: "Harbor Angels" }],
      referredBy: "Quiet Fund",
      details: [
        { label: "Why them", value: "Deep fintech thesis" },
        { label: "Pitch angle", value: "Receipts API first" },
      ],
      lastCall: {
        outcome: "spoke",
        at: "2026-03-20T10:00:00.000Z",
        note: "asked about burn multiple",
      },
    });
  });

  it("matches a person or an organization, case-insensitive, and nothing when nothing matches", async () => {
    const harbor = { ...row({}), organization: "Harbor Capital" };
    const contacts = [
      harbor,
      row({ id: "d", name: "Quiet Fund" }),
      // A second person on Harbor's record: matching "blake" finds the record.
      {
        ...row({ id: "e", name: "Blake Example" }),
        pipelinePeople: [{ record: harbor.pipelinePeople[0]!.record }],
      },
    ];
    const prisma = {
      fundraiseRound: { findFirst: async () => null },
      contact: { findMany: async () => contacts },
      safe: { findMany: async () => [] },
      ...pipelineOf(contacts),
    } as never;
    const read = (prospect: string) =>
      fundraisingToolFromTool("fundraising_read", { prisma, scope }, { prospect }) as Promise<{
        prospects: { name: string }[];
      }>;
    expect((await read("HARBOR CAPITAL")).prospects.map((p) => p.name)).toEqual(["Harbor Angels"]);
    expect((await read("blake")).prospects.map((p) => p.name)).toEqual([
      "Harbor Angels",
      "Blake Example",
    ]);
    expect((await read("quiet")).prospects.map((p) => p.name)).toEqual(["Quiet Fund"]);
    expect((await read("no such firm")).prospects).toEqual([]);
    // Without prospect the rows stay small: no details, people or referrer key.
    const all = (await fundraisingToolFromTool("fundraising_read", { prisma, scope })) as {
      prospects: Record<string, unknown>[];
    };
    expect(all.prospects).toHaveLength(3);
    for (const p of all.prospects) {
      expect(p).not.toHaveProperty("details");
      expect(p).not.toHaveProperty("people");
      expect(p).not.toHaveProperty("referredBy");
      expect(p).not.toHaveProperty("group");
    }
  });

  it("is allowed only for the Investors agent's owner-started runs", () => {
    const base = {
      hasProvider: true,
      groupId: null,
      runUserId: "u",
      botUserId: "u",
      botSpawnKey: investorsAgentSpawnKey("u"),
      trigger: "user",
      messagingChannelRun: false,
    };
    expect(fundraisingToolsAllowed(base)).toBe(true);
    expect(fundraisingToolsAllowed({ ...base, botSpawnKey: "carta-agent:u" })).toBe(false);
    expect(fundraisingToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
    expect(fundraisingToolsAllowed({ ...base, trigger: "bot_message" })).toBe(false);
  });
});

describe("fundraising_round_save", () => {
  const stored = (data: Record<string, unknown>) => ({
    id: "r9",
    ...data,
    closedAt: null,
  });

  it("stores dollars as cents through saveRound, scoped to the run owner", async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => stored(data));
    const prisma = { fundraiseRound: { create } } as never;
    const result = await fundraisingToolFromTool(
      "fundraising_round_save",
      { prisma, scope },
      // Extra keys a model might add are not stored.
      { name: " Seed ", targetUsd: 3_000_000, postMoneyCapUsd: 15_000_000, spaceId: "other" },
    );
    expect(create).toHaveBeenCalledWith({
      data: { ...scope, name: "Seed", targetCents: 300_000_000, capCents: 1_500_000_000 },
    });
    expect(result).toEqual({
      ok: true,
      round: {
        id: "r9",
        name: "Seed",
        status: "open",
        targetUsd: 3_000_000,
        postMoneyCapUsd: 15_000_000,
      },
    });
  });

  it("edits the open round by id and refuses a closed or foreign one", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const findUniqueOrThrow = vi.fn(async () =>
      stored({ name: "Seed", targetCents: 1n, capCents: 2n }),
    );
    const prisma = { fundraiseRound: { updateMany, findUniqueOrThrow } } as never;
    await fundraisingToolFromTool(
      "fundraising_round_save",
      { prisma, scope },
      { id: "r9", name: "Seed", targetUsd: 1, postMoneyCapUsd: 2 },
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "r9", ...scope, closedAt: null },
      data: { name: "Seed", targetCents: 100, capCents: 200 },
    });
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await fundraisingToolFromTool(
        "fundraising_round_save",
        { prisma, scope },
        { id: "r9", name: "Seed", targetUsd: 1, postMoneyCapUsd: 2 },
      ),
    ).toEqual({ error: "That round was not found, or it is closed and cannot be edited." });
  });

  it("tells the agent a round is already open instead of returning a raw error", async () => {
    const create = vi.fn(async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    });
    const result = await fundraisingToolFromTool(
      "fundraising_round_save",
      { prisma: { fundraiseRound: { create } } as never, scope },
      { name: "Seed", targetUsd: 3_000_000, postMoneyCapUsd: 15_000_000 },
    );
    expect(result).toEqual({
      error: expect.stringContaining("A round is already open. Call fundraising_read"),
    });
    expect(JSON.stringify(result)).not.toContain("Unique constraint");
  });

  it("rejects missing, zero, negative and text amounts without writing", async () => {
    const create = vi.fn();
    const prisma = { fundraiseRound: { create } } as never;
    for (const bad of [
      { name: "Seed", targetUsd: 0, postMoneyCapUsd: 1 },
      { name: "Seed", targetUsd: -5, postMoneyCapUsd: 1 },
      { name: "Seed", targetUsd: "$3M", postMoneyCapUsd: 1 },
      { name: "", targetUsd: 5, postMoneyCapUsd: 1 },
      { name: "Seed", targetUsd: 5 },
    ]) {
      expect(
        await fundraisingToolFromTool("fundraising_round_save", { prisma, scope }, bad),
      ).toEqual({
        error: "Pass name, targetUsd and postMoneyCapUsd as whole US dollars above zero.",
      });
    }
    expect(create).not.toHaveBeenCalled();
  });
});
