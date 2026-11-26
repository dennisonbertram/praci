import type { Actor, Bot } from "@rakazo/contracts";
import {
  COMPANY_AGENT_INSTRUCTIONS,
  COMPANY_IMPORTER_INSTRUCTIONS,
  companyAgentSpawnKey,
  companyImporterSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import type { createRepos } from "@rakazo/db";
import type { BuiltInAgent } from "./page-agent-ensure.js";
import { ensurePageAgent } from "./page-agent-ensure.js";

type Deps = {
  repos: Pick<ReturnType<typeof createRepos>, "createBot" | "replaceBotInstructions">;
};

export const COMPANY_AGENT: BuiltInAgent = {
  kind: "company",
  spawnKey: companyAgentSpawnKey,
  name: "Company agent",
  description: "Reconstructs your company history with provenance.",
  instructions: COMPANY_AGENT_INSTRUCTIONS,
  color: pageAgentColor("company"),
};

export const COMPANY_IMPORTER: BuiltInAgent = {
  kind: "company-importer",
  spawnKey: companyImporterSpawnKey,
  name: "Company importer",
  description: "Coordinates your read-only Company import.",
  instructions: COMPANY_IMPORTER_INSTRUCTIONS,
  color: pageAgentColor("company"),
};

export const ensureCompanyAgent = (deps: Deps, actor: Actor): Promise<Bot> =>
  ensurePageAgent(deps, actor, COMPANY_AGENT);

export const ensureCompanyImporter = (deps: Deps, actor: Actor): Promise<Bot> =>
  ensurePageAgent(deps, actor, COMPANY_IMPORTER);
