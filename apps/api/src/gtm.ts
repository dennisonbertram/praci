import type { AdapterContext, SecretStore } from "@rakazo/adapter-kit";
import type { McpConnector } from "@rakazo/adapters";
import {
  APPROVALS_BEFORE_AUTO,
  AUTO_DAILY_CAP,
  createZernioQueueAdapter,
  parseZernioAccountsListResult,
  resolveZernioApiKey,
} from "@rakazo/adapters";
import type {
  Actor,
  GtmOverview,
  GtmQueueInput,
  GtmQueueOutput,
  ScratchpadChannel,
  ScratchpadItem,
} from "@rakazo/contracts";
import {
  GTM_CHANNELS,
  GTM_WORK_ROUTINE_NAME,
  GtmOverviewSchema,
  GtmQueueOutputSchema,
  gtmAgentSpawnKey,
  isIntegrationAgentForServer,
  isZernioEndpoint,
  ScratchpadItemSchema,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { connectedMailConnections, mailAccountsOf } from "./inbox.js";

type GtmMcp = Pick<McpConnector, "callServerTool">;
export type GtmQueueReader = (input: {
  apiKey: string;
  from: string;
  to: string;
  signal?: AbortSignal;
}) => Promise<GtmQueueOutput>;

export type GtmDeps = {
  prisma: PrismaClient;
  secrets: Pick<SecretStore, "load">;
  mcp?: GtmMcp;
  queueReader?: GtmQueueReader;
};

type ActiveGtmBot = {
  id: string;
  spawnKey: string | null;
};

const queueAdapter = createZernioQueueAdapter();
const gatedCategories = ["public_post", "create_account", "outbound_email"];

async function activeGtmBot(prisma: PrismaClient, actor: Actor): Promise<ActiveGtmBot | null> {
  return prisma.bot.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      spawnKey: gtmAgentSpawnKey(actor.userId),
      archivedAt: null,
    },
    select: { id: true, spawnKey: true },
  });
}

async function linkedZernioServers(prisma: PrismaClient, actor: Actor, bot: ActiveGtmBot) {
  const servers = await prisma.mcpServer.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, enabled: true },
    include: { agentBot: true },
  });
  return servers.filter(
    (server) =>
      server.spaceId === actor.spaceId &&
      server.userId === actor.userId &&
      server.agentBotId === bot.id &&
      isZernioEndpoint(server.endpoint) &&
      server.agentExclusive &&
      !server.writesEnabled &&
      isIntegrationAgentForServer(server, server.agentBot),
  );
}

function adapterContext(actor: Actor, operationId: string, signal?: AbortSignal): AdapterContext {
  const timeout = AbortSignal.timeout(10_000);
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
}

async function readAccounts(
  deps: GtmDeps,
  actor: Actor,
  server: Awaited<ReturnType<typeof linkedZernioServers>>[number],
  signal?: AbortSignal,
) {
  if (!deps.mcp) return null;
  try {
    const result = await deps.mcp.callServerTool(
      server,
      adapterContext(actor, "gtm.overview.accounts_list", signal),
      "accounts_list",
      {},
    );
    return parseZernioAccountsListResult(result);
  } catch {
    return null;
  }
}

async function directoryPolicy(prisma: PrismaClient, actor: Actor, bot: ActiveGtmBot | null) {
  if (!bot) {
    return {
      founderApprovals: 0,
      autoOpenings: 0,
      approvalsBeforeAuto: APPROVALS_BEFORE_AUTO,
      dailyCap: AUTO_DAILY_CAP,
    };
  }
  const now = (await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!
    .now;
  const scope = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    botId: bot.id,
    category: "create_account",
    channel: "directory",
    approvedAt: { gt: new Date(now.getTime() - 86_400_000), lte: now },
  };
  const [founders, autoOpenings] = await Promise.all([
    prisma.scratchpadApproval.findMany({
      where: { ...scope, approvedBy: "user" },
      distinct: ["itemId"],
      select: { itemId: true },
    }),
    prisma.scratchpadApproval.count({
      where: { ...scope, approvedBy: "policy" },
    }),
  ]);
  return {
    founderApprovals: founders.length,
    autoOpenings,
    approvalsBeforeAuto: APPROVALS_BEFORE_AUTO,
    dailyCap: AUTO_DAILY_CAP,
  };
}

function scratchpadItem(row: {
  id: string;
  botId: string;
  title: string;
  status: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  category: string | null;
  channel: string | null;
  target: string | null;
  scheduledFor: Date | null;
  proof: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
}): ScratchpadItem {
  return ScratchpadItemSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    channel: row.channel,
    target: row.target,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    proof: row.proof,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
  });
}

function channelRows(input: {
  bot: ActiveGtmBot | null;
  accounts: Awaited<ReturnType<typeof parseZernioAccountsListResult>>;
  linked: boolean;
  ambiguous: boolean;
  gmailAccounts: ReturnType<typeof mailAccountsOf>;
}) {
  return Object.entries(GTM_CHANNELS).map(([key, config]) => {
    const channel = key as ScratchpadChannel;
    const platform = "platform" in config ? config.platform : null;
    const accounts =
      channel === "email"
        ? []
        : (input.accounts ?? [])
            .filter((account) => account.platform === platform)
            .map((account) => ({
              id: account.id,
              platform: account.platform,
              label: account.label,
            }));
    let status: "connected" | "not_connected" | "unavailable" | "ready" | "draft_only";
    if (config.approval === "draft_only") {
      status = "draft_only";
    } else if (channel === "directory") {
      status = input.bot ? "ready" : "not_connected";
    } else if (channel === "email") {
      status = input.gmailAccounts.length > 0 ? "connected" : "not_connected";
    } else if (!input.bot || !input.linked) {
      status = "not_connected";
    } else if (input.ambiguous || input.accounts === null) {
      status = "unavailable";
    } else {
      status = accounts.length > 0 ? "connected" : "not_connected";
    }
    return { channel, status, accounts };
  });
}

