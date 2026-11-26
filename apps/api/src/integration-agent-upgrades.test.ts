import { INTEGRATION_PRESETS, integrationAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { instructions } from "./integration-agent.js";
import {
  INTEGRATION_PRESET_HISTORY,
  INTEGRATION_TEMPLATE_HISTORY,
} from "./integration-agent-history.js";
import { upgradeIntegrationAgentInstructions } from "./integration-agent-upgrades.js";

const old = (service: string, key: string) =>
  `${(INTEGRATION_TEMPLATE_HISTORY[0] as string).replaceAll("{service}", service)} ${INTEGRATION_PRESET_HISTORY[key]?.[0]}`;

function fakePrisma(bots: { id: string; instructions: string }[], server: object) {
  const updates: unknown[] = [];
  const rows = bots.map((b) => ({
    ...b,
    spaceId: "s",
    userId: "u",
    spawnKey: integrationAgentSpawnKey(`srv-${b.id}`),
  }));
  return {
    updates,
    prisma: {
      bot: {
        findMany: async () => rows,
        updateMany: async (args: { where: { instructions: string }; data: unknown }) => {
          updates.push(args);
          return { count: 1 };
        },
      },
      mcpServer: {
        findFirst: async () => server,
        findMany: async () => [],
      },
      connection: { findFirst: async () => null },
      capabilityInstall: { findFirst: async () => null },
    } as never,
  };
}

describe("upgradeIntegrationAgentInstructions", () => {
  const mercury = { endpoint: "https://mcp.mercury.com/mcp", name: "Mercury" };

  it("upgrades a past default to the current one with a compare-and-swap", async () => {
    const { prisma, updates } = fakePrisma(
      [{ id: "a", instructions: old("Mercury", "mercury") }],
      mercury,
    );
    expect(await upgradeIntegrationAgentInstructions(prisma)).toBe(1);
    expect(updates[0]).toMatchObject({
      where: { id: "a", spaceId: "s", userId: "u", instructions: old("Mercury", "mercury") },
      data: { instructions: instructions("Mercury", INTEGRATION_PRESETS.mercury.instructions) },
    });
  });

  it("leaves an edited text and the current text alone", async () => {
    const current = instructions("Mercury", INTEGRATION_PRESETS.mercury.instructions);
    const { prisma, updates } = fakePrisma(
      [
        { id: "a", instructions: old("Mercury", "mercury").replace("read", "scan") },
        { id: "b", instructions: current },
      ],
      mercury,
    );
    expect(await upgradeIntegrationAgentInstructions(prisma)).toBe(0);
    expect(updates).toEqual([]);
  });
});
