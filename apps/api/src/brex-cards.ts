import { ORPCError } from "@orpc/server";
import type { SecretStore } from "@rakazo/adapter-kit";
import type { McpConnector } from "@rakazo/adapters";
import { buildMcpCredentialBlob, persistPreparedSecret } from "@rakazo/adapters";
import type { Actor, Bot, BrexCardsControls, BrexCardsList } from "@rakazo/contracts";
import {
  actorScope,
  BREX_AGENT_MODEL,
  BREX_CARDS_MCP_ENDPOINT,
  BREX_TOKEN_REJECTED,
  BrexCardsControlsSchema,
  integrationAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { isUniqueViolation } from "@rakazo/db";
import * as z from "zod";

export interface BrexCardsDeps {
  prisma: PrismaClient;
  secrets: SecretStore;
  mcp: Pick<McpConnector, "callServerTool">;
  /** Where Brex is reached; the demo and tests point it at an emulator. */
  brexApi?: { baseUrl?: string; fetch?: typeof fetch };
  /** The integration agent of the server: the owner's Brex finance agent, or a new "Brex agent". */
  provisionAgent: (actor: Actor, serverId: string) => Promise<Bot>;
  archiveBot: (actor: Actor, botId: string) => Promise<void>;
  /** Injectable clock for period calculations; tests use a fixed instant. */
  now?: () => Date;
}

const REJECTED = "Brex rejected this token";
const MISSING_PERMISSION =
  "Brex refused this token. It may be missing a permission or have expired.";
const UNREACHABLE = "Could not reach Brex";
const CONFLICT_MESSAGE = "Brex cards are already connected in this space";
const NOT_CONNECTED_MESSAGE = "Brex cards are not connected in this space";
const CONNECTED_BY_OTHER_MESSAGE =
  "Brex cards were connected by someone else. Disconnect and connect again.";
const OTHER_ACCOUNT_MESSAGE =
  "This token is for a different Brex account. Disconnect Brex cards and connect again.";

/**
 * Checks the token with the three reads the server itself relies on, before anything is stored,
 * and returns the Brex company id. Only the two messages above ever leave this function: nothing
 * Brex or the network says is passed on, so the token cannot leak through an error.
 */
async function checkToken(deps: BrexCardsDeps, token: string): Promise<string> {
  const base = (deps.brexApi?.baseUrl ?? "https://api.brex.com").replace(/\/$/, "");
  const doFetch = deps.brexApi?.fetch ?? fetch;
  const unreachable = () => new ORPCError("BAD_GATEWAY", { message: UNREACHABLE });
  const get = async (path: string): Promise<Response> => {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        headers: {
          authorization: `Bearer ${token.replace(/^Bearer /, "")}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw unreachable();
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 401) throw new ORPCError("BAD_REQUEST", { message: REJECTED });
      if (res.status === 403) throw new ORPCError("BAD_REQUEST", { message: MISSING_PERMISSION });
      throw unreachable();
    }
    return res;
  };
  for (const path of ["/v2/users/me", "/v2/cards?limit=1"])
    await (await get(path)).body?.cancel().catch(() => undefined);
  const company = z
    .object({ id: z.string().min(1) })
    .safeParse(await (await get("/v2/company")).json().catch(() => null));
  if (!company.success) throw unreachable();
  return company.data.id;
}

/**
 * What a failed Brex tool call becomes. The server starts its text with BREX_TOKEN_REJECTED when
 * Brex answered 401 or 403, so the page can offer "Replace token"; anything else is a plain outage.
 */
export const toolFailure = (text: string) =>
  text.startsWith(`${BREX_TOKEN_REJECTED}:`)
    ? new ORPCError(BREX_TOKEN_REJECTED, { status: 502, message: REJECTED })
    : new ORPCError("BAD_GATEWAY", { message: text.slice(0, 300) });

const secretContext = (operationId: string, scope: { spaceId: string; userId: string }) =>
  ({
    operationId,
    traceId: operationId,
    ...scope,
    botId: "mcp",
    signal: new AbortController().signal,
  }) as never;

export const connectionOf = async (deps: BrexCardsDeps, actor: Actor) => {
  const connection = await deps.prisma.brexCardsConnection.findUnique({
    where: { spaceId: actor.spaceId },
    include: { server: true },
  });
  if (!connection) throw new ORPCError("NOT_FOUND", { message: NOT_CONNECTED_MESSAGE });
  // After a change of space owner the token and its secret still belong to the person who
  // connected them: the new owner disconnects and connects again instead of using them.
  if (connection.server.userId !== actor.userId)
    throw new ORPCError("PRECONDITION_FAILED", { message: CONNECTED_BY_OTHER_MESSAGE });
  return connection;
};

/**
 * Removes what a failed connect left: the server (its cascade removes the state row), the secret
 * and the agent that was made for this server. The owner's finance agent is shared, so only an
 * agent whose spawn key names this server is archived.
 */
async function removeConnection(
  deps: BrexCardsDeps,
  actor: Actor,
  serverId: string,
  secretId: string,
): Promise<void> {
  const scope = actorScope(actor);
  const own = await deps.prisma.bot.findFirst({
    where: { ...scope, spawnKey: integrationAgentSpawnKey(serverId), archivedAt: null },
    select: { id: true },
  });
  await deps.prisma.$transaction(async (tx) => {
    await tx.mcpServer.deleteMany({ where: { id: serverId, ...scope } });
    await tx.secret.deleteMany({ where: { id: secretId, ...scope } });
  });
  if (own) await deps.archiveBot(actor, own.id);
}

/**
 * Connects the space: the token is checked first, then the encrypted secret, the exclusive
 * read-only server and the state row are stored in one transaction, then the agent is attached.
 * A failure after the transaction removes all of it. The unique space id on the state row decides
 * a race between two owners.
 */
export async function brexCardsConnect(
  deps: BrexCardsDeps,
  actor: Actor,
  token: string,
): Promise<{ serverId: string; agentBotId: string }> {
  if (await deps.prisma.brexCardsConnection.findUnique({ where: { spaceId: actor.spaceId } }))
    throw new ORPCError("CONFLICT", { message: CONFLICT_MESSAGE });
  const brexAccountId = await checkToken(deps, token);

  const scope = actorScope(actor);
  const stored = await deps.secrets.put(
    buildMcpCredentialBlob({ secret: token }) as string,
    secretContext("brex-cards.connect", scope),
  );
  // The stored secret may live in a remote vault: a failed transaction must not leave it there.
  const server = await persistPreparedSecret(deps.prisma, deps.secrets, stored, () =>
    deps.prisma
      .$transaction(async (tx) => {
        await tx.secret.create({
          data: { id: stored.id, ...scope, kind: "mcp", ciphertext: stored.ciphertext },
        });
        const row = await tx.mcpServer.create({
          data: {
            ...scope,
            slug: "brex-cards",
            name: "Brex cards",
            description: "",
            transport: "streamable_http",
            endpoint: BREX_CARDS_MCP_ENDPOINT,
            secretId: stored.id,
            enabled: true,
            agentExclusive: true,
            writesEnabled: false,
          },
        });
        await tx.brexCardsConnection.create({
          data: {
            serverId: row.id,
            spaceId: actor.spaceId,
            createdByUserId: actor.userId,
            brexAccountId,
          },
        });
        return row;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error))
          throw new ORPCError("CONFLICT", { message: CONFLICT_MESSAGE });
        throw error;
      }),
  );

  try {
    const bot = await deps.provisionAgent(actor, server.id);
    // A model the user chose stays; only an empty one gets the stronger default.
    await deps.prisma.bot.updateMany({
      where: { id: bot.id, ...scope, modelId: null, archivedAt: null },
      data: {
        modelProvider: BREX_AGENT_MODEL.provider,
        modelId: BREX_AGENT_MODEL.id,
        thinkingLevel: BREX_AGENT_MODEL.thinkingLevel,
      },
    });
    return { serverId: server.id, agentBotId: bot.id };
  } catch (error) {
    await removeConnection(deps, actor, server.id, stored.id).catch(() => undefined);
    throw error;
  }
}

/**
 * Replaces the token. The new one is checked first, so a refused token changes nothing. The swap
 * and the revision bump are one transaction: the bump makes a pending approval stale and the
 * connector's session cache connects again with the new token. Controls and the model stay.
 */
export async function brexCardsReplaceToken(
  deps: BrexCardsDeps,
  actor: Actor,
  token: string,
): Promise<void> {
  const connection = await connectionOf(deps, actor);
  const brexAccountId = await checkToken(deps, token);
  // The daily card cap counts per Brex company and an in-flight create holds the old token, so a
  // token may not move the connection to another company.
  if (brexAccountId !== connection.brexAccountId)
    throw new ORPCError("BAD_REQUEST", { message: OTHER_ACCOUNT_MESSAGE });
  const scope = actorScope(actor);
  const stored = await deps.secrets.put(
    buildMcpCredentialBlob({ secret: token }) as string,
    secretContext("brex-cards.replace", scope),
  );
  // The stored secret may live in a remote vault: a failed transaction must not leave it there.
  await persistPreparedSecret(deps.prisma, deps.secrets, stored, () =>
    deps.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM mcp_servers WHERE id = ${connection.serverId} FOR UPDATE`;
      const current = await tx.mcpServer.findFirst({
        where: { id: connection.serverId, ...scope },
        select: { secretId: true },
      });
      if (!current) throw new ORPCError("NOT_FOUND", { message: NOT_CONNECTED_MESSAGE });
      const oldSecretId = current.secretId;
      await tx.secret.create({
        data: { id: stored.id, ...scope, kind: "mcp", ciphertext: stored.ciphertext },
      });
      await tx.mcpServer.update({
        where: { id: connection.serverId },
        data: { secretId: stored.id, revision: { increment: 1 } },
      });
      if (oldSecretId) await tx.secret.deleteMany({ where: { id: oldSecretId, ...scope } });
    }),
  );
}

