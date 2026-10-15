import {
  type AdapterContext,
  type AdapterDescriptor,
  DATA_ROOM_EMBEDDING_DIMENSIONS,
  type Embedder,
  EmbedderMisconfiguredError,
} from "@rakazo/adapter-kit";
import {
  assertAllowedOpenAiCompatibleUrl,
  assertHttpsForKeyedOpenAiCompatibleUrl,
  normalizeOpenAiCompatibleBaseUrl,
} from "./openai-compatible-url.js";
import { createOpenAiCompatibleFetch } from "./pi-openai-compatible-provider.js";

const MAX_BATCH = 64;

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
    this.fetchFn = config.fetch ?? createOpenAiCompatibleFetch();
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
    const res = await this.fetchFn(this.url, {
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
    if (!res.ok) {
      // Report only the status; the response body may echo request headers.
      throw new Error(`Embeddings request failed with HTTP ${res.status}`);
    }
    const body = (await res.json()) as EmbeddingsResponse;
    const data = body.data ?? [];
    if (data.length !== input.length) {
      throw new Error(
        `Embeddings response returned ${data.length} vectors for ${input.length} inputs`,
      );
    }
    const out: number[][] = new Array(input.length);
    for (const item of data) {
      const vector = item.embedding;
      if (!vector || item.index === undefined || item.index < 0 || item.index >= input.length) {
        throw new Error("Embeddings response is malformed");
      }
      if (vector.length !== DATA_ROOM_EMBEDDING_DIMENSIONS) {
        throw new EmbedderMisconfiguredError(
          `Embedding model ${this.config.model} returned ${vector.length} dimensions; ${DATA_ROOM_EMBEDDING_DIMENSIONS} required`,
        );
      }
      out[item.index] = vector;
    }
    return out;
  }
}
