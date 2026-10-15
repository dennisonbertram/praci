import type {
  AgentHomeStore,
  AgentRuntime,
  BackgroundJobHandlers,
  JobPublisher,
  MessagingSurface,
  SandboxProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import { messagingDeliverJob } from "@rakazo/adapter-kit";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { CloudAgentConnection } from "./cloud-agent-factory.js";
import { pollCloudAgent } from "./cloud-agent-poll.js";
import { expireComputerControl } from "./computer-control.js";
import { scheduleComputerSleep, sleepComputerIfIdle } from "./computer-idle.js";
import { performComputerUpdate } from "./computer-update.js";
import type { createRunExecutor } from "./executor.js";
import type { FinanceSyncDeps } from "./finance-sync.js";
import { syncFinanceForUser } from "./finance-sync.js";
import { compactHistory } from "./history-compaction.js";
import { createInboxClassifierProvider } from "./inbox-classifier-factory.js";
import { runInboxTriage } from "./inbox-triage.js";
import { expireMailSearch } from "./mail-tools.js";
import type { MemoryProviderResolver } from "./memory-provider-factory.js";
import { deliverMessagingOutbound, mirrorMessagingOutbound } from "./messaging-delivery.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";
import { expireTaughtSkillTeaching } from "./teaching-session.js";

export function createBackgroundJobHandlers(deps: {
  executor: ReturnType<typeof createRunExecutor>;
  prisma: PrismaClient;
  sandbox: SandboxProvider;
  home: AgentHomeStore;
  jobs: JobPublisher;
  events: ThreadEvents;
  workerId: string;
  runtime: AgentRuntime;
  secretStore: SecretStore;
  memoryProviders: MemoryProviderResolver;
  deploymentModelKey?: string;
  deploymentModelConfigured?: boolean;
  messaging?: MessagingSurface;
  cloudAgent?: CloudAgentConnection | null;
  /** Read-tool caller for the user's Mercury and Brex servers; see `createFinanceCallToolFor`. */
  financeCallToolFor?: FinanceSyncDeps["callToolFor"];
}): BackgroundJobHandlers {
  const deliverMessaging = async (runId?: string) => {
    if (!deps.messaging) return;
    await deliverMessagingOutbound(
      { prisma: deps.prisma, messaging: deps.messaging, events: deps.events, jobs: deps.jobs },
      { runId },
      {
        operationId: `messaging.deliver:${runId ?? "drain"}`,
        traceId: `messaging.deliver:${runId ?? "drain"}`,
        spaceId: "",
        userId: "",
        signal: new AbortController().signal,
      },
    );
  };

  return {
    "run.continue": async (payload) => {
      await deps.executor.continueRun(payload.runId, deps.workerId);
      // Automatic messaging mirror: once the run's bot messages are durable,
      // copy them into the outbox. Never let mirror failures fail the run.
      if (deps.messaging) {
        await mirrorMessagingOutbound(
          { prisma: deps.prisma, messaging: deps.messaging, events: deps.events, jobs: deps.jobs },
          payload.runId,
        );
        await deps.jobs.enqueue(messagingDeliverJob()).catch(async (error) => {
          getLogger().error("messaging.deliver enqueue error", error);
          await deliverMessaging();
        });
      }
    },
    "messaging.deliver": async (payload) => {
      await deliverMessaging(payload.runId);
    },
    "routine.wakeup": async (payload) => {
      await deps.executor.wakeRoutine(payload.routineId, payload.scheduledFor);
    },
    "computer.update": async ({ updateId }) => {
      await performComputerUpdate(deps, updateId);
    },
    "computer.sleep": async (payload) => {
      await sleepComputerIfIdle(deps, payload.computerId);
    },
    "computer.control-expire": async (payload) => {
      if (await expireComputerControl(deps, payload.computerId, payload.leaseId)) {
        scheduleComputerSleep(deps.jobs, payload.computerId);
      }
    },
    "skill.teaching-expire": async (payload) => {
      await expireTaughtSkillTeaching(deps, payload.skillId);
    },
    "mail.search.expire": async (payload) => {
      await expireMailSearch(deps.prisma, payload.searchId);
    },
    "inbox.triage": async (payload) => {
      await runInboxTriage(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          resolveModel: deps.executor.resolveModel,
          classifier: createInboxClassifierProvider(),
        },
        payload,
      );
    },
    "finance.sync": async (payload) => {
      if (!deps.financeCallToolFor) throw new Error("Finance sync is not configured");
      await syncFinanceForUser(
        { prisma: deps.prisma, callToolFor: deps.financeCallToolFor },
        { spaceId: payload.spaceId, userId: payload.userId },
      );
      // Wallets ride the same periodic job; with no wallets this is a no-op.
      await syncCryptoHoldings(
        { prisma: deps.prisma, secrets: deps.secretStore },
        { spaceId: payload.spaceId, userId: payload.userId },
      );
    },
    "cloud_agent.poll": async (payload) => {
      await pollCloudAgent(
        {
          prisma: deps.prisma,
          jobs: deps.jobs,
          events: deps.events,
          cloudAgent: deps.cloudAgent,
        },
        payload,
      );
    },
    "history.compact": async (payload) => {
      // Retrieval policies use stored context without paid message-count compaction.
      // Skip legacy backlog work after a policy change.
      if (deps.executor.contextStrategy && deps.executor.contextStrategy !== "current") return;
      await compactHistory(
        {
          prisma: deps.prisma,
          runtime: deps.runtime,
          jobs: deps.jobs,
          memoryProviders: deps.memoryProviders,
          deploymentModelKey: deps.deploymentModelKey,
          deploymentModelConfigured: deps.deploymentModelConfigured,
          ...(deps.executor.resolveModel ? { resolveModel: deps.executor.resolveModel } : {}),
        },
        payload.threadId,
      );
    },
  };
}
