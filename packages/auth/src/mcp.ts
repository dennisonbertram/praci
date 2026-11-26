import { createHash } from "node:crypto";
import { mcp, requireMcpAuth } from "@better-auth/mcp";
import { getOAuthProviderState } from "@better-auth/oauth-provider";
import type { PrismaClient } from "@rakazo/db";
import { isUniqueViolation, notifyNewMcpConnection } from "@rakazo/db";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { stripAccessTokenAuthorizationScheme } from "better-auth/oauth2";
import { jwt } from "better-auth/plugins";

export const MCP_SCOPES = ["offline_access", "mcp:read", "mcp:write"] as const;
export const MCP_ACCESS_TOKEN_SECONDS = 10 * 60;
export const MCP_REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
/** The Space a member picks only has to survive until the same page approves the client. */
const PICK_SECONDS = 60;

export interface McpAuthEnv {
  /** Public base URL of the API: the OAuth issuer and the host of the token endpoint. */
  issuer: string;
  /** Canonical MCP resource URL; access tokens are bound to it. */
  resource: string;
  /** Web origin: the member's browser signs in, picks a Space and approves here. */
  webOrigin: string;
  /** Tells the member's open app about the "new connection" notice once it is stored. */
  onNotice?: (
    owner: { spaceId: string; userId: string },
    notice: { id: string; importance: "info" | "attention" },
  ) => Promise<void>;
}

/** A pick belongs to one session and one client, so a client cannot use another's. */
export const pickKey = (sessionId: string, clientId: string) =>
  `mcp-space-${sessionId}-${clientId}`;

const clientOf = (oauthQuery: unknown) =>
  new URLSearchParams(String(oauthQuery ?? "")).get("client_id") ?? undefined;

/** The client of the signed authorize query this request carries, if it carries one. */
async function requestClient() {
  const state = await getOAuthProviderState();
  return state?.query ? clientOf(state.query) : undefined;
}

