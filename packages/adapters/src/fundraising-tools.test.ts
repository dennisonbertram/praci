import { investorsAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { fundraisingToolFromTool, fundraisingToolsAllowed } from "./fundraising-tools.js";

const scope = { spaceId: "s", userId: "u" };
const row = (extra: Record<string, unknown>) => ({
  id: "c",
  name: "Harbor Angels",
  email: "h@example.test",
  organization: null,
  kind: "prospect",
  notes: null,
  stage: "committed",
  checkSizeCents: 5_000_000n,
  nextStep: "Send SAFE",
  roundId: "r1",
  bot: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...extra,
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
    const contactFind = vi.fn(async () => [
      row({}),
      row({ id: "d", name: "Old Fund", roundId: "r0", checkSizeCents: null, stage: "committed" }),
    ]);
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
    } as never;
    const result = await fundraisingToolFromTool("fundraising_read", { prisma, scope });
    expect(result).toEqual({
      round: {
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
      expect.objectContaining({ where: { ...scope, kind: "prospect" } }),
    );
  });

  it("reports a closed round with nothing pending, and no round before the first", async () => {
    const closedAt = new Date("2026-03-01T00:00:00Z");
    const find = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(round({ closedAt }));
    const prisma = {
      fundraiseRound: { findFirst: find },
      contact: { findMany: async () => [row({})] },
      safe: { findMany: async () => [] },
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
      contact: { findMany: async () => [row({ stage: null, checkSizeCents: null })] },
      safe: { findMany: async () => [] },
    } as never;
    expect(await fundraisingToolFromTool("fundraising_read", { prisma, scope })).toMatchObject({
      prospects: [{ stage: "target" }],
    });
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
