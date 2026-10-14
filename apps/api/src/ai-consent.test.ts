import { triageReadiness } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./thread-target.js", () => ({
  resolveThreadTarget: async () => ({ kind: "bot", botId: "bot" }),
}));

import { aiConsentStatus, allowAiConsent } from "./ai-consent.js";
import type { RouterDeps } from "./router.js";

function setup() {
  const upsert = vi.fn(async () => ({}));
  const deps = {
    env: { agentRuntime: "scripted" },
    prisma: {
      spaceModelPreference: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      spaceBackupModel: { findMany: vi.fn(async () => []) },
      userModelCredential: { findMany: vi.fn(async () => []) },
      secret: { findMany: vi.fn(async () => []) },
      bot: { findMany: vi.fn(async () => []) },
      routine: { findMany: vi.fn(async () => []) },
      spaceVoicePreference: {
        findFirst: vi.fn(async () => ({ credential: { provider: "openai" }, voiceId: "alloy" })),
        findMany: vi.fn(async () => [{ credential: { provider: "openai" } }]),
      },
      spaceMemoryConfig: { findUnique: vi.fn(async () => null) },
      deploymentSettings: { findUnique: vi.fn(async () => null) },
      aiDataConsent: { findMany: vi.fn(async () => []), upsert },
      $transaction: vi.fn(async (queries) => Promise.all(queries)),
    },
  } as unknown as RouterDeps;
  return { deps, upsert, actor: { userId: "user", spaceId: "space" } as Actor };
}
describe("consent grants", () => {
  it("includes reachable helper models and cloud services for a targeted send", async () => {
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    deps.cloudAgent = {
      key: "test",
      spaceId: actor.spaceId,
      provider: { describe: () => ({ id: "cursor", capabilities: { offline: false } }) },
    } as RouterDeps["cloudAgent"];
    vi.mocked(deps.prisma.spaceModelPreference.findMany).mockResolvedValue([
      {
        modelId: "helper-model",
        isDefault: false,
        credential: { provider: "anthropic", secretId: "test-secret" },
      },
    ] as never);
    const status = await aiConsentStatus(deps, actor, { botId: "bot", uses: ["model"] });
    expect(status.recipients.map((recipient) => recipient.name)).toEqual(
      expect.arrayContaining(["Anthropic", "Cursor"]),
    );
    expect(deps.prisma.spaceVoicePreference.findMany).not.toHaveBeenCalled();
    expect(deps.prisma.bot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["bot"] } }) }),
    );
    expect(deps.prisma.routine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          botId: { in: ["bot"] },
          OR: [{ active: true }],
        }),
      }),
    );
  });
  it("includes an inactive routine only when the check is for that routine", async () => {
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    await aiConsentStatus(deps, actor, { routineId: "routine-1", uses: ["model"] });
    expect(deps.prisma.routine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ active: true }, { id: "routine-1" }],
        }),
      }),
    );
  });
  it("includes selected backup models in the provider-sharing disclosure until each is allowed", async () => {
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    vi.mocked(deps.prisma.spaceBackupModel.findMany).mockResolvedValue([
      { provider: "anthropic", modelId: "claude-backup" },
    ] as never);
    vi.mocked(deps.prisma.userModelCredential.findMany).mockResolvedValue([
      {
        id: "backup-credential",
        userId: actor.userId,
        provider: "anthropic",
        label: "fixture",
        secretId: "backup-secret",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ] as never);

    const status = await aiConsentStatus(deps, actor, { uses: ["model"] });

    expect(status.recipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Anthropic",
          detail: "claude-backup",
          use: "model",
          allowed: false,
        }),
      ]),
    );
    expect(deps.prisma.spaceBackupModel.findMany).toHaveBeenCalledWith({
      where: { userId: actor.userId, spaceId: actor.spaceId },
      orderBy: { position: "asc" },
    });
  });
  it("discloses only the selected voice provider before a voice action", async () => {
    const { deps, actor } = setup();
    vi.mocked(deps.prisma.spaceVoicePreference.findMany).mockResolvedValue([
      { credential: { provider: "openai" } },
      { credential: { provider: "elevenlabs" } },
    ] as never);
    const status = await aiConsentStatus(deps, actor, { uses: ["voice"] });
    expect(status.recipients).toHaveLength(1);
    expect(status.recipients[0]?.name).toBe("OpenAI");
    expect(deps.prisma.spaceVoicePreference.findMany).not.toHaveBeenCalled();
  });
  it("returns an operator policy without requiring a hosted provider", async () => {
    const { deps, actor } = setup();
    deps.env.privacyPolicyUrl = "https://example.com/privacy";
    expect((await aiConsentStatus(deps, actor)).privacyUrl).toBe("https://example.com/privacy");
  });
  it("rejects stale disclosures, unknown recipients, and a changed account or Space", async () => {
    const { deps, actor, upsert } = setup();
    const current = await aiConsentStatus(deps, actor);
    const input = {
      scope: current.scope,
      version: current.version,
      keys: [current.recipients[0]!.key],
    };
    for (const invalid of [
      { ...input, version: "old" },
      { ...input, scope: "different-account" },
      { ...input, keys: ["unknown"] },
    ]) {
      await expect(allowAiConsent(deps, actor, invalid)).rejects.toThrow("changed");
    }
    expect(upsert).not.toHaveBeenCalled();
    await allowAiConsent(deps, actor, input);
    expect(upsert).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        create: {
          userId: actor.userId,
          spaceId: actor.spaceId,
          recipientKey: input.keys[0],
          version: AI_DISCLOSURE_VERSION,
        },
      }),
    );
  });
});

