// Red-phase skeleton: signatures only, no behavior. The real implementation follows.
import type { AgentRunModel, AgentRuntime, JobPublisher } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";

export interface TriageReadinessDeps {
  prisma: Pick<PrismaClient, "bot" | "aiDataConsent">;
  resolveModel?: (scope: {
    userId: string;
    spaceId: string;
    botId?: string;
  }) => Promise<AgentRunModel>;
}

export interface InboxTriageDeps extends TriageReadinessDeps {
  prisma: PrismaClient;
  runtime: AgentRuntime;
  jobs: JobPublisher;
}

export async function triageReadiness(
  _deps: TriageReadinessDeps,
  _scope: { userId: string; spaceId: string },
): Promise<{ model: AgentRunModel; botId: string | undefined } | null> {
  return null;
}

export async function runInboxTriage(
  _deps: InboxTriageDeps,
  _scope: { userId: string; spaceId: string },
): Promise<void> {}
