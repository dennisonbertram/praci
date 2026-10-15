import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { AdapterContext } from "@rakazo/adapter-kit";
import { DATA_ROOM_EMBEDDING_DIMENSIONS, EmbedderMisconfiguredError } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleEmbedder } from "./openai-compatible-embedder.js";

const ctx = (signal = new AbortController().signal): AdapterContext => ({
  operationId: "op",
  traceId: "t",
  spaceId: "s",
  userId: "u",
  signal,
});
const D = DATA_ROOM_EMBEDDING_DIMENSIONS;
const vec = (n: number, size = D) => Array.from({ length: size }, () => n);

// Echoes one vector per input whose first value is the numeric text, in reverse order.
function fakeFetch(size = D) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const { input } = JSON.parse(String(init?.body)) as { input: string[] };
    const data = input.map((t, index) => ({ index, embedding: vec(Number(t), size) })).reverse();
    return Response.json({ data });
  });
}

const base = { baseUrl: "http://127.0.0.1:11434", model: "m1" };

describe("OpenAICompatibleEmbedder", () => {
  it("sends model, dimensions and auth to /embeddings", async () => {
    const fetch = fakeFetch();
    const e = new OpenAICompatibleEmbedder({ ...base, apiKey: "sk-secret", fetch });
    await e.embed(["1"], ctx());
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:11434/v1/embeddings");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-secret");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "m1",
      input: ["1"],
      dimensions: 1024,
      encoding_format: "float",
    });
  });

  it("batches 130 inputs and preserves order despite shuffled indexes", async () => {
    const fetch = fakeFetch();
    const e = new OpenAICompatibleEmbedder({ ...base, fetch });
    const texts = Array.from({ length: 130 }, (_, i) => String(i + 1));
    const { model, vectors } = await e.embed(texts, ctx());
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(model).toBe("m1");
    expect(vectors.map((v) => v[0])).toEqual(texts.map(Number));
  });

  it("rejects empty strings before any request", async () => {
    const fetch = fakeFetch();
    const e = new OpenAICompatibleEmbedder({ ...base, fetch });
    await expect(e.embed(["1", "  "], ctx())).rejects.toThrow("empty");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws EmbedderMisconfiguredError naming model and size on a wrong dimension", async () => {
    const e = new OpenAICompatibleEmbedder({ ...base, fetch: fakeFetch(768) });
    const err = await e.embed(["1"], ctx()).catch((x) => x);
    expect(err).toBeInstanceOf(EmbedderMisconfiguredError);
    expect(err.message).toContain("m1");
    expect(err.message).toContain("768");
  });

  it("does not leak the API key in HTTP errors", async () => {
    const fetch = vi.fn(async () => new Response("bad key sk-secret", { status: 401 }));
    const e = new OpenAICompatibleEmbedder({ ...base, apiKey: "sk-secret", fetch });
    const err = await e.embed(["1"], ctx()).catch((x) => x);
    expect(err.message).toContain("401");
    expect(err.message).not.toContain("sk-secret");
  });

  it("passes the abort signal to fetch", async () => {
    const ac = new AbortController();
    const fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
      return Response.json({ data: [] });
    });
    const e = new OpenAICompatibleEmbedder({ ...base, fetch });
    ac.abort();
    await expect(e.embed(["1"], ctx(ac.signal))).rejects.toThrow("aborted");
    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(ac.signal);
  });

  it("applies the shared URL rules", () => {
    expect(
      () => new OpenAICompatibleEmbedder({ ...base, baseUrl: "http://169.254.169.254" }),
    ).toThrow("blocked metadata");
    expect(
      () => new OpenAICompatibleEmbedder({ ...base, baseUrl: "https://api.example.com" }),
    ).toThrow("Public model endpoints are blocked");
  });

  it("defaults to the guarded fetch, which refuses redirects", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.writeHead(302, {
        location: `http://127.0.0.1:${(server.address() as AddressInfo).port}/x`,
      });
      res.end();
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    try {
      const port = (server.address() as AddressInfo).port;
      const e = new OpenAICompatibleEmbedder({ ...base, baseUrl: `http://127.0.0.1:${port}` });
      await expect(e.embed(["1"], ctx())).rejects.toThrow();
      expect(hits).toBe(1);
    } finally {
      server.close();
    }
  });

  it("routes an injected fetch through the guard", async () => {
    const fetch = fakeFetch();
    const e = new OpenAICompatibleEmbedder({ ...base, fetch });
    // guard sets redirect: "error" on the injected transport
    await e.embed(["1"], ctx());
    const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.redirect).toBe("error");
  });

  it("hides the key on a malformed 2xx body", async () => {
    const e = new OpenAICompatibleEmbedder({
      ...base,
      apiKey: "sk-secret",
      fetch: vi.fn(async () => new Response("not json sk-secret")),
    });
    const err = await e.embed(["1"], ctx()).catch((x) => x);
    expect(err.message).toBe("Embeddings response is not valid JSON");
    expect(String(err.message) + String(err.cause)).not.toContain("sk-secret");
    expect(err.cause).toBeUndefined();
  });

  it("hides the key on a transport error but keeps AbortError", async () => {
    const e = new OpenAICompatibleEmbedder({
      ...base,
      apiKey: "sk-secret",
      fetch: vi.fn(async () => {
        throw new Error("boom authorization: Bearer sk-secret");
      }),
    });
    const err = await e.embed(["1"], ctx()).catch((x) => x);
    expect(err.message).toBe("Embeddings request failed");
    expect(err.cause).toBeUndefined();
    const abort = new OpenAICompatibleEmbedder({
      ...base,
      fetch: vi.fn(async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    });
    await expect(abort.embed(["1"], ctx())).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    ["duplicate index", [0, 0]],
    ["out of range", [0, 2]],
    ["negative", [0, -1]],
    ["fractional", [0, 1.5]],
  ])("rejects %s indexes", async (_n, indexes) => {
    const e = new OpenAICompatibleEmbedder({
      ...base,
      fetch: vi.fn(async () =>
        Response.json({ data: indexes.map((index) => ({ index, embedding: vec(1) })) }),
      ),
    });
    await expect(e.embed(["1", "2"], ctx())).rejects.toThrow("malformed");
  });

  it.each([
    ["NaN-like string", () => [...vec(1, D - 1), "x"]],
    ["null", () => [...vec(1, D - 1), null]],
    ["not an array", () => "abc"],
  ])("rejects a vector with %s", async (_n, make) => {
    const e = new OpenAICompatibleEmbedder({
      ...base,
      fetch: vi.fn(async () => Response.json({ data: [{ index: 0, embedding: make() }] })),
    });
    await expect(e.embed(["1"], ctx())).rejects.toThrow("malformed");
  });

  it("cancels the body of a non-2xx response", async () => {
    const cancel = vi.fn(async () => {});
    const e = new OpenAICompatibleEmbedder({
      ...base,
      fetch: vi.fn(
        async () => ({ ok: false, status: 500, body: { cancel } }) as unknown as Response,
      ),
    });
    await expect(e.embed(["1"], ctx())).rejects.toThrow("500");
    expect(cancel).toHaveBeenCalled();
  });
});
