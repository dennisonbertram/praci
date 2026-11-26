import {
  customPageSpawnKey,
  financeAgentSpawnKey,
  gtmAgentSpawnKey,
  INTEGRATION_PRESETS,
  integrationAgentSpawnKey,
  mailThreadAgentSpawnKey,
  NEW_PAGE_INSTRUCTIONS,
} from "@rakazo/contracts";
import { GTM_PAGE_INSTRUCTIONS } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  currentDefaultInstructions,
  dismissInstructionsUpgrade,
  instructionsUpgrade,
  upgradeInstructions,
} from "./bot-instructions-upgrade.js";
import { FINANCE_AGENT_INSTRUCTIONS } from "./finance-agent.js";
import { GTM_AGENT_INSTRUCTIONS } from "./gtm-agent.js";
import { MAIL_THREAD_AGENT_INSTRUCTIONS } from "./inbox-thread-agent.js";
import { instructions as integrationInstructions } from "./integration-agent.js";

type Row = Record<string, unknown>;
const actor = { spaceId: "s1", userId: "u1" };
const match = (row: Row, where: Row = {}) => Object.entries(where).every(([k, v]) => row[k] === v);

function fake(bots: Row[], extras: Row = {}) {
  return {
    bots,
    prisma: {
      bot: {
        findFirst: async ({ where }: { where: Row }) => bots.find((b) => match(b, where)) ?? null,
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const rows = bots.filter((b) => match(b, where));
          for (const row of rows) Object.assign(row, data);
          return { count: rows.length };
        },
      },
      mcpServer: {
        findFirst: async () => extras.server ?? null,
        findMany: async () => [],
      },
      connection: { findFirst: async () => null },
      capabilityInstall: { findFirst: async () => null },
    } as never,
  };
}
const bot = (over: Row) => ({
  id: "b1",
  spaceId: "s1",
  userId: "u1",
  archivedAt: null,
  instructions: "",
  spawnKey: null,
  instructionsUpgradeDismissedHash: null,
  ...over,
});

describe("currentDefaultInstructions", () => {
  it("returns the built-in default", async () => {
    const { prisma } = fake([]);
    const row = bot({ spawnKey: financeAgentSpawnKey("u1") });
    expect(await currentDefaultInstructions(prisma, row)).toBe(FINANCE_AGENT_INSTRUCTIONS);
  });
  it("returns the integration default", async () => {
    const server = { endpoint: "https://mcp.mercury.com/mcp", name: "Mercury" };
    const { prisma } = fake([], { server });
    const row = bot({ spawnKey: integrationAgentSpawnKey("srv") });
    expect(await currentDefaultInstructions(prisma, row)).toBe(
      integrationInstructions("Mercury", INTEGRATION_PRESETS.mercury.instructions),
    );
  });
  it("returns the email chat and page defaults", async () => {
    const { prisma } = fake([]);
    expect(
      await currentDefaultInstructions(
        prisma,
        bot({ spawnKey: mailThreadAgentSpawnKey("c", "t") }),
      ),
    ).toBe(MAIL_THREAD_AGENT_INSTRUCTIONS);
    expect(
      await currentDefaultInstructions(prisma, bot({ spawnKey: customPageSpawnKey("p") })),
    ).toBe(NEW_PAGE_INSTRUCTIONS);
  });
  it("is null for a user-made agent", async () => {
    const { prisma } = fake([]);
    expect(await currentDefaultInstructions(prisma, bot({}))).toBeNull();
  });
});

describe("instructionsUpgrade", () => {
  const spawnKey = financeAgentSpawnKey("u1");
  it("offers the default when the text differs", async () => {
    const { prisma } = fake([bot({ spawnKey, instructions: "mine" })]);
    expect(await instructionsUpgrade(prisma, actor, "b1")).toEqual({
      current: "mine",
      next: FINANCE_AGENT_INSTRUCTIONS,
    });
  });
  it("is null when the text equals the default or the agent has none", async () => {
    const same = fake([bot({ spawnKey, instructions: FINANCE_AGENT_INSTRUCTIONS })]);
    expect(await instructionsUpgrade(same.prisma, actor, "b1")).toBeNull();
    const user = fake([bot({ instructions: "x" })]);
    expect(await instructionsUpgrade(user.prisma, actor, "b1")).toBeNull();
  });
  it("treats a GTM agent that only lacks the run-time append as current", async () => {
    const withoutAppend = GTM_AGENT_INSTRUCTIONS.replace(GTM_PAGE_INSTRUCTIONS, "").trim();
    const { prisma } = fake([
      bot({ spawnKey: gtmAgentSpawnKey("u1"), instructions: withoutAppend }),
    ]);
    expect(await instructionsUpgrade(prisma, actor, "b1")).toBeNull();
  });
  it("is scoped to the caller", async () => {
    const { prisma } = fake([bot({ spawnKey, instructions: "mine" })]);
    await expect(
      instructionsUpgrade(prisma, { spaceId: "s2", userId: "u1" }, "b1"),
    ).rejects.toThrow();
    await expect(
      instructionsUpgrade(prisma, { spaceId: "s1", userId: "u2" }, "b1"),
    ).rejects.toThrow();
  });
  it("stays hidden after a dismiss until the default changes", async () => {
    const { prisma, bots } = fake([bot({ spawnKey, instructions: "mine" })]);
    await dismissInstructionsUpgrade(prisma, actor, "b1");
    expect(await instructionsUpgrade(prisma, actor, "b1")).toBeNull();
    bots[0]!.instructionsUpgradeDismissedHash = "hash-of-an-older-default";
    expect(await instructionsUpgrade(prisma, actor, "b1")).not.toBeNull();
  });
});

describe("upgradeInstructions", () => {
  const spawnKey = financeAgentSpawnKey("u1");
  it("replaces the text when it still equals from", async () => {
    const { prisma, bots } = fake([bot({ spawnKey, instructions: "mine" })]);
    await upgradeInstructions(prisma, actor, "b1", "mine");
    expect(bots[0]!.instructions).toBe(FINANCE_AGENT_INSTRUCTIONS);
  });
  it("conflicts when the text changed since it was shown", async () => {
    const { prisma, bots } = fake([bot({ spawnKey, instructions: "edited later" })]);
    await expect(upgradeInstructions(prisma, actor, "b1", "mine")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(bots[0]!.instructions).toBe("edited later");
  });
  it("refuses another user's agent", async () => {
    const { prisma } = fake([bot({ spawnKey, instructions: "mine" })]);
    await expect(
      upgradeInstructions(prisma, { spaceId: "s1", userId: "u2" }, "b1", "mine"),
    ).rejects.toThrow();
  });
});
