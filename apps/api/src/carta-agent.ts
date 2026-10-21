import type { Actor, Bot, MessageBlock } from "@rakazo/contracts";
import {
  actorScope,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
  isCartaEndpoint,
  pageAgentColor,
} from "@rakazo/contracts";
import { ACTIVE_RUN_STATUSES } from "@rakazo/core";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { appendEventInTransaction, createThreadMessageInTransaction } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

const CARTA_AGENT_INSTRUCTIONS =
  "You are the user's Carta agent. You manage their company's cap table and investor relationships from Carta, which you read; you change Carta only with the write tools if the user turned them on, and each of those asks first. cap_table_read and contacts_list give what the Cap Table page already shows: answer cap table and investor questions from them first, and use Carta for anything newer or missing. Keep the Cap Table page current with cap_table_update, using exact Carta figures and null for anything Carta does not give you. Add new investors and auditors with contacts_add; contacts_save changes an existing contact. Other bots may message you about the cap table or investors; answer them from Carta. Draft investor updates and answer investor audit requests with the Gmail and Drive tools and the skills carta-investor-update and carta-audit-response; the finance_* tools give cash, burn and runway for updates. When the user asks for a change in Carta (an option grant, a new holder, a transfer) and you have no write tools, say that changes in Carta are off and that they can turn them on with the 'Allow changes in Carta' switch under Integrations, Carta; until then, tell them what to do in Carta. Never invent a figure: write TBD where you do not have one. Never sign anything in DocuSign and never confirm anything in an investor portal; tell the user what needs their signature. Send email only with the full to, cc, bcc, subject and body in the send call, after the user approves that exact message; every message needs its own approval.";

const CARTA_SYNC_PROMPT =
  "Fill in the Cap Table page from Carta. Read the company's cap table from Carta: use discover or search_tools to find the right fetch and read_tool commands, and set_context or list_accounts to pick the company. As soon as you have read the cap table, make cap_table_update your very next tool call, before any other tool, because older tool results are shortened after your next call; use the exact figures from Carta, never estimate, and leave a field null when Carta does not give it. Next, call contacts_list, and add every investor holder who is not already a contact with contacts_add (kind investor, organization is the fund). Do not search mail or read anything else: the user only asked to refresh the page. The Cap Table page already shows the figures and contacts, so finish with one short sentence and no figures, lists or headings: that the cap table is up to date and who you added as a contact, or what you could not read. Do not mention charts you cannot show.";

/**
 * Gives the bot each of the user's enabled Carta MCP servers: the read tools, plus the write tools
 * when the server's writes are on. The list is written on every call, so an older or wider list is
 * corrected without removing assignments belonging to other bots.
 */
async function assignCartaServers(
  prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer" | "$transaction">,
  actor: Actor,
  botId: string | null,
): Promise<void> {
  if (!botId) return;
  await prisma.$transaction(async (tx) => {
    const activeBot = await tx.bot.updateMany({
      where: {
        id: botId,
        ...actorScope(actor),
        spawnKey: cartaAgentSpawnKey(actor.userId),
        archivedAt: null,
      },
      data: { updatedAt: new Date() },
    });
    if (!activeBot.count) return;
    const servers = (
      await tx.mcpServer.findMany({
        where: { ...actorScope(actor) },
        select: {
          id: true,
          endpoint: true,
          enabled: true,
          writesEnabled: true,
          agentBotId: true,
        },
      })
    ).filter((server) => isCartaEndpoint(server.endpoint));
    for (const server of servers) {
      const newLink = server.agentBotId !== botId;
      const linked = await tx.mcpServer.updateMany({
        where: {
          id: server.id,
          ...actorScope(actor),
          endpoint: server.endpoint,
          enabled: server.enabled,
          writesEnabled: server.writesEnabled,
          agentBotId: server.agentBotId,
        },
        data: {
          agentBotId: botId,
          ...(newLink ? { agentExclusive: true, writesEnabled: false } : {}),
          updatedAt: new Date(),
        },
      });
      if (!linked.count || !server.enabled) continue;
      const allowedTools = [
        ...CARTA_READ_TOOLS,
        ...(!newLink && server.writesEnabled ? CARTA_WRITE_TOOLS : []),
      ];
      await tx.botMcpServer.upsert({
        where: { botId_serverId: { botId, serverId: server.id } },
        create: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          botId,
          serverId: server.id,
          allowAllTools: false,
          allowedTools,
        },
        update: { allowAllTools: false, allowedTools },
      });
    }
  });
}

/** Matches the user's live Carta agent, found by its spawn key. */
const cartaAgentWhere = (actor: Actor) => ({
  ...actorScope(actor),
  spawnKey: cartaAgentSpawnKey(actor.userId),
  archivedAt: null,
});