export async function pickedSpace(
  prisma: PrismaClient,
  sessionId: string,
  clientId: string | undefined,
  now = new Date(),
) {
  if (!clientId) return undefined;
  const row = await prisma.verification.findFirst({
    where: { identifier: pickKey(sessionId, clientId), expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  return row?.value;
}

/**
 * The consent reference of a grant: its Space, then its id. Better Auth copies the reference into
 * authorization codes and refresh tokens, so every token names the grant it was issued for.
 */
export const grantReference = (spaceId: string, grantId: string) => `${spaceId}:${grantId}`;

export function parseGrantReference(referenceId: string | undefined) {
  const at = referenceId?.lastIndexOf(":") ?? -1;
  if (!referenceId || at < 1 || at === referenceId.length - 1) return undefined;
  return { spaceId: referenceId.slice(0, at), grantId: referenceId.slice(at + 1) };
}

/** The member's live grant for this client and Space; a unique index allows at most one. */
const liveGrant = (prisma: PrismaClient, userId: string, spaceId: string, clientId: string) =>
  prisma.mcpConnection.findFirst({
    where: { userId, spaceId, oauthClientId: clientId, kind: "oauth", revokedAt: null },
  });

/**
 * How Better Auth stores codes and refresh tokens: its default SHA-256 hash, set here so the
 * hooks below can find a refresh token by the same value. Existing rows keep matching.
 */
const storedToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Whether the grant a code or refresh token names is live for this member and client. */
async function isLiveGrant(
  prisma: PrismaClient,
  referenceId: string | null | undefined,
  userId: string | undefined,
  clientId: string | undefined,
) {
  // A reference from before grants had ids names no grant.
  const grant = parseGrantReference(referenceId ?? undefined);
  if (!grant || !userId || !clientId) return false;
  const live = await prisma.mcpConnection.findFirst({
    where: { ...grant, userId, oauthClientId: clientId, kind: "oauth", revokedAt: null },
    select: { id: true },
  });
  return live !== null;
}

/**
 * Better Auth treats a rotated refresh token presented again, at the token or the revocation
 * endpoint, as theft and deletes every refresh token of the member and client, across Spaces.
 * So before it sees a refresh token whose grant is no longer live, the grant's refresh tokens
 * are deleted, and Better Auth answers as it does for any unknown token. The stored row decides,
 * never the request's grant_type or client_id.
 */
async function forgetDeadRefreshToken(prisma: PrismaClient, token: string) {
  const row = await prisma.oauthRefreshToken.findUnique({
    where: { token: storedToken(token) },
    select: { referenceId: true, userId: true, clientId: true },
  });
  if (!row || (await isLiveGrant(prisma, row.referenceId, row.userId, row.clientId))) return;
  await prisma.oauthRefreshToken.deleteMany({
    where: { userId: row.userId, clientId: row.clientId, referenceId: row.referenceId },
  });
}

async function requireSpaceMember(prisma: PrismaClient, userId: string, spaceId: string) {
  const member = await prisma.spaceMember.findFirst({ where: { userId, spaceId } });
  if (!member) throw new APIError("FORBIDDEN", { message: "No access to this space" });
}

/**
 * The Space a client connects to is chosen on the approval page and stored for the session.
 * Approving records the member's grant for that client and Space in `mcp_connections` before
 * Better Auth asks for the consent reference, which then names the Space and that grant.
 */
function mcpSpace(prisma: PrismaClient, env: McpAuthEnv): BetterAuthPlugin {
  return {
    id: "mcp-space",
    endpoints: {
      mcpSpaces: createAuthEndpoint(
        "/mcp/spaces",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const memberships = await prisma.spaceMember.findMany({
            where: { userId: ctx.context.session.user.id, space: { deletingAt: null } },
            select: { space: { select: { id: true, name: true } } },
            orderBy: [{ space: { isDefault: "desc" } }, { createdAt: "asc" }],
          });
          return ctx.json({ spaces: memberships.map((m) => m.space) });
        },
      ),
      mcpPickSpace: createAuthEndpoint(
        "/mcp/space",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const spaceId = (ctx.body as { spaceId?: unknown } | null)?.spaceId;
          if (typeof spaceId !== "string") throw new APIError("BAD_REQUEST");
          const clientId = clientOf((ctx.body as { oauth_query?: unknown }).oauth_query);
          if (!clientId) throw new APIError("BAD_REQUEST", { message: "Missing client" });
          const { session, user } = ctx.context.session;
          await requireSpaceMember(prisma, user.id, spaceId);
          const identifier = pickKey(session.id, clientId);
          await prisma.verification.deleteMany({ where: { identifier } });
          await prisma.verification.create({
            data: {
              id: crypto.randomUUID(),
              identifier,
              value: spaceId,
              expiresAt: new Date(Date.now() + PICK_SECONDS * 1000),
            },
          });
          return ctx.json({ ok: true });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/consent" && ctx.body?.accept === true,
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session) throw new APIError("UNAUTHORIZED");
            const clientId = clientOf(ctx.body?.oauth_query);
            if (!clientId) throw new APIError("BAD_REQUEST", { message: "Missing client" });
            const spaceId = await pickedSpace(prisma, session.session.id, clientId);
            if (!spaceId) throw new APIError("BAD_REQUEST", { message: "Choose a space" });
            await requireSpaceMember(prisma, session.user.id, spaceId);
            const existing = await liveGrant(prisma, session.user.id, spaceId, clientId);
            if (existing) {
              // A row an older API process wrote during a deploy has no grant id yet.
              if (!existing.grantId) {
                await prisma.mcpConnection.updateMany({
                  where: { id: existing.id, grantId: null },
                  data: { grantId: crypto.randomUUID() },
                });
              }
              return;
            }
            const client = await prisma.oauthClient.findUnique({
              where: { clientId },
              select: { name: true },
            });
            const created = await prisma.mcpConnection
              .create({
                data: {
                  userId: session.user.id,
                  spaceId,
                  kind: "oauth",
                  oauthClientId: clientId,
                  grantId: crypto.randomUUID(),
                  clientName: client?.name ?? null,
                  label: client?.name ?? "MCP client",
                },
              })
              .catch((error: unknown) => {
                // A concurrent approval of the same client and Space recorded the grant first.
                if (isUniqueViolation(error)) return undefined;
                throw error;
              });
            // A failed notice must not block the approval.
            if (created) {
              await notifyNewMcpConnection(
                prisma,
                created,
                (notice) =>
                  env.onNotice?.({ spaceId: created.spaceId, userId: created.userId }, notice) ??
                  Promise.resolve(),
              ).catch(() => undefined);
            }
          }),
        },
        {
          matcher: (ctx) =>
            ctx.path === "/oauth2/token" && typeof ctx.body?.refresh_token === "string",
          handler: createAuthMiddleware(async (ctx) => {
            await forgetDeadRefreshToken(prisma, ctx.body.refresh_token);
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/oauth2/revoke" && typeof ctx.body?.token === "string",
          handler: createAuthMiddleware(async (ctx) => {
            // Better Auth accepts the token with an authorization scheme in front of it.
            await forgetDeadRefreshToken(
              prisma,
              stripAccessTokenAuthorizationScheme(ctx.body.token),
            );
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/oauth2/consent",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            const clientId = clientOf(ctx.body?.oauth_query);
            if (session && clientId) {
              await prisma.verification.deleteMany({
                where: { identifier: pickKey(session.session.id, clientId) },
              });
            }
          }),
        },
      ],
    },
  };
}

