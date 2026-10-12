import type { AgentRunModel, InboxClassifierProvider } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { triageReadiness, triageStatus } from "./inbox-triage.js";

const scope = { userId: "user-1", spaceId: "space-1" };
const keyFor = (provider: string, modelId: string, baseUrl?: string) =>
  aiRecipient({ provider, modelId, baseUrl, use: "model" })?.key;

function setup(options: {
  model?: AgentRunModel | Error;
  bot?: { id: string } | null;
  consented?: boolean;
}) {
  const consent = vi.fn(async () => (options.consented === false ? null : { userId: "user-1" }));
  const botLookup = vi.fn(async () => options.bot ?? null);
  const resolveModel = vi.fn(async () => {
    if (options.model instanceof Error) throw options.model;
    return options.model ?? { provider: "openrouter", id: "test-model" };
  });
  const deps = {
    prisma: { bot: { findFirst: botLookup }, aiDataConsent: { findFirst: consent } } as never,
    resolveModel,
  };
  return { deps, consent, botLookup, resolveModel };
}

describe("triageReadiness", () => {
  it("returns the resolved model when the user consented to that exact recipient", async () => {
    const { deps, consent } = setup({});
    const result = await triageReadiness(deps, scope);
    expect(result?.model).toMatchObject({ provider: "openrouter", id: "test-model" });
    expect(consent).toHaveBeenCalledWith({
      where: {
        ...scope,
        recipientKey: keyFor("openrouter", "test-model"),
        version: AI_DISCLOSURE_VERSION,
      },
      select: { userId: true },
    });
  });

  it("resolves the model for the user's unarchived Inbox agent so its override applies", async () => {
    const { deps, botLookup, resolveModel } = setup({ bot: { id: "bot-inbox" } });
    const result = await triageReadiness(deps, scope);
    expect(botLookup).toHaveBeenCalledWith({
      where: {
        spaceId: "space-1",
        userId: "user-1",
        spawnKey: "inbox-agent:user-1",
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(resolveModel).toHaveBeenCalledWith({ ...scope, botId: "bot-inbox" });
    expect(result?.botId).toBe("bot-inbox");
  });

  it("uses the default model when the user has no Inbox agent", async () => {
    const { deps, resolveModel } = setup({ bot: null });
    await triageReadiness(deps, scope);
    expect(resolveModel).toHaveBeenCalledWith({ ...scope, botId: undefined });
  });

  it("returns null when no model is connected", async () => {
    const { deps, consent } = setup({ model: new Error("Connect a model in Settings") });
    expect(await triageReadiness(deps, scope)).toBeNull();
    expect(consent).not.toHaveBeenCalled();
  });

  it("returns null for the scripted provider", async () => {
    const { deps, consent } = setup({ model: { provider: "scripted", id: "scripted" } });
    expect(await triageReadiness(deps, scope)).toBeNull();
    expect(consent).not.toHaveBeenCalled();
  });

  it("returns null without a consent row for that recipient", async () => {
    const { deps } = setup({ consented: false });
    expect(await triageReadiness(deps, scope)).toBeNull();
  });

  it("binds consent to the endpoint of an OpenAI-compatible connection", async () => {
    const baseUrl = "https://llm.example.test/v1";
    const { deps, consent } = setup({
      model: { provider: "openai-compatible", id: "local-1", baseUrl },
    });
    await triageReadiness(deps, scope);
    const key = keyFor("openai-compatible", "local-1", baseUrl);
    expect(key).not.toBe(keyFor("openai-compatible", "local-1"));
    expect(consent).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ recipientKey: key }) }),
    );
  });

  it("returns null when the executor cannot resolve models", async () => {
    const { deps } = setup({});
    expect(await triageReadiness({ ...deps, resolveModel: undefined }, scope)).toBeNull();
  });
});

