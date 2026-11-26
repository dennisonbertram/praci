import { createHash, randomBytes } from "node:crypto";
import { grantReference } from "@rakazo/auth";
import type {
  CreateMcpTokenInput,
  McpActivityCall,
  McpConnection,
  McpConnectionList,
  UpdateMcpConnectionInput,
} from "@rakazo/contracts";
import { McpActivityCallSchema } from "@rakazo/contracts";
import type { NotificationEvents, PrismaClient } from "@rakazo/db";
import { IsolationError, notifyNewMcpConnection, requireMembership, runAsSystem } from "@rakazo/db";

export const PAT_PREFIX = "praci_pat_";
/** Random bytes in a token: 256 bits. */
const PAT_BYTES = 32;
/** Characters of the random part kept to tell tokens apart in Settings. */
const PAT_SHOWN = 4;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = PAT_PREFIX + randomBytes(PAT_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, PAT_PREFIX.length + PAT_SHOWN),
  };
}

/** The member may not touch this connection: missing, someone else's, or already revoked. */
export class McpConnectionNotFound extends Error {}
/** The member is not in the Space the token was requested for. */
export class McpSpaceForbidden extends Error {}

type Row = {
  id: string;
  kind: string;
  label: string;
  spaceId: string;
  readOnly: boolean;
  tokenPrefix: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  space: { name: string };
};

const withSpace = { space: { select: { name: true } } } as const;

const dto = (row: Row): McpConnection => ({
  id: row.id,
  kind: row.kind === "pat" ? "pat" : "oauth",
  label: row.label,
  spaceId: row.spaceId,
  spaceName: row.space.name,
  readOnly: row.readOnly,
  tokenPrefix: row.tokenPrefix,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
});

// Connections span the member's Spaces, so these run in the system scope. Every query names
// the caller's userId; nothing here reads or changes another member's connection.
const acrossSpaces = <T>(fn: () => Promise<T>) =>
  runAsSystem("the member's MCP connections across Spaces", fn);

export function listConnections(
  prisma: PrismaClient,
  actor: { userId: string; spaceId: string },
  mcpUrl: string,
): Promise<McpConnectionList> {
  return acrossSpaces(async () => {
    const [rows, memberships] = await Promise.all([
      prisma.mcpConnection.findMany({
        where: { userId: actor.userId, revokedAt: null, space: { deletingAt: null } },
        include: withSpace,
        orderBy: { createdAt: "desc" },
      }),
      prisma.spaceMember.findMany({
        where: { userId: actor.userId, space: { deletingAt: null } },
        select: { space: { select: { id: true, name: true } } },
        orderBy: [{ space: { isDefault: "desc" } }, { createdAt: "asc" }],
      }),
    ]);
    return {
      connections: rows.map(dto),
      spaces: memberships.map(({ space }) => ({ ...space, current: space.id === actor.spaceId })),
      mcpUrl,
    };
  });
}

export async function createToken(
  prisma: PrismaClient,
  actor: { userId: string },
  input: CreateMcpTokenInput,
  events?: NotificationEvents,
) {
  try {
    await requireMembership(prisma, actor.userId, input.spaceId);
  } catch (error) {
    if (error instanceof IsolationError) throw new McpSpaceForbidden();
    throw error;
  }
  const { token, tokenHash, tokenPrefix } = generateToken();
  const row = await acrossSpaces(() =>
    prisma.mcpConnection.create({
      data: {
        userId: actor.userId,
        spaceId: input.spaceId,
        kind: "pat",
        label: input.label,
        tokenHash,
        tokenPrefix,
        readOnly: input.readOnly,
      },
      include: withSpace,
    }),
  );
  await notifyNewMcpConnection(prisma, row, (n) =>
    events
      ? events.notify(
          { spaceId: row.spaceId, userId: row.userId },
          { id: n.id, surface: "mcp", importance: n.importance },
        )
      : Promise.resolve(),
  ).catch(() => undefined);
  return { connection: dto(row), token };
}

const outcomeSchema = McpActivityCallSchema.shape.outcome;

/** The last 20 calls of one of the member's connections. */
export function listActivity(
  prisma: PrismaClient,
  actor: { userId: string },
  id: string,
): Promise<McpActivityCall[]> {
  return acrossSpaces(async () => {
    const owned = await prisma.mcpConnection.findFirst({
      where: { id, userId: actor.userId },
      select: { id: true },
    });
    if (!owned) throw new McpConnectionNotFound();
    const rows = await prisma.mcpCallLog.findMany({
      where: { connectionId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { tool: true, outcome: true, createdAt: true },
    });
    return rows.map((row) => ({
      tool: row.tool,
      outcome: outcomeSchema.safeParse(row.outcome).data ?? "error",
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

const ownLive = (id: string, userId: string) => ({ id, userId, revokedAt: null });

export function updateConnection(
  prisma: PrismaClient,
  actor: { userId: string },
  input: UpdateMcpConnectionInput,
): Promise<McpConnection> {
  return acrossSpaces(async () => {
    const { count } = await prisma.mcpConnection.updateMany({
      where: ownLive(input.id, actor.userId),
      data: {
        ...(input.readOnly === undefined ? {} : { readOnly: input.readOnly }),
        ...(input.label === undefined ? {} : { label: input.label }),
      },
    });
    if (!count) throw new McpConnectionNotFound();
    const row = await prisma.mcpConnection.findFirstOrThrow({
      where: { id: input.id, userId: actor.userId },
      include: withSpace,
    });
    return dto(row);
  });
}

/**
 * Ends a connection. Every MCP call loads its row, so a revoked connection stops on the next
 * call. An OAuth connection also loses its refresh tokens and consent, so the client has to
 * ask the member again instead of renewing itself.
 */
export function revokeConnection(
  prisma: PrismaClient,
  actor: { userId: string },
  id: string,
): Promise<void> {
  return acrossSpaces(async () => {
    const row = await prisma.mcpConnection.findFirst({ where: ownLive(id, actor.userId) });
    if (!row) throw new McpConnectionNotFound();
    await prisma.$transaction(async (tx) => {
      await tx.mcpConnection.update({ where: { id }, data: { revokedAt: new Date() } });
      if (row.kind === "oauth" && row.oauthClientId) {
        // Refresh tokens and consent name the grant, or only the Space when they predate grant
        // ids. An unexchanged code cannot be found by grant; the token endpoint refuses it.
        const grant = {
          userId: row.userId,
          clientId: row.oauthClientId,
          referenceId: {
            in: row.grantId
              ? [grantReference(row.spaceId, row.grantId), row.spaceId]
              : [row.spaceId],
          },
        };
        await tx.oauthRefreshToken.deleteMany({ where: grant });
        await tx.oauthConsent.deleteMany({ where: grant });
      }
    });
  });
}
