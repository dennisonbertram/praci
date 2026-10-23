import { routineJobKey } from "@rakazo/adapter-kit";
import type { Actor, Bot } from "@rakazo/contracts";
import {
  INVESTORS_AGENT_BUILTIN_TOOLS,
  investorsAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  cadenceOf,
  ensureInvestorsAgent,
  INVESTOR_UPDATE_ROUTINE_NAME,
  INVESTORS_AGENT_INSTRUCTIONS,
  setInvestorsReminder,
} from "./investors-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type RoutineRow = {
  id: string;
  name: string;
  botId: string;
  prompt?: string;
  crons: string[];
  active: boolean;
  notify: boolean;
  timezone: string;
  nextRunAt: Date | null;
};

/** One routines table behind the three Prisma calls the routine code uses. */
function routineFakes(timezone: string | null = "America/New_York") {
  const rows: RoutineRow[] = [];
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    routine: {
      findFirst: vi.fn(
        async ({ where }: { where: { botId: string; name: string } }) =>
          rows.find((r) => r.botId === where.botId && r.name === where.name) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<RoutineRow, "id"> }) => {
        const row = { id: `routine-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      }),
    },
  };
  const prisma = {
    $transaction: async <T>(run: (t: typeof tx) => Promise<T>) => run(tx),
    routine: {
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<RoutineRow> }) => {
          const row = rows.find((r) => r.id === where.id);
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        },
      ),
    },
    user: { findUnique: vi.fn(async () => ({ timezone })) },
    bot: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) };
  return { rows, prisma, jobs };
}

describe("investor update routine", () => {
  it("creates one active, notifying monthly routine however many times the agent is ensured", async () => {
    const { rows, prisma, jobs } = routineFakes();
    const createBot = vi.fn(async () => ({ id: "bot-1" }) as Bot);
    for (let i = 0; i < 3; i++)
      await ensureInvestorsAgent({ prisma, jobs, repos: { createBot } } as never, actor);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: INVESTOR_UPDATE_ROUTINE_NAME,
      botId: "bot-1",
      crons: ["0 9 1 * *"],
      active: true,
      notify: true,
      timezone: "America/New_York",
    });
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it("uses UTC when the account has no time zone", async () => {
    const { rows, prisma, jobs } = routineFakes(null);
    await ensureInvestorsAgent(
      { prisma, jobs, repos: { createBot: async () => ({ id: "bot-1" }) as Bot } } as never,
      actor,
    );
    expect(rows[0]?.timezone).toBe("UTC");
  });

  it("rewrites the schedule for Monthly, Quarterly (January, April, July, October) and Off", async () => {
    const { rows, prisma, jobs } = routineFakes();
    const deps = { prisma, jobs } as never;
    expect(await setInvestorsReminder(deps, actor, "bot-1", "quarterly")).toBe("quarterly");
    expect(rows[0]).toMatchObject({ crons: ["0 9 1 1,4,7,10 *"], active: true });
    expect(rows[0]?.prompt).toContain("last full quarter");
    expect(rows[0]?.nextRunAt).not.toBeNull();
    expect(cadenceOf(rows[0]!)).toBe("quarterly");
    // The next run falls on the 1st of one of those months at 09:00 local time.
    const next = rows[0]!.nextRunAt!;
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      day: "numeric",
      month: "numeric",
      hour: "numeric",
      hour12: false,
    }).formatToParts(next);
    const part = (type: string) => Number(local.find((p) => p.type === type)?.value);
    expect([part("day"), part("hour")]).toEqual([1, 9]);
    expect([1, 4, 7, 10]).toContain(part("month"));

    expect(await setInvestorsReminder(deps, actor, "bot-1", "monthly")).toBe("monthly");
    expect(rows[0]).toMatchObject({ crons: ["0 9 1 * *"], active: true });
    expect(rows[0]?.prompt).toContain("last full month");

    // Off pauses the routine and cancels its wakeup; it never deletes it.
    expect(await setInvestorsReminder(deps, actor, "bot-1", "off")).toBe("off");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ active: false, nextRunAt: null });
    expect(cadenceOf(rows[0]!)).toBe("off");
    expect(jobs.cancel).toHaveBeenCalledWith(routineJobKey("routine-1"));
  });
});

describe("ensureInvestorsAgent", () => {
  it("rewrites the old default description only, scoped to the actor", async () => {
    const { prisma, jobs } = routineFakes();
    const createBot = vi.fn(async () => ({ id: "bot-1" }) as Bot);
    await ensureInvestorsAgent({ prisma, jobs, repos: { createBot } } as never, actor);
    expect(prisma.bot.updateMany).toHaveBeenCalledWith({
      where: {
        id: "bot-1",
        spaceId: "space-1",
        userId: "user-1",
        description: "Answers questions about your cap table, investors and finances.",
      },
      data: { description: "Answers questions about your investors, SAFEs and finances." },
    });
  });

  it("creates the bot only through createBot, keyed by the user's spawn key, and returns the same bot again", async () => {
    const bot = { id: "bot-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    const { prisma, jobs } = routineFakes();
    const deps = { prisma, jobs, repos: { createBot } } as never;

    await expect(ensureInvestorsAgent(deps, actor)).resolves.toBe(bot);
    await expect(ensureInvestorsAgent(deps, actor)).resolves.toBe(bot);

    expect(investorsAgentSpawnKey("user-1")).toBe("investors-agent:user-1");
    expect(isInvestorsAgentSpawnKey("investors-agent:other")).toBe(true);
    expect(isInvestorsAgentSpawnKey("carta-agent:user-1")).toBe(false);
    expect(createBot).toHaveBeenCalledTimes(2);
    for (const call of createBot.mock.calls) {
      expect(call).toEqual([
        actor,
        expect.objectContaining({
          spawnKey: "investors-agent:user-1",
          name: "Investors agent",
          color: pageAgentColor("investors"),
        }),
      ]);
    }
  });

  it("sends a SAFE to Mercury, never to a Carta write switch", () => {
    expect(INVESTORS_AGENT_INSTRUCTIONS).toContain("SAFEs are recorded in Mercury");
    expect(INVESTORS_AGENT_INSTRUCTIONS).not.toContain("Allow changes in Carta");
  });

  it("offers no mail_send and nothing that deletes; cap_table_update is for the sheet read", () => {
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toContain("investor_update_draft");
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toEqual(
      expect.arrayContaining(["cap_table_read", "search_data_room", "finance_overview"]),
    );
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).not.toContain("mail_send");
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toContain("cap_table_update");
    for (const name of INVESTORS_AGENT_BUILTIN_TOOLS) {
      expect(name).not.toMatch(/delete|remove|trash|^mcp__/);
    }
  });
});