describe("triageReadiness with an optional classifier", () => {
  const typesafeKey = aiRecipient({ provider: "typesafe", use: "model" })?.key as string;
  const classifier: InboxClassifierProvider = {
    describe: () => ({
      id: "typesafe",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: {},
    }),
    classify: async () => ({ model: "m", items: [] }),
  };
  /** Consent rows by recipient key; the model recipient is listed under `granted` too. */
  function withConsent(granted: Array<string | undefined>) {
    const { deps } = setup({});
    const findFirst = vi.fn(async (args: { where: { recipientKey: string } }) =>
      granted.includes(args.where.recipientKey) ? { userId: "user-1" } : null,
    );
    return {
      deps: {
        ...deps,
        classifier,
        prisma: { ...(deps.prisma as object), aiDataConsent: { findFirst } } as never,
      },
      findFirst,
    };
  }

  it("has no classifier when none is configured", async () => {
    const { deps } = setup({});
    expect((await triageReadiness(deps, scope))?.classifier).toBeNull();
  });

  it("returns the classifier when the user also consented to TypeSafe", async () => {
    const { deps } = withConsent([keyFor("openrouter", "test-model"), typesafeKey]);
    const result = await triageReadiness(deps, scope);
    expect(result?.classifier).toBe(classifier);
  });

  it("uses the LLM alone when TypeSafe has no consent row", async () => {
    const { deps, findFirst } = withConsent([keyFor("openrouter", "test-model")]);
    const result = await triageReadiness(deps, scope);
    expect(result?.model).toMatchObject({ id: "test-model" });
    expect(result?.classifier).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientKey: typesafeKey,
          version: AI_DISCLOSURE_VERSION,
        }),
      }),
    );
  });

  it("does not let TypeSafe consent stand in for model consent", async () => {
    const { deps } = withConsent([typesafeKey]);
    expect(await triageReadiness(deps, scope)).toBeNull();
  });
});

describe("triageStatus says why triage cannot run", () => {
  it("is ready, with nothing blocked, when the exact recipient is allowed", async () => {
    const { deps } = setup({});
    const status = await triageStatus(deps, scope);
    expect(status.blocked).toBeNull();
    expect(status.ready?.model).toMatchObject({ provider: "openrouter", id: "test-model" });
  });

  it("asks for consent to the resolved model's recipient key and name", async () => {
    const { deps } = setup({ consented: false });
    const status = await triageStatus(deps, scope);
    expect(status.ready).toBeNull();
    expect(status.blocked).toEqual({
      reason: "needs_consent",
      recipient: { key: keyFor("openrouter", "test-model"), name: "OpenRouter" },
    });
  });

  it("asks for the connection's own key, so consent to another endpoint does not count", async () => {
    const baseUrl = "https://llm.example.test/v1";
    const { deps } = setup({
      model: { provider: "openai-compatible", id: "local-1", baseUrl },
      consented: false,
    });
    const status = await triageStatus(deps, scope);
    expect(status.blocked).toMatchObject({
      reason: "needs_consent",
      recipient: { key: keyFor("openai-compatible", "local-1", baseUrl) },
    });
  });

  it("reports no model when none resolves, for the scripted provider, and without a resolver", async () => {
    for (const { deps, consent } of [
      setup({ model: new Error("Connect a model in Settings") }),
      setup({ model: { provider: "scripted", id: "scripted" } }),
    ]) {
      expect((await triageStatus(deps, scope)).blocked).toEqual({ reason: "no_model" });
      expect(consent).not.toHaveBeenCalled();
    }
    const { deps } = setup({});
    expect((await triageStatus({ ...deps, resolveModel: undefined }, scope)).blocked).toEqual({
      reason: "no_model",
    });
  });

  it("does not ask for the optional classifier's consent: the model alone is enough to start", async () => {
    const { deps } = setup({});
    const classifier: InboxClassifierProvider = {
      describe: () => ({
        id: "typesafe",
        contractVersion: "1",
        adapterVersion: "0.1.0",
        capabilities: {},
      }),
      classify: async () => ({ model: "m", items: [] }),
    };
    const onlyModel = vi.fn(async (args: { where: { recipientKey: string } }) =>
      args.where.recipientKey === keyFor("openrouter", "test-model") ? { userId: "user-1" } : null,
    );
    const status = await triageStatus(
      {
        ...deps,
        classifier,
        prisma: { ...(deps.prisma as object), aiDataConsent: { findFirst: onlyModel } } as never,
      },
      scope,
    );
    expect(status.blocked).toBeNull();
    expect(status.ready?.classifier).toBeNull();
  });
});
