import type { AgentRunModel } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { triageReadiness } from "./inbox-triage.js";

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