// The inbox page's `enabled` flag and the triage job both call triageReadiness, which looks up one
// consent row. It must look up the key aiConsentStatus lists, or consent given in the dialog would
// never enable triage (or would enable it for a model the user was not shown).
describe("triage readiness uses the key the consent dialog lists", () => {
  const readinessLookup = async (
    model: { provider: string; id: string; baseUrl?: string },
    actor: Actor,
  ) => {
    const findFirst = vi.fn(async () => ({ userId: actor.userId }));
    const ready = await triageReadiness(
      {
        prisma: { bot: { findFirst: async () => null }, aiDataConsent: { findFirst } } as never,
        resolveModel: async () => model as never,
      },
      actor,
    );
    expect(ready).not.toBeNull();
    return (findFirst.mock.calls[0] as unknown as [{ where: { recipientKey: string } }])[0].where
      .recipientKey;
  };

  it("matches for the deployment model", async () => {
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    deps.env.deploymentModelConfigured = true;
    deps.env.defaultProvider = "openrouter";
    deps.env.defaultModel = "vendor/small-model";

    const status = await aiConsentStatus(deps, actor, { uses: ["model"] });
    const checked = await readinessLookup(
      { provider: "openrouter", id: "vendor/small-model" },
      actor,
    );

    expect(status.recipients.map((r) => r.key)).toEqual([checked]);
  });

  it("matches for an OpenAI-compatible connection, whose key includes the server address", async () => {
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    const credential = {
      id: "credential",
      userId: actor.userId,
      provider: "openai-compatible",
      label: "Local",
      secretId: "secret",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    vi.mocked(deps.prisma.spaceModelPreference.findFirst).mockResolvedValue({
      credential,
      isDefault: true,
      modelId: "local-model",
      thinkingLevel: null,
    } as never);
    vi.mocked(deps.prisma.secret.findMany).mockResolvedValue([
      { id: "secret", ciphertext: "sealed" },
    ] as never);
    deps.secrets = {
      load: async () =>
        JSON.stringify({ kind: "openai_compatible", baseUrl: "http://127.0.0.1:8090/v1" }),
    } as never;

    const status = await aiConsentStatus(deps, actor, { uses: ["model"] });
    const checked = await readinessLookup(
      { provider: "openai-compatible", id: "local-model", baseUrl: "http://127.0.0.1:8090/v1" },
      actor,
    );

    expect(status.recipients.map((r) => r.key)).toEqual([checked]);
    // A different server is a different recipient.
    expect(
      await readinessLookup(
        { provider: "openai-compatible", id: "local-model", baseUrl: "http://127.0.0.1:9999/v1" },
        actor,
      ),
    ).not.toBe(checked);
  });
});

describe("inbox classifier recipient", () => {
  afterEach(() => vi.unstubAllEnvs());
  const enable = () => {
    vi.stubEnv("RAKAZO_INBOX_CLASSIFIER_PROVIDER", "typesafe");
    vi.stubEnv("TYPESAFE_API_KEY", "ts-key");
  };

  it("lists TypeSafe in the settings view when the classifier is on, and lets the user allow it", async () => {
    enable();
    const { deps, actor, upsert } = setup();
    deps.env.agentRuntime = "pi";
    const status = await aiConsentStatus(deps, actor);
    const typesafe = status.recipients.find((recipient) => recipient.name === "TypeSafe");
    expect(typesafe).toMatchObject({ use: "model", allowed: false });

    await allowAiConsent(deps, actor, {
      scope: status.scope,
      version: status.version,
      keys: [typesafe?.key as string],
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("does not make TypeSafe a gate on sending a chat message", async () => {
    enable();
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    const status = await aiConsentStatus(deps, actor, { uses: ["model", "memory"] });
    expect(status.recipients.map((recipient) => recipient.name)).not.toContain("TypeSafe");
  });

  it("lists nothing for TypeSafe when only the Auto Review key is set", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "ts-key");
    const { deps, actor } = setup();
    deps.env.agentRuntime = "pi";
    const status = await aiConsentStatus(deps, actor);
    expect(status.recipients.map((recipient) => recipient.name)).not.toContain("TypeSafe");
  });
});
