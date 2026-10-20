import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MessagingSettings } from "./messaging-settings.js";
import { withSecretPersistence } from "./secret-persistence.js";
import { createSecretStore } from "./secret-store-factory.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MessagingSettings storage (PostgreSQL)", () => {
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const secrets = createSecretStore("fake-encryption-key", {});

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = withSecretPersistence(db.prisma, secrets);
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
  });
  afterAll(async () => {
    await prisma.integrationProviderConfig.deleteMany({
      where: { id: { in: ["bluebubbles", "photon"] } },
    });
    await close();
  });

  it("stores the settings encrypted and reads them back", async () => {
    const settings = new MessagingSettings(prisma, secrets, { env: {} });
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "space",
      userId: "user",
      signal: new AbortController().signal,
    };
    await settings.save(
      {
        provider: "bluebubbles",
        serverUrl: "http://192.168.1.20:1234",
        password: "demo-password-123",
      },
      context,
    );
    const row = await prisma.integrationProviderConfig.findUnique({ where: { id: "bluebubbles" } });
    expect(row?.ciphertext).toBeTruthy();
    expect(row?.ciphertext).not.toContain("demo-password-123");
    expect(row?.ciphertext).not.toContain("192.168.1.20");
    const merged = await settings.withSaved();
    expect(merged.bluebubblesPassword).toBe("demo-password-123");
    expect(merged.bluebubblesWebhookToken?.length).toBeGreaterThanOrEqual(32);
  });
});
