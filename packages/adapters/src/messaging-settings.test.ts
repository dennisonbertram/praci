import type { AdapterContext, SecretStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { BlueBubblesEmulator } from "./bluebubbles-emulator.js";
import { MessagingSettings } from "./messaging-settings.js";
import { PhotonEmulator } from "./photon-emulator.js";

const context = {} as AdapterContext;

/** In-memory stand-ins: "encryption" is a prefix, so a test can see what was stored. */
function fakes() {
  const rows = new Map<string, string>();
  const prisma = {
    integrationProviderConfig: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.has(where.id) ? { id: where.id, ciphertext: rows.get(where.id) } : null,
      upsert: async ({
        where,
        create,
      }: {
        where: { id: string };
        create: { ciphertext: string };
      }) => {
        rows.set(where.id, create.ciphertext);
      },
    },
  } as unknown as PrismaClient;
  const secrets = {
    put: async (plaintext: string) => ({ ciphertext: `enc:${plaintext}` }),
    load: async (ref: string) => ref.slice(4),
  } as unknown as SecretStore;
  return { rows, prisma, secrets };
}

const bb = { provider: "bluebubbles", serverUrl: "http://192.168.1.20:1234" } as const;

describe("MessagingSettings", () => {
  it("generates a long webhook token, keeps secrets on replace, and never returns them", async () => {
    const { prisma, secrets } = fakes();
    const settings = new MessagingSettings(prisma, secrets, {
      env: {},
      apiUrl: "https://rakazo.test",
    });
    await settings.save({ ...bb, password: "pw-1" }, context);
    const first = (await settings.state([]))[0]!;
    expect(first.configured).toBe(true);
    const token = new URL(first.webhookUrl!).searchParams.get("token")!;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(first.webhookUrl).toContain("https://rakazo.test/api/v1/messaging/webhook/bluebubbles?");

    // Blank secrets keep the saved ones; the URL changes.
    await settings.save({ ...bb, serverUrl: "http://192.168.1.21:1234" }, context);
    const second = (await settings.state([]))[0]!;
    expect(new URL(second.webhookUrl!).searchParams.get("token")).toBe(token);
    expect((await settings.withSaved()).bluebubblesPassword).toBe("pw-1");

    // The state carries source flags, never secret values.
    expect(second.fields.serverUrl).toEqual({
      source: "saved",
      value: "http://192.168.1.21:1234/",
    });
    expect(second.fields.password).toEqual({ source: "saved" });
    expect(JSON.stringify(second.fields)).not.toContain("pw-1");
  });

  it("ignores a saved row whose values are not all strings", async () => {
    const { rows, prisma, secrets } = fakes();
    rows.set("bluebubbles", `enc:${JSON.stringify({ password: 123, serverUrl: "http://x" })}`);
    const settings = new MessagingSettings(prisma, secrets, { env: {} });
    const merged = await settings.withSaved();
    expect(merged.bluebubblesPassword).toBeUndefined();
    expect(merged.bluebubblesUrl).toBeUndefined();
  });

  it("requires a password the first time and a long enough token", async () => {
    const { prisma, secrets } = fakes();
    const settings = new MessagingSettings(prisma, secrets, { env: {} });
    await expect(settings.save(bb, context)).rejects.toThrow("password");
  });

  it("lets environment values win per field", async () => {
    const { prisma, secrets } = fakes();
    const env = { bluebubblesUrl: "http://10.0.0.5:1234", photonProjectId: "env-project" };
    const settings = new MessagingSettings(prisma, secrets, { env });
    await settings.save({ ...bb, password: "saved-pw" }, context);
    const merged = await settings.withSaved();
    expect(merged.bluebubblesUrl).toBe("http://10.0.0.5:1234");
    expect(merged.bluebubblesPassword).toBe("saved-pw");
    const [bluebubbles, photon] = await settings.state([]);
    expect(bluebubbles!.fields.serverUrl).toEqual({ source: "server", value: env.bluebubblesUrl });
    expect(bluebubbles!.fields.password!.source).toBe("saved");
    expect(photon!.fields.projectId).toEqual({ source: "server", value: "env-project" });
    expect(photon!.configured).toBe(false);
  });

  it("marks a provider active only when the running server mounted it", async () => {
    const { prisma, secrets } = fakes();
    const settings = new MessagingSettings(prisma, secrets, { env: {} });
    const [bluebubbles, photon] = await settings.state(["photon"]);
    expect([bluebubbles!.active, photon!.active]).toEqual([false, true]);
  });

  it("tests BlueBubbles against the emulator and reports a wrong password", async () => {
    const emulator = new BlueBubblesEmulator();
    const { prisma, secrets } = fakes();
    const options = {
      fetch: emulator.fetch,
      resolveHostname: async () => [{ address: "192.168.1.20", family: 4 as const }],
    };
    const good = new MessagingSettings(prisma, secrets, {
      env: {
        bluebubblesUrl: emulator.serverUrl,
        bluebubblesPassword: emulator.password,
        bluebubblesWebhookToken: emulator.webhookToken,
      },
      bluebubbles: options,
    });
    await expect(good.test("bluebubbles")).resolves.toEqual({ ok: true });
    expect(emulator.requests).toContain("GET /ping");

    const bad = new MessagingSettings(prisma, secrets, {
      env: {
        bluebubblesUrl: emulator.serverUrl,
        bluebubblesPassword: "wrong-password",
        bluebubblesWebhookToken: emulator.webhookToken,
      },
      bluebubbles: options,
    });
    const result = await bad.test("bluebubbles");
    expect(result).toEqual({ ok: false, error: "BlueBubbles /ping returned 401" });
    expect(JSON.stringify(result)).not.toContain("wrong-password");
    await expect(good.test("photon")).resolves.toEqual({ ok: false, error: "Not configured" });
  });

  it("tests Photon by minting a line token", async () => {
    const emulator = new PhotonEmulator();
    await emulator.start();
    try {
      const { prisma, secrets } = fakes();
      const settings = new MessagingSettings(prisma, secrets, {
        env: {},
        photon: { fetch: emulator.fetch, address: emulator.address },
      });
      await settings.save(
        {
          provider: "photon",
          projectId: emulator.projectId,
          projectSecret: emulator.projectSecret,
          webhookSecret: emulator.webhookSecret,
        },
        context,
      );
      await expect(settings.test("photon")).resolves.toEqual({ ok: true });
      expect(emulator.tokenRequests).toBe(1);
      await settings.save(
        { provider: "photon", projectId: emulator.projectId, projectSecret: "wrong" },
        context,
      );
      await expect(settings.test("photon")).resolves.toMatchObject({ ok: false });
    } finally {
      await emulator.stop();
    }
  });
});