/** The OAuth server for MCP clients: JWT access tokens bound to `resource`, one Space per grant. */
export function mcpPlugins(prisma: PrismaClient, env: McpAuthEnv): BetterAuthPlugin[] {
  const page = new URL("/oauth/consent", env.webOrigin).href;
  return [
    jwt({ jwt: { issuer: env.issuer } }),
    mcp({
      resource: env.resource,
      loginPage: new URL("/sign-in", env.webOrigin).href,
      consentPage: page,
      scopes: [...MCP_SCOPES],
      grantTypes: ["authorization_code", "refresh_token"],
      accessTokenExpiresIn: MCP_ACCESS_TOKEN_SECONDS,
      refreshTokenExpiresIn: MCP_REFRESH_TOKEN_SECONDS,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
      storeTokens: { hash: storedToken },
      postLogin: {
        page,
        // A fresh authorize request carries no client state yet, so it always shows the page.
        shouldRedirect: async ({ session }) =>
          !(await pickedSpace(prisma, session.id, await requestClient())),
        // On approval the consent hook above has recorded the grant before this runs, and the
        // same request asks again when it issues the code, so both calls name the one live grant.
        consentReferenceId: async ({ session }) => {
          const clientId = await requestClient();
          const spaceId = await pickedSpace(prisma, session.id, clientId);
          if (!spaceId || !clientId)
            throw new APIError("BAD_REQUEST", { message: "Choose a space" });
          const grant = await liveGrant(prisma, session.userId, spaceId, clientId);
          // Not approved yet: no consent matches an empty reference, so the approval page shows.
          return grant?.grantId ? grantReference(spaceId, grant.grantId) : undefined;
        },
      },
      // Runs on a code exchange before Better Auth creates any token, JWT or opaque. Refresh
      // tokens are handled by the hooks in `mcpSpace`, which run before Better Auth reads them.
      customTokenResponseFields: async ({ grantType, user, verificationValue }) => {
        const code = grantType === "authorization_code" && verificationValue;
        if (
          code &&
          !(await isLiveGrant(prisma, code.referenceId, user?.id, code.query.client_id))
        ) {
          throw new APIError("BAD_REQUEST", {
            error: "invalid_grant",
            error_description: "This connection was revoked; authorize this client again",
          });
        }
        return {};
      },
      customAccessTokenClaims: ({ referenceId }) => {
        const grant = parseGrantReference(referenceId);
        // Codes and refresh tokens were checked above, so every reference here names a grant.
        if (!grant) {
          throw new APIError("BAD_REQUEST", {
            error: "invalid_grant",
            error_description: "Authorize this client again",
          });
        }
        return { space_id: grant.spaceId, grant_id: grant.grantId };
      },
    }),
    mcpSpace(prisma, env),
  ];
}

export { requireMcpAuth };
