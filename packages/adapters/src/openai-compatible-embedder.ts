import type { AdapterContext, AdapterDescriptor, Embedder } from "@rakazo/adapter-kit";
import { DATA_ROOM_EMBEDDING_DIMENSIONS, EmbedderMisconfiguredError } from "@rakazo/adapter-kit";
import { readBoundedText } from "./connector-http.js";
import {
  assertAllowedOpenAiCompatibleUrl,
  assertHttpsForKeyedOpenAiCompatibleUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "./openai-compatible-url.js";
import { createOpenAiCompatibleFetch } from "./pi-openai-compatible-provider.js";

const MAX_BATCH = 64;
/** 64 inputs x 1024 floats is about 1.5 MB of JSON; this leaves wide margin. */
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
/** The endpoint refuses the request shape for this model; retrying cannot help. */
const REJECTED_STATUSES = new Set([400, 404, 422]);

class TooLarge extends Error {}

export interface OpenAICompatibleEmbedderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  fetch?: typeof globalThis.fetch;
}

interface EmbeddingsResponse {
  model?: string;
  data?: Array<{ index?: number; embedding?: number[] }>;
}

/** Embeddings through any OpenAI-compatible `/embeddings` endpoint. */
export class OpenAICompatibleEmbedder implements Embedder {
  private readonly url: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(private readonly config: OpenAICompatibleEmbedderConfig) {
    const url = assertAllowedOpenAiCompatibleUrl(config.baseUrl);
    assertHttpsForKeyedOpenAiCompatibleUrl(url, config.apiKey);
    this.url = `${normalizeOpenAiCompatibleBaseUrl(config.baseUrl)}/embeddings`;
    this.fetchFn = createOpenAiCompatibleFetch(config.fetch);
  }

  describe(): AdapterDescriptor<{ dimensions: number; maxBatch: number }> {
    return {
      id: "openai-compatible-embedder",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { dimensions: DATA_ROOM_EMBEDDING_DIMENSIONS, maxBatch: MAX_BATCH },
    };
  }

  async embed(
    texts: string[],
    context: AdapterContext,
  ): Promise<{ model: string; vectors: number[][] }> {
    // The API rejects empty input; fail before any request rather than send a partial job.
    if (texts.some((t) => t.trim() === "")) throw new Error("Cannot embed an empty string");
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      vectors.push(...(await this.embedBatch(texts.slice(i, i + MAX_BATCH), context.signal)));
    }
    return { model: this.config.model, vectors };
  }

  private async embedBatch(input: string[], signal: AbortSignal): Promise<number[][]> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    let res: Response;
    try {
      res = await this.fetchFn(this.url, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          model: this.config.model,
          input,
          dimensions: DATA_ROOM_EMBEDDING_DIMENSIONS,
          encoding_format: "float",
        }),
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      // Transport errors can carry request headers; throw a fixed message with no cause.
      throw new Error("Embeddings request failed");
    }
    if (!res.ok) {
      // Report only the status; the response body may echo request headers.
      await res.body?.cancel().catch(() => {});
      if (REJECTED_STATUSES.has(res.status)) {
        throw new EmbedderMisconfiguredError(
          `Embeddings endpoint rejected the request for model ${this.config.model} (HTTP ${res.status})`,
        );
      }
      throw new Error(`Embeddings request failed with HTTP ${res.status}`);
    }
    let body: EmbeddingsResponse;
    try {
      const { text, truncated } = await readBoundedText(res, MAX_RESPONSE_BYTES);
      if (truncated) throw new TooLarge();
      body = JSON.parse(text) as EmbeddingsResponse;
    } catch (error) {
      if (error instanceof TooLarge) throw new Error("Embeddings response is too large");
      if (signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new Error("Embeddings response is not valid JSON");
    }
    const data = Array.isArray(body?.data) ? body.data : [];
    if (data.length !== input.length) {
      throw new Error(
        `Embeddings response returned ${data.length} vectors for ${input.length} inputs`,
      );
    }
    const out: number[][] = new Array(input.length);
    for (const item of data) {
      const index = item?.index;
      const vector = item?.embedding;
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= input.length ||
        out[index] !== undefined ||
        !Array.isArray(vector)
      ) {
        throw new Error("Embeddings response is malformed");
      }
      if (vector.length !== DATA_ROOM_EMBEDDING_DIMENSIONS) {
        throw new EmbedderMisconfiguredError(
          `Embedding model ${this.config.model} returned ${vector.length} dimensions; ${DATA_ROOM_EMBEDDING_DIMENSIONS} required`,
        );
      }
      if (!vector.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new Error("Embeddings response is malformed");
      }
      out[index] = vector;
    }
    return out;
  }
}
