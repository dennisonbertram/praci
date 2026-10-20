import { createHash } from "node:crypto";
import type { SecretStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { beginOpenRouterOAuth, completeOpenRouterOAuth } from "./openrouter-oauth.js";

type Row = {
  id: string;
  userId: string;
  spaceId: string;
  provider: string;
  verifierCiphertext: string;
  createdAt: Date;
};

function fakeDb() {
  const rows = new Map<string, Row>();
  const match = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, want]) => {
      const have = row[key as keyof Row];
      if (want && typeof want === "object") {
        const range = want as { gte?: Date; lt?: Date };
        return (
          (!range.gte || (have as Date) >= range.gte) && (!range.lt || (have as Date) < range.lt)
        );
      }
      return have === want;
    });
  const prisma = {
    modelOAuthState: {
      create: async ({ data }: { data: Omit<Row, "createdAt"> }) => {
        rows.set(data.id, { ...data, createdAt: new Date() });
      },
      count: async ({ where }: { where: Record<string, unknown> }) =>
        [...rows.values()].filter((row) => match(row, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...rows.values()].find((row) => match(row, where)) ?? null,
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const hit = [...rows.values()].filter((row) => match(row, where));
        for (const row of hit) rows.delete(row.id);
        return { count: hit.length };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, rows };
}

const secrets = {
  put: async (plaintext: string) => ({ ciphertext: `sealed:${plaintext}` }),
  load: async (ref: string) => ref.replace("sealed:", ""),
} as unknown as SecretStore;

const alice = { userId: "u1", spaceId: "s1" };
const webOrigin = "http://127.0.0.1:45173";
const redirectUri = `${webOrigin}/models/openrouter/callback`;

async function begin(db: ReturnType<typeof fakeDb>, scope = alice) {
  const { authorizationUrl } = await beginOpenRouterOAuth({
    prisma: db.prisma,
    secrets,
    scope,
    webOrigin,
    redirectUri,
  });
  return new URL(authorizationUrl);
}

describe("OpenRouter sign-in", () => {
  it("sends an S256 challenge, checks state, exchanges the code, and returns the key", async () => {
    const db = fakeDb();
    const url = await begin(db);
    expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
    expect(url.searchParams.get("callback_url")).toBe(redirectUri);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = url.searchParams.get("state") ?? "";
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.code).toBe("abc");
      expect(createHash("sha256").update(body.code_verifier).digest("base64url")).toBe(
        url.searchParams.get("code_challenge"),
      );
      return new Response(JSON.stringify({ key: "sk-or-test" }));
    });
    const key = await completeOpenRouterOAuth({
      prisma: db.prisma,
      secrets,
      scope: alice,
      state,
      code: "abc",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(key).toBe("sk-or-test");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/auth/keys");
    expect(db.rows.size).toBe(0);
  });

  it("refuses a replayed state, an unknown state, another user's state, and an expired state", async () => {
    const db = fakeDb();
    const ok = vi.fn(async () => new Response(JSON.stringify({ key: "k" })));
    const run = (state: string, scope = alice) =>
      completeOpenRouterOAuth({
        prisma: db.prisma,
        secrets,
        scope,
        state,
        code: "c",
        fetchImpl: ok as unknown as typeof fetch,
      });
    const state = (await begin(db)).searchParams.get("state") ?? "";
    await expect(run(state, { userId: "u2", spaceId: "s1" })).rejects.toThrow("sign-in failed");
    await expect(run("unknown")).rejects.toThrow("sign-in failed");
    await expect(run(state)).resolves.toBe("k");
    await expect(run(state)).rejects.toThrow("sign-in failed");
    const old = (await begin(db)).searchParams.get("state") ?? "";
    db.rows.get(old)!.createdAt = new Date(Date.now() - 11 * 60_000);
    await expect(run(old)).rejects.toThrow("sign-in failed");
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("refuses a callback outside the configured web origin and a failed exchange", async () => {
    const db = fakeDb();
    await expect(
      beginOpenRouterOAuth({
        prisma: db.prisma,
        secrets,
        scope: alice,
        webOrigin,
        redirectUri: "https://evil.example/models/openrouter/callback",
      }),
    ).rejects.toThrow("sign-in failed");
    const state = (await begin(db)).searchParams.get("state") ?? "";
    const failing = vi.fn(async () => new Response("{}", { status: 400 }));
    await expect(
      completeOpenRouterOAuth({
        prisma: db.prisma,
        secrets,
        scope: alice,
        state,
        code: "c",
        fetchImpl: failing as unknown as typeof fetch,
      }),
    ).rejects.toThrow("sign-in failed");
    expect(db.rows.size).toBe(0);
  });
});
