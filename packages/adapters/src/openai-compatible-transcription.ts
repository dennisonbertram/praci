import type {
  AdapterContext,
  AdapterDescriptor,
  TranscriptionCapabilities,
  TranscriptionProvider,
  VoiceTranscribeRequest,
  VoiceVerifyResult,
} from "@rakazo/adapter-kit";
import {
  assertAllowedOpenAiCompatibleUrl,
  assertHttpsForKeyedOpenAiCompatibleUrl,
} from "./openai-compatible-url.js";
import { createOpenAiCompatibleFetch } from "./pi-openai-compatible-provider.js";
import { readVoiceJson, speechUploadName, voiceDeadline, voiceHttpError } from "./voice-http.js";

export const OPENAI_COMPATIBLE_TRANSCRIPTION_ID = "openai-compatible";

const NAME = "The transcription server";

interface Secret {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

/** The three settings travel as one secret string, so the existing secret store holds them. */
export function encodeOpenAiCompatibleTranscriptionSecret(value: Secret): string {
  return JSON.stringify(value);
}

function decode(plaintext: string): Secret {
  try {
    const parsed = JSON.parse(plaintext) as Partial<Secret>;
    if (typeof parsed.baseUrl === "string" && typeof parsed.model === "string") {
      return {
        baseUrl: parsed.baseUrl,
        model: parsed.model,
        apiKey: typeof parsed.apiKey === "string" && parsed.apiKey ? parsed.apiKey : undefined,
      };
    }
  } catch {
    // fall through
  }
  throw new Error("The transcription server settings are not valid.");
}

function scrub(text: string, key?: string): string {
  return key ? text.split(key).join("[key]") : text;
}

/** `POST {baseUrl}/v1/audio/transcriptions` for any server that speaks the OpenAI shape. */
export class OpenAiCompatibleTranscriptionProvider implements TranscriptionProvider {
  private readonly timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  describe(): AdapterDescriptor<TranscriptionCapabilities> {
    return {
      id: OPENAI_COMPATIBLE_TRANSCRIPTION_ID,
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { usesContext: false },
    };
  }

  /** Same URL rule as model connections, then DNS-checked fetch with redirects refused. */
  private target(plaintext: string, path: string) {
    const secret = decode(plaintext);
    const url = assertAllowedOpenAiCompatibleUrl(secret.baseUrl);
    assertHttpsForKeyedOpenAiCompatibleUrl(url, secret.apiKey);
    const headers: Record<string, string> = {};
    if (secret.apiKey) headers.authorization = `Bearer ${secret.apiKey}`;
    return { secret, href: `${url.href.replace(/\/$/, "")}/${path}`, headers };
  }

  async verify(plaintext: string, context: AdapterContext): Promise<VoiceVerifyResult> {
    let target: ReturnType<OpenAiCompatibleTranscriptionProvider["target"]>;
    try {
      target = this.target(plaintext, "models");
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Invalid settings." };
    }
    try {
      const res = await createOpenAiCompatibleFetch()(target.href, {
        headers: target.headers,
        signal: voiceDeadline(context.signal, 10_000),
      });
      await res.body?.cancel().catch(() => undefined);
      // Many local servers have no /models route; only a refused key is a failure.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: voiceHttpError(res.status, NAME, "checking", null) };
      }
      return { ok: true };
    } catch (error) {
      context.signal.throwIfAborted();
      return { ok: false, message: "Couldn't reach that server. Check the base URL." };
    }
  }

  async transcribe(
    request: VoiceTranscribeRequest,
    context: AdapterContext,
  ): Promise<{ text: string }> {
    const { secret, href, headers } = this.target(request.apiKey, "audio/transcriptions");
    const form = new FormData();
    form.set("model", secret.model);
    if (request.language) form.set("language", request.language.split("-")[0] ?? "");
    form.set(
      "file",
      new Blob([new Uint8Array(request.audio)], { type: request.mimeType || "audio/webm" }),
      speechUploadName(request.mimeType),
    );
    try {
      const res = await createOpenAiCompatibleFetch()(href, {
        method: "POST",
        headers,
        body: form,
        signal: voiceDeadline(request.signal ?? context.signal, this.timeoutMs),
      });
      const body = await readVoiceJson(res, { requireValid: res.ok });
      if (res.status === 413) throw new Error("That recording is too large for the server.");
      if (!res.ok) throw new Error(voiceHttpError(res.status, NAME, "transcribing", body));
      return { text: String((body as { text?: unknown } | null)?.text ?? "").trim() };
    } catch (error) {
      if (error instanceof Error && secret.apiKey && error.message.includes(secret.apiKey)) {
        throw new Error(scrub(error.message, secret.apiKey));
      }
      throw error;
    }
  }
}
