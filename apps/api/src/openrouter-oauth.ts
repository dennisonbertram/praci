import { createHash, randomBytes } from "node:crypto";
import type { SecretStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";

export const OPENROUTER_OAUTH_PROVIDER = "openrouter";
export const OPENROUTER_CALLBACK_PATH = "/models/openrouter/callback";
const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const STATE_TTL_MS = 10 * 60_000;
const MAX_PENDING_PER_USER = 5;

type Scope = { userId: string; spaceId: string };
type Db = Pick<PrismaClient, "modelOAuthState">;

/** The one error the client sees for any refused or failed attempt; it names no cause. */
export class OpenRouterOAuthError extends Error {
  constructor() {
    super("OpenRouter sign-in failed. Try again.");
  }
}

const recordContext = (scope: Scope) => ({
  operationId: "model.oauth.state",
  traceId: "model.oauth.state",
  spaceId: scope.spaceId,
  userId: scope.userId,
  botId: "models",
  signal: new AbortController().signal,
});

/** Start a sign-in: store the encrypted PKCE verifier under a random single-use state. */
export async function beginOpenRouterOAuth(options: {
  prisma: Db;
  secrets: SecretStore;
  scope: Scope;
  webOrigin: string;
  redirectUri: string;
}): Promise<{ authorizationUrl: string }> {
  const { prisma, secrets, scope } = options;
  const expected = new URL(OPENROUTER_CALLBACK_PATH, options.webOrigin).toString();
  if (new URL(options.redirectUri).toString() !== expected) throw new OpenRouterOAuthError();
  await prisma.modelOAuthState.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - STATE_TTL_MS) } },
  });
  const pending = await prisma.modelOAuthState.count({
    where: { ...scope, provider: OPENROUTER_OAUTH_PROVIDER },
  });
  if (pending >= MAX_PENDING_PER_USER) throw new OpenRouterOAuthError();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const sealed = await secrets.put(verifier, recordContext(scope), {
    recordId: state,
    ephemeral: true,
  });
  await prisma.modelOAuthState.create({
    data: {
      id: state,
      ...scope,
      provider: OPENROUTER_OAUTH_PROVIDER,
      verifierCiphertext: sealed.ciphertext,
    },
  });
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", expected);
  url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  return { authorizationUrl: url.toString() };
}

/**
 * Finish a sign-in and return the user's OpenRouter API key. The state row is deleted before the
 * exchange, so a replayed, expired, or other user's state is refused and a code is never reused.
 */
export async function completeOpenRouterOAuth(options: {
  prisma: Db;
  secrets: SecretStore;
  scope: Scope;
  state: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const { prisma, secrets, scope, state } = options;
  const row = await prisma.modelOAuthState.findFirst({
    where: {
      id: state,
      ...scope,
      provider: OPENROUTER_OAUTH_PROVIDER,
      createdAt: { gte: new Date(Date.now() - STATE_TTL_MS) },
    },
  });
  if (!row) throw new OpenRouterOAuthError();
  const consumed = await prisma.modelOAuthState.deleteMany({ where: { id: row.id, ...scope } });
  if (consumed.count !== 1) throw new OpenRouterOAuthError();
  try {
    const verifier = await secrets.load(row.verifierCiphertext, row.id);
    const response = await (options.fetchImpl ?? fetch)(OPENROUTER_KEYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: options.code,
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json()) as { key?: unknown };
    if (!response.ok || typeof body.key !== "string" || !body.key) throw new OpenRouterOAuthError();
    return body.key;
  } catch {
    throw new OpenRouterOAuthError();
  }
}
