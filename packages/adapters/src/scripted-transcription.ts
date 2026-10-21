import type {
  AdapterContext,
  AdapterDescriptor,
  TranscriptionCapabilities,
  TranscriptionProvider,
  VoiceTranscribeRequest,
  VoiceVerifyResult,
} from "@rakazo/adapter-kit";
import { SCRIPTED_TRANSCRIPT } from "./scripted-voice.js";

/** Deterministic transcription for tests. An API key starting with "fail" makes it throw. */
export class ScriptedTranscriptionProvider implements TranscriptionProvider {
  readonly requests: VoiceTranscribeRequest[] = [];

  describe(): AdapterDescriptor<TranscriptionCapabilities> {
    return {
      id: "scripted",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { usesContext: true },
    };
  }

  async verify(apiKey: string, _context: AdapterContext): Promise<VoiceVerifyResult> {
    return apiKey.trim().length < 8
      ? { ok: false, message: "That key is too short." }
      : { ok: true };
  }

  async transcribe(
    request: VoiceTranscribeRequest,
    _context: AdapterContext,
  ): Promise<{ text: string }> {
    this.requests.push(request);
    if (request.apiKey.startsWith("fail")) throw new Error("Scripted transcription failed.");
    return { text: SCRIPTED_TRANSCRIPT };
  }
}