const ListedCards = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullish(),
      lastFour: z.string(),
      status: z.string().nullish(),
      ownerUserId: z.string().nullish(),
      limitCents: z.number().int().nullish(),
      currency: z.string().nullish(),
      duration: z.string().nullish(),
    }),
  ),
});

/** The cards, read through the server's `list_cards` tool: the only tool this page calls. */
export async function brexCardsCards(deps: BrexCardsDeps, actor: Actor): Promise<BrexCardsList> {
  const { server } = await connectionOf(deps, actor);
  const result = await deps.mcp
    .callServerTool(
      server,
      {
        operationId: `brex-cards:${server.id}`,
        traceId: `brex-cards:${server.id}`,
        spaceId: server.spaceId,
        userId: server.userId,
        signal: AbortSignal.timeout(30_000),
      },
      "list_cards",
      {},
    )
    .catch((error: unknown) => {
      throw new ORPCError("BAD_GATEWAY", {
        message: (error instanceof Error ? error.message : UNREACHABLE).slice(0, 300),
      });
    });
  const text = result.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
  if (result.isError) throw toolFailure(text);
  let parsed: z.infer<typeof ListedCards>;
  try {
    parsed = ListedCards.parse(JSON.parse(text));
  } catch {
    throw new ORPCError("BAD_GATEWAY", { message: "Brex sent a card list that could not be read" });
  }
  return {
    serverId: server.id,
    agentBotId: server.agentBotId,
    writesEnabled: server.writesEnabled,
    cards: parsed.cards.map((card) => ({
      cardId: card.id,
      name: card.name ?? "",
      lastFour: card.lastFour,
      ownerUserId: card.ownerUserId ?? null,
      status: card.status ?? "UNKNOWN",
      limitCents: card.limitCents ?? null,
      currency: card.currency ?? null,
      duration: card.duration ?? null,
    })),
  };
}

export async function brexCardsGetControls(
  deps: BrexCardsDeps,
  actor: Actor,
): Promise<BrexCardsControls> {
  const row = await connectionOf(deps, actor);
  return BrexCardsControlsSchema.parse({
    maxNewCardLimitCents: row.maxNewCardLimitCents,
    maxCardLimitCents: row.maxCardLimitCents,
    maxSpendLimitBaseCents: row.maxSpendLimitBaseCents,
    maxCardsPerDay: row.maxCardsPerDay,
    allowedDurations: row.allowedDurations,
    oneTimeMaxDays: row.oneTimeMaxDays,
  });
}

export async function brexCardsSetControls(
  deps: BrexCardsDeps,
  actor: Actor,
  controls: BrexCardsControls,
): Promise<BrexCardsControls> {
  const parsed = BrexCardsControlsSchema.safeParse(controls);
  if (!parsed.success)
    throw new ORPCError("BAD_REQUEST", {
      message: parsed.error.issues[0]?.message ?? "Invalid controls",
    });
  const { serverId } = await connectionOf(deps, actor);
  await deps.prisma.brexCardsConnection.update({
    where: { serverId, spaceId: actor.spaceId },
    data: parsed.data,
  });
  return parsed.data;
}
