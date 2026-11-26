import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { undoAutoApproval } from "./auto-approvals";

const actor = { spaceId: "space_1", userId: "user_1" } as never;

type Row = Record<string, unknown>;

function setup(rows: Row[]) {
  const created: Row[] = [];
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === "object" && "in" in value
        ? (value.in as unknown[]).includes(row[key])
        : row[key] === value,
    );
  const prisma = {
    approvalDecision: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => rows.find((r) => matches(r, where))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        created.push(data);
        return data;
      }),
    },
    externalEffect: {
      findFirst: vi.fn(async () => ({ request: { botId: "bot_1" } })),
    },
  } as unknown as PrismaClient;
  const deps = {
    prisma,
    undoMail: vi.fn(),
    restoreBot: vi.fn(async () => {}),
  };
  return { deps, created };
}

const base = { spaceId: "space_1", userId: "user_1", effectId: "effect_1", tool: "archive_bot" };
const autoApproved = { ...base, id: "dec_1", decision: "auto_approved", botId: "bot_1" };
const undone = { ...base, id: "dec_2", decision: "undone", botId: "bot_1" };

describe("undoAutoApproval archive_bot", () => {
  it("is not found when the effect was already undone", async () => {
    const { deps, created } = setup([autoApproved, undone]);
    await expect(undoAutoApproval(deps, actor, "dec_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(deps.restoreBot).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("restores the agent and records one undone row", async () => {
    const { deps, created } = setup([autoApproved]);
    await expect(undoAutoApproval(deps, actor, "dec_1")).resolves.toEqual({ ok: true });
    expect(deps.restoreBot).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ decision: "undone", effectId: "effect_1" });
  });
});
