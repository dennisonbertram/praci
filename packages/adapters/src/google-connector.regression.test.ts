import type { AdapterContext } from "@rakazo/adapter-kit";
import { IntegrationProviderConfigSchema } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { IntegrationProviderSettings } from "./integration-provider-settings.js";
import { EncryptedSecretStore } from "./secrets.js";

const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};
const REDIRECT = "https://rakazo.example.test/integrations/google/callback";

function settings(redirectUri?: string) {
  const rows = new Map<string, { id: string; ciphertext: string }>();
  const prisma = {
    integrationProviderConfig: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
      upsert: vi.fn(async ({ create }: { create: { id: string; ciphertext: string } }) => {
        rows.set(create.id, create);
        return create;
      }),
    },
    connection: { findFirst: vi.fn(async () => null) },
  };
  return {
    rows,
    settings: new IntegrationProviderSettings(
      prisma as unknown as PrismaClient,
      new EncryptedSecretStore("test-encryption-key"),
      "test-identity",
      {},
      undefined,
      redirectUri,
    ),
  };
}

describe("Google in Integration setup", () => {
  it("saves encrypted client credentials and serves a connector that starts a connect", async () => {
    const s = settings(REDIRECT);
    await s.settings.save(
      { provider: "google", clientId: "fake-client-id", clientSecret: "fake-client-secret" },
      context,
    );
    expect(s.rows.get("google")?.ciphertext).not.toContain("fake-client-secret");
    const connector = s.settings.providers().find((p) => p.describe().id === "google");
    const { authorizationUrl } = await connector!.begin(
      { provider: "gmail", redirectUrl: "unused" },
      context,
    );
    const url = new URL(authorizationUrl as string);
    expect(url.searchParams.get("client_id")).toBe("fake-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.search).not.toContain("fake-client-secret");
  });

  it("cannot start a connect in a process that was not given a redirect URI", async () => {
    const s = settings();
    await s.settings.save(
      { provider: "google", clientId: "fake-client-id", clientSecret: "fake-client-secret" },
      context,
    );
    const connector = s.settings.providers().find((p) => p.describe().id === "google");
    await expect(connector!.begin({ provider: "gmail", redirectUrl: "" }, context)).rejects.toThrow(
      /redirect/i,
    );
  });

  it("requires both a client id and a client secret", () => {
    expect(
      IntegrationProviderConfigSchema.safeParse({ provider: "google", clientId: "id" }).success,
    ).toBe(false);
    expect(
      IntegrationProviderConfigSchema.safeParse({
        provider: "google",
        clientId: "id",
        clientSecret: "  ",
      }).success,
    ).toBe(false);
  });
});
