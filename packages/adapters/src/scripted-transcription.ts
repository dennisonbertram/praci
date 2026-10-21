import type {
  AdapterContext,
  AdapterDescriptor,
  TranscriptionCapabilities,
  TranscriptionProvider,
  VoiceTranscribeRequest,
  VoiceVerifyResult,
} from "@rakazo/adapter-kit";
/** Differs from the scripted voice transcript, so a test can tell which provider answered. */
export const SCRIPTED_TRANSCRIPTION_TEXT = "hello from the transcription provider";

/** Deterministic transcription for tests. An API key starting with "fail" is rejected and makes it throw. */
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
    if (apiKey.trim().length < 8) return { ok: false, message: "That key is too short." };
    if (apiKey.startsWith("fail")) return { ok: false, message: "That key was rejected." };
    return { ok: true };
  }

  async transcribe(
    request: VoiceTranscribeRequest,
    _context: AdapterContext,
  ): Promise<{ text: string }> {
    this.requests.push(request);
    if (request.apiKey.startsWith("fail")) throw new Error("Scripted transcription failed.");
    return { text: SCRIPTED_TRANSCRIPTION_TEXT };
  }
}