/** Gives the Carta servers to the user's Carta agent without changing other bots' assignments. */
export async function assignToExistingCartaAgent(
  prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer" | "$transaction">,
  actor: Actor,
): Promise<void> {
  const bot = await prisma.bot.findFirst({ where: cartaAgentWhere(actor), select: { id: true } });
  await assignCartaServers(prisma, actor, bot?.id ?? null);
}

/** The only way a Carta agent is created; idempotent through the unique (spaceId, spawnKey) index. */
export async function ensureCartaAgent(
  deps: {
    prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer" | "$transaction">;
    repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  },
  actor: Actor,
): Promise<Bot> {
  const bot = await deps.repos.createBot(actor, {
    spawnKey: cartaAgentSpawnKey(actor.userId),
    name: "Carta agent",
    title: "",
    description: "Keeps your cap table and investor contacts, and drafts investor updates.",
    instructions: CARTA_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
    color: pageAgentColor("carta"),
  });
  await assignCartaServers(deps.prisma, actor, bot.id);
  return bot;
}

/** Matches the user's populate runs: the Carta agent's runs that no routine and no typed message started. */
const syncRunWhere = (actor: Actor, botId?: string) => ({
  ...actorScope(actor),
  ...(botId ? { botId } : { bot: { spawnKey: cartaAgentSpawnKey(actor.userId) } }),
  trigger: "routine",
  routineId: null,
});

/** Whether a populate run is queued or running for this user. */
export async function isCartaSyncing(
  prisma: Pick<PrismaClient, "run">,
  actor: Actor,
): Promise<boolean> {
  return Boolean(
    await prisma.run.findFirst({
      where: { ...syncRunWhere(actor), status: { in: [...ACTIVE_RUN_STATUSES] } },
      select: { id: true },
    }),
  );
}

export type CartaSyncDeps = {
  prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer" | "run" | "$transaction">;
  repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  /** False when no model is set up, so a run would only fail. */
  hasModel: (actor: Actor) => Promise<boolean>;
  enqueueRun: (runId: string) => Promise<void>;
};

/**
 * Makes sure the Carta agent exists and starts one run that fills in the Cap Table page and the
 * investor contacts, unless one is already going.
 *
 * The run uses the "routine" trigger: it is the only trigger besides a typed message that offers the
 * mail, contacts and finance tools (the user owns this run), and it needs no typed message from the
 * user. Its reply is the summary the user reads in the Carta agent's chat, below a line that says
 * why it ran, so the reply never reads as an unprompted message.
 */
export async function startCartaSync(
  deps: CartaSyncDeps,
  actor: Actor,
  reason: "refresh" | "connected" = "refresh",
): Promise<"started" | "running" | "no_model"> {
  const bot = await ensureCartaAgent(deps, actor);
  if (!(await deps.hasModel(actor))) return "no_model";
  const runId = await deps.prisma.$transaction(async (tx) => {
    // One populate run at a time per user, even for two requests at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('carta-sync'), hashtext(${actor.userId}))`;
    const active = await tx.run.findFirst({
      where: { ...syncRunWhere(actor, bot.id), status: { in: [...ACTIVE_RUN_STATUSES] } },
      select: { id: true },
    });
    if (active) return null;
    const blocks: MessageBlock[] = [
      {
        kind: "meta",
        text:
          reason === "connected"
            ? "Carta is connected, so the Carta agent is reading your cap table"
            : "You asked to refresh the cap table from Carta",
      },
    ];
    const message = await createThreadMessageInTransaction(tx, {
      threadId: bot.threadId,
      role: "system",
      blocks,
      botId: bot.id,
    });
    await appendEventInTransaction(tx, {
      spaceId: actor.spaceId,
      threadId: bot.threadId,
      botId: bot.id,
      type: "thread.message.created",
      payload: { messageId: message.id, role: "system", blocks },
    });
    const task = await tx.task.create({
      data: {
        ...actorScope(actor),
        botId: bot.id,
        threadId: bot.threadId,
        prompt: CARTA_SYNC_PROMPT,
        status: "queued",
      },
    });
    const run = await tx.run.create({
      data: {
        ...actorScope(actor),
        botId: bot.id,
        threadId: bot.threadId,
        taskId: task.id,
        status: "queued",
        trigger: "routine",
      },
      select: { id: true },
    });
    return run.id;
  });
  if (!runId) return "running";
  await deps.enqueueRun(runId);
  return "started";
}

/**
 * Called when a server finishes OAuth. For a Carta server, starts the first populate run.
 * Never throws: the sign-in already succeeded and the user can refresh from the Cap Table page.
 */
export async function onMcpServerConnected(
  deps: CartaSyncDeps,
  actor: Actor,
  serverId: string,
): Promise<void> {
  try {
    const server = await deps.prisma.mcpServer.findFirst({
      where: { id: serverId, ...actorScope(actor) },
      select: { endpoint: true },
    });
    if (isCartaEndpoint(server?.endpoint)) await startCartaSync(deps, actor, "connected");
  } catch (error) {
    getLogger().error("carta sync kickoff", error);
  }
}
