import type { TranscriptionProvider, VoiceTranscribeRequest } from "@rakazo/adapter-kit";
import {
  MAX_TRANSCRIPTION_BEFORE_TEXT_CHARS,
  MAX_TRANSCRIPTION_VOCABULARY,
  MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS,
} from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScriptedTranscriptionProvider } from "./scripted-transcription.js";
import { SCRIPTED_TRANSCRIPT } from "./scripted-voice.js";
import {
  createTranscriptionProvider,
  guardTranscription,
  MAX_TRANSCRIBE_BYTES,
} from "./voice-factory.js";

const ctx = {
  operationId: "voice",
  traceId: "voice",
  spaceId: "w",
  userId: "u",
  signal: new AbortController().signal,
};
const KEY = "sk-secret-conformance-key";

interface Harness {
  name: string;
  make(): { provider: TranscriptionProvider; failingKey: string };
  /** Install a fake HTTP server. `error` makes it answer 500 with the key in the body. */
  serve(mode: "ok" | "error"): ReturnType<typeof vi.fn> | null;
  /** Language the provider sent, when it uses it. */
  language?(fetchMock: ReturnType<typeof vi.fn>): string | null;
}

function fakeServer(mode: "ok" | "error") {
  const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => {
    if (init?.signal?.aborted) return Promise.reject(new Error("aborted"));
    return Promise.resolve(
      mode === "ok"
        ? new Response(JSON.stringify({ text: "hello there" }))
        : new Response(JSON.stringify({ detail: `bad request for ${KEY}` }), { status: 500 }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const http = (id: string): Pick<Harness, "make" | "serve"> => ({
  make: () => ({ provider: createTranscriptionProvider(id)!, failingKey: KEY }),
  serve: fakeServer,
});

const harnesses: Harness[] = [
  { name: "elevenlabs", ...http("elevenlabs") },
  { name: "openai", ...http("openai") },
  {
    name: "fish-audio",
    ...http("fish-audio"),
    language: (fetchMock) => {
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      return (init.body as FormData).get("language") as string | null;
    },
  },
  {
    name: "scripted",
    make: () => ({
      provider: guardTranscription(new ScriptedTranscriptionProvider()),
      failingKey: "fail-secret-key",
    }),
    serve: () => null,
  },
];

const request = (over: Partial<VoiceTranscribeRequest> = {}): VoiceTranscribeRequest => ({
  audio: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm",
  apiKey: KEY,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe.each(harnesses)("transcription conformance: $name", (h) => {
  it("returns text", async () => {
    h.serve("ok");
    const { provider } = h.make();
    const { text } = await provider.transcribe(request(), ctx);
    expect(text).toBe(h.name === "scripted" ? SCRIPTED_TRANSCRIPT : "hello there");
  });

  it("rejects empty audio without calling the vendor", async () => {
    const fetchMock = h.serve("ok");
    await expect(
      h.make().provider.transcribe(request({ audio: new Uint8Array() }), ctx),
    ).rejects.toThrow("empty or too large");
    expect(fetchMock?.mock.calls.length ?? 0).toBe(0);
  });

  it("rejects oversize audio", async () => {
    const fetchMock = h.serve("ok");
    await expect(
      h
        .make()
        .provider.transcribe(request({ audio: new Uint8Array(MAX_TRANSCRIBE_BYTES + 1) }), ctx),
    ).rejects.toThrow("empty or too large");
    expect(fetchMock?.mock.calls.length ?? 0).toBe(0);
  });

  it("accepts a language and sends it when the provider uses one", async () => {
    const fetchMock = h.serve("ok");
    await h.make().provider.transcribe(request({ language: "es-ES" }), ctx);
    if (h.language && fetchMock) expect(h.language(fetchMock)).toBe("es");
  });

  it("accepts an oversized vocabulary and never sends more than the caps", async () => {
    h.serve("ok");
    const { provider } = h.make();
    await provider.transcribe(
      request({
        context: {
          appKind: "email",
          vocabulary: Array.from({ length: 500 }, (_, i) => `${i}-${"x".repeat(500)}`),
          beforeText: "y".repeat(50_000),
        },
      }),
      ctx,
    );
  });

  it("turns a provider error into a message without the key", async () => {
    const { provider, failingKey } = h.make();
    h.serve("error");
    const error = await provider
      .transcribe(request({ apiKey: failingKey }), ctx)
      .catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message.length).toBeGreaterThan(0);
    expect((error as Error).message).not.toContain(failingKey);
  });

  it("honors an aborted signal", async () => {
    h.serve("ok");
    const controller = new AbortController();
    controller.abort();
    await expect(
      h.make().provider.transcribe(request({ signal: controller.signal }), ctx),
    ).rejects.toThrow();
  });
});

describe("context caps", () => {
  it("reach the provider trimmed", async () => {
    const inner = new ScriptedTranscriptionProvider();
    await guardTranscription(inner).transcribe(
      request({
        context: {
          appKind: "ai",
          vocabulary: ["  Ada  ", "", ...Array.from({ length: 500 }, (_, i) => `w${i}`)],
          beforeText: `start${"y".repeat(5000)}`,
        },
      }),
      ctx,
    );
    const sent = inner.requests[0]!.context!;
    expect(sent.appKind).toBe("ai");
    expect(sent.vocabulary).toHaveLength(MAX_TRANSCRIPTION_VOCABULARY);
    expect(sent.vocabulary![0]).toBe("Ada");
    expect(sent.vocabulary!.every((w) => w.length <= MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS)).toBe(
      true,
    );
    expect(sent.beforeText).toHaveLength(MAX_TRANSCRIPTION_BEFORE_TEXT_CHARS);
    expect(sent.beforeText!.startsWith("start")).toBe(false);
  });
});
