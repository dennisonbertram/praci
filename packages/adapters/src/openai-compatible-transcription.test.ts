import type { IncomingMessage, Server } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  encodeOpenAiCompatibleTranscriptionSecret,
  OpenAiCompatibleTranscriptionProvider,
} from "./openai-compatible-transcription.js";
import { createTranscriptionProvider, MAX_TRANSCRIBE_BYTES } from "./voice-factory.js";

const ctx = {
  operationId: "voice",
  traceId: "voice",
  spaceId: "w",
  userId: "u",
  signal: new AbortController().signal,
};
const KEY = "sk-fixture-secret-key";

type Mode = "ok" | "401" | "413" | "hang" | "echo-key";
let mode: Mode = "ok";
let server: Server;
let base = "";
let seen: { url?: string; auth?: string; body: string } = { body: "" };

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      seen = {
        url: req.url,
        auth: req.headers.authorization,
        body: Buffer.concat(chunks).toString("latin1"),
      };
      if (mode === "hang") return;
      if (mode === "401") {
        res.writeHead(401, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ error: { message: "Invalid API key" } }));
      }
      if (mode === "413") {
        res.writeHead(413);
        return void res.end("too big");
      }
      if (mode === "echo-key") {
        res.writeHead(500, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ error: `boom ${KEY}` }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ text: " fixed transcript " }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return () => void server.close();
});
afterEach(() => {
  mode = "ok";
});

const secret = (over: { baseUrl?: string; apiKey?: string } = {}) =>
  encodeOpenAiCompatibleTranscriptionSecret({
    baseUrl: over.baseUrl ?? base,
    apiKey: over.apiKey,
    model: "whisper-large-v3",
  });
const audio = { audio: new Uint8Array([1, 2, 3]), mimeType: "audio/webm" };

describe("OpenAI-compatible transcription", () => {
  it("is in the factory and posts multipart to /v1/audio/transcriptions", async () => {
    const provider = createTranscriptionProvider("openai-compatible")!;
    const { text } = await provider.transcribe({ ...audio, apiKey: secret({ apiKey: KEY }) }, ctx);
    expect(text).toBe("fixed transcript");
    expect(seen.url).toBe("/v1/audio/transcriptions");
    expect(seen.auth).toBe(`Bearer ${KEY}`);
    expect(seen.body).toContain('name="model"');
    expect(seen.body).toContain("whisper-large-v3");
  });

  it("sends no authorization header without a key", async () => {
    const provider = createTranscriptionProvider("openai-compatible")!;
    await provider.transcribe({ ...audio, apiKey: secret() }, ctx);
    expect(seen.auth).toBeUndefined();
  });

  it("reports a rejected key (401) without the key", async () => {
    mode = "401";
    const provider = createTranscriptionProvider("openai-compatible")!;
    await expect(
      provider.transcribe({ ...audio, apiKey: secret({ apiKey: KEY }) }, ctx),
    ).rejects.toThrow(/rejected/);
  });

  it("reports a recording the server finds too large (413)", async () => {
    mode = "413";
    const provider = createTranscriptionProvider("openai-compatible")!;
    await expect(provider.transcribe({ ...audio, apiKey: secret() }, ctx)).rejects.toThrow(
      /too large/,
    );
  });

  it("times out on a server that never answers", async () => {
    mode = "hang";
    const provider = new OpenAiCompatibleTranscriptionProvider({ timeoutMs: 100 });
    await expect(provider.transcribe({ ...audio, apiKey: secret() }, ctx)).rejects.toThrow();
  });

  it("scrubs the key from a server error", async () => {
    mode = "echo-key";
    const provider = createTranscriptionProvider("openai-compatible")!;
    const error = await provider
      .transcribe({ ...audio, apiKey: secret({ apiKey: KEY }) }, ctx)
      .catch((e: unknown) => e as Error);
    expect((error as Error).message.length).toBeGreaterThan(0);
    expect((error as Error).message).not.toContain(KEY);
  });

  it("rejects empty and oversize audio before any request", async () => {
    const provider = createTranscriptionProvider("openai-compatible")!;
    seen = { body: "" };
    await expect(
      provider.transcribe({ ...audio, audio: new Uint8Array(), apiKey: secret() }, ctx),
    ).rejects.toThrow("empty or too large");
    await expect(
      provider.transcribe(
        { ...audio, audio: new Uint8Array(MAX_TRANSCRIBE_BYTES + 1), apiKey: secret() },
        ctx,
      ),
    ).rejects.toThrow("empty or too large");
    expect(seen.url).toBeUndefined();
  });

  it("verify accepts a reachable server and rejects a bad key", async () => {
    const provider = createTranscriptionProvider("openai-compatible")!;
    expect((await provider.verify(secret(), ctx)).ok).toBe(true);
    mode = "401";
    const bad = await provider.verify(secret({ apiKey: KEY }), ctx);
    expect(bad.ok).toBe(false);
    expect(bad.message).not.toContain(KEY);
  });
});

describe("OpenAI-compatible transcription URL guard", () => {
  const prev = process.env.RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC;
  afterEach(() => {
    if (prev === undefined) delete process.env.RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC;
    else process.env.RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC = prev;
  });

  it.each([
    "http://169.254.169.254",
    "http://metadata.google.internal",
    "http://user:pw@127.0.0.1:9",
    "ftp://127.0.0.1",
    "not a url",
  ])("refuses %s", async (baseUrl) => {
    const provider = createTranscriptionProvider("openai-compatible")!;
    await expect(
      provider.transcribe({ ...audio, apiKey: secret({ baseUrl }) }, ctx),
    ).rejects.toThrow();
    expect((await provider.verify(secret({ baseUrl }), ctx)).ok).toBe(false);
  });

  it("follows the model-connection rule: a public host needs the operator opt-in", async () => {
    delete process.env.RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC;
    const provider = createTranscriptionProvider("openai-compatible")!;
    const result = await provider.verify(secret({ baseUrl: "https://stt.example.com" }), ctx);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Public model endpoints are blocked/);
  });

  it("refuses a keyed public http:// endpoint", async () => {
    process.env.RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC = "1";
    const provider = createTranscriptionProvider("openai-compatible")!;
    const result = await provider.verify(
      secret({ baseUrl: "http://stt.example.com", apiKey: KEY }),
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/HTTPS/);
  });
});
