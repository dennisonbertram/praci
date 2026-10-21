import type { Actor, Bot } from "@rakazo/contracts";
import {
  COMPANY_AGENT_INSTRUCTIONS,
  COMPANY_IMPORTER_INSTRUCTIONS,
  companyAgentSpawnKey,
  companyImporterSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import type { createRepos } from "@rakazo/db";

export async function ensureCompanyAgent(
  deps: { repos: Pick<ReturnType<typeof createRepos>, "createBot"> },
  actor: Actor,
): Promise<Bot> {
  return deps.repos.createBot(actor, {
    spawnKey: companyAgentSpawnKey(actor.userId),
    name: "Company agent",
    title: "",
    description: "Reconstructs your company history with provenance.",
    instructions: COMPANY_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
    color: pageAgentColor("company"),
  });
}

export async function ensureCompanyImporter(
  deps: { repos: Pick<ReturnType<typeof createRepos>, "createBot"> },
  actor: Actor,
): Promise<Bot> {
  return deps.repos.createBot(actor, {
    spawnKey: companyImporterSpawnKey(actor.userId),
    name: "Company importer",
    title: "",
    description: "Coordinates your read-only Company import.",
    instructions: COMPANY_IMPORTER_INSTRUCTIONS,
    notifyOnFinish: true,
    color: pageAgentColor("company"),
  });
}