async function postingCapability(
  deps: GtmDeps,
  actor: Actor,
  bot: ActiveGtmBot | null,
  servers: Awaited<ReturnType<typeof linkedZernioServers>>,
) {
  if (!bot || servers.length === 0) return "not_connected" as const;
  if (servers.length !== 1) return "api_key_required" as const;
  const key = await resolveZernioApiKey({
    prisma: deps.prisma,
    secretStore: deps.secrets,
    scope: { spaceId: actor.spaceId, userId: actor.userId, botId: bot.id },
  });
  return key ? ("ready" as const) : ("api_key_required" as const);
}

export async function gtmPostingCapability(
  deps: GtmDeps,
  actor: Actor,
): Promise<"not_connected" | "api_key_required" | "ready"> {
  const bot = await activeGtmBot(deps.prisma, actor);
  if (!bot) return "not_connected";
  return postingCapability(deps, actor, bot, await linkedZernioServers(deps.prisma, actor, bot));
}

export async function gtmOverview(
  deps: GtmDeps,
  actor: Actor,
  signal?: AbortSignal,
): Promise<GtmOverview> {
  const bot = await activeGtmBot(deps.prisma, actor);
  const [rows, routine, connections, servers] = await Promise.all([
    bot
      ? deps.prisma.scratchpadItem.findMany({
          where: { spaceId: actor.spaceId, userId: actor.userId, botId: bot.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
    bot
      ? deps.prisma.routine.findFirst({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            botId: bot.id,
            name: GTM_WORK_ROUTINE_NAME,
            active: true,
            nextRunAt: { not: null },
          },
          orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
          select: { nextRunAt: true },
        })
      : Promise.resolve(null),
    connectedMailConnections(deps.prisma, actor),
    bot ? linkedZernioServers(deps.prisma, actor, bot) : Promise.resolve([]),
  ]);
  const gmailAccounts = mailAccountsOf(connections);
  const server = servers.length === 1 ? servers[0] : null;
  const accounts = server ? await readAccounts(deps, actor, server, signal) : null;
  const items = rows.map(scratchpadItem);
  const goal = items.find((item) => item.category === "goal") ?? null;
  const remaining = goal ? items.filter((item) => item.id !== goal.id) : items;
  const groups = {
    needs_you: remaining.filter(
      (item) =>
        item.status === "parked" &&
        item.approvedAt == null &&
        item.category != null &&
        gatedCategories.includes(item.category),
    ),
    in_progress: remaining.filter(
      (item) =>
        item.status !== "done" &&
        item.category !== "draft" &&
        !(
          item.status === "parked" &&
          item.approvedAt == null &&
          item.category != null &&
          gatedCategories.includes(item.category)
        ),
    ),
    drafts: remaining.filter((item) => item.status !== "done" && item.category === "draft"),
    done: remaining.filter((item) => item.status === "done"),
  };
  return GtmOverviewSchema.parse({
    goal,
    groups,
    counts: {
      needs_you: groups.needs_you.length,
      in_progress: groups.in_progress.length,
      drafts: groups.drafts.length,
      done: groups.done.length,
    },
    channels: channelRows({
      bot,
      accounts,
      linked: servers.length > 0,
      ambiguous: servers.length > 1,
      gmailAccounts,
    }),
    gmailAccounts,
    zernioLinked: servers.length > 0,
    postingCapability: await postingCapability(deps, actor, bot, servers),
    nextRunAt: routine?.nextRunAt?.toISOString() ?? null,
    directoryPolicy: await directoryPolicy(deps.prisma, actor, bot),
  });
}

export async function gtmQueue(
  deps: GtmDeps,
  actor: Actor,
  input: GtmQueueInput,
  signal?: AbortSignal,
): Promise<GtmQueueOutput> {
  const bot = await activeGtmBot(deps.prisma, actor);
  if (!bot) return { status: "not_connected", complete: false, posts: [] };
  const servers = await linkedZernioServers(deps.prisma, actor, bot);
  if (servers.length === 0) return { status: "not_connected", complete: false, posts: [] };
  if (servers.length !== 1) return { status: "unavailable", complete: false, posts: [] };
  const apiKey = await resolveZernioApiKey({
    prisma: deps.prisma,
    secretStore: deps.secrets,
    scope: { spaceId: actor.spaceId, userId: actor.userId, botId: bot.id },
  });
  if (!apiKey) return { status: "api_key_required", complete: false, posts: [] };
  try {
    const result = await (deps.queueReader ?? queueAdapter.listPosts)({
      apiKey,
      from: input.from,
      to: input.to,
      signal,
    });
    const parsed = GtmQueueOutputSchema.safeParse(result);
    return parsed.success ? parsed.data : { status: "unavailable", complete: false, posts: [] };
  } catch {
    return { status: "unavailable", complete: false, posts: [] };
  }
}

export async function gtmNeedsYouCount(prisma: PrismaClient, actor: Actor) {
  const bot = await activeGtmBot(prisma, actor);
  if (!bot) return 0;
  return prisma.scratchpadItem.count({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      botId: bot.id,
      status: "parked",
      category: { in: gatedCategories },
      approvedAt: null,
    },
  });
}
