import { DATA_ROOM_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { resolveDataRoomAi } from "./data-room-models.js";

const scope = { userId: "u1", spaceId: "s1" };
const chat = {
  provider: "openai-compatible",
  id: "chat-1",
  baseUrl: "http://127.0.0.1:11434/v1",
  apiKey: "test-key",
};

function deps(opts: {
  model?: Record<string, unknown> | "throw" | null;
  embeddingModel?: string | null;
  granted?: string[];
}) {
  const grants: unknown[] = [];
  return {
    grants,
    deps: {
      resolveModel: async () => {
        if (opts.model === "throw") throw new Error("no model");
        return opts.model as never;
      },
      prisma: {
        spaceModelPreference: {
          findFirst: async () => ({ embeddingModel: opts.embeddingModel ?? null }),
        },
        aiDataConsent: {
          findFirst: async (args: { where: { recipientKey: string; version: string } }) => {
            grants.push(args.where);
            return opts.granted?.includes(args.where.recipientKey) &&
              args.where.version === DATA_ROOM_DISCLOSURE_VERSION
              ? { userId: "u1" }
              : null;
          },
        },
      },
    } as never,
  };
}

describe("resolveDataRoomAi", () => {
  it("resolves nothing when no chat model can be resolved", async () => {
    for (const model of [null, "throw" as const, { provider: "scripted", id: "scripted" }]) {
      const ai = await resolveDataRoomAi(deps({ model, embeddingModel: "e" }).deps, scope);
      expect(ai).toMatchObject({ model: null, embedder: null, recipients: [], allowed: false });
    }
  });

  it("has no embedder without a saved embedding model, a base URL, or with OAuth", async () => {
    for (const [model, embeddingModel] of [
      [chat, null],
      [{ ...chat, baseUrl: undefined }, "embed-1"],
      [{ ...chat, oauth: {} }, "embed-1"],
    ] as const) {
      const ai = await resolveDataRoomAi(deps({ model, embeddingModel }).deps, scope);
      expect(ai.model).not.toBeNull();
      expect(ai.embedder).toBeNull();
      expect(ai.recipients).toHaveLength(1);
    }
  });

  it("builds an embedder on the chat connection and names both models as recipients", async () => {
    const ai = await resolveDataRoomAi(
      deps({ model: chat, embeddingModel: "embed-1" }).deps,
      scope,
    );
    expect(ai.embedder?.describe().id).toBe("openai-compatible-embedder");
    expect(ai.embeddingModel).toBe("embed-1");
    expect(ai.recipients.map((r) => r.detail)).toEqual(["chat-1", "embed-1"]);
    expect(ai.recipients[0]?.name).toContain("http://127.0.0.1:11434");
  });

  it("falls back to keyword-only when the connection is one the embedder refuses", async () => {
    const ai = await resolveDataRoomAi(
      deps({
        model: { ...chat, baseUrl: "https://llm.example.test/v1" },
        embeddingModel: "embed-1",
      }).deps,
      scope,
    );
    expect(ai.embedder).toBeNull();
    expect(ai.model).not.toBeNull();
  });

  it("binds consent to the exact providers: another embedding model needs consent again", async () => {
    const first = await resolveDataRoomAi(
      deps({ model: chat, embeddingModel: "embed-1" }).deps,
      scope,
    );
    expect(first.allowed).toBe(false);
    const granted = await resolveDataRoomAi(
      deps({ model: chat, embeddingModel: "embed-1", granted: [first.consentKey] }).deps,
      scope,
    );
    expect(granted.allowed).toBe(true);
    const changed = await resolveDataRoomAi(
      deps({ model: chat, embeddingModel: "embed-2", granted: [first.consentKey] }).deps,
      scope,
    );
    expect(changed.allowed).toBe(false);
    expect(changed.consentKey).not.toBe(first.consentKey);
  });
});
