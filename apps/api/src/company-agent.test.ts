import type { Actor, Bot } from "@rakazo/contracts";
import {
  COMPANY_AGENT_INSTRUCTIONS,
  COMPANY_IMPORTER_BUILTIN_TOOLS,
  COMPANY_IMPORTER_INSTRUCTIONS,
  companyAgentSpawnKey,
  companyImporterSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureCompanyAgent, ensureCompanyImporter } from "./company-agent.js";

const actor: Actor = {
  userId: "owner-1",
  spaceId: "space-1",
  email: "owner-1@example.test",
  isDeploymentOwner: false,
};

describe("Company agents", () => {
  it("creates the Company agent with the owner-scoped spawn key and authored instructions", async () => {
    const bot = { id: "company-agent-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    await expect(ensureCompanyAgent({ repos: { createBot } }, actor)).resolves.toBe(bot);
    expect(createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        spawnKey: companyAgentSpawnKey(actor.userId),
        name: "Company agent",
        instructions: COMPANY_AGENT_INSTRUCTIONS,
        color: pageAgentColor("company"),
      }),
    );
  });

  it("creates the importer without queuing a run and reserves its identity", async () => {
    const bot = { id: "company-importer-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    await expect(ensureCompanyImporter({ repos: { createBot } }, actor)).resolves.toBe(bot);
    expect(createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        spawnKey: companyImporterSpawnKey(actor.userId),
        name: "Company importer",
        instructions: COMPANY_IMPORTER_INSTRUCTIONS,
        color: pageAgentColor("company"),
      }),
    );
    expect(COMPANY_IMPORTER_BUILTIN_TOOLS).not.toContain("spawn_bot");
  });
});
