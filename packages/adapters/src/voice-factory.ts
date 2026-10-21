import type {
  AdapterContext,
  AdapterDescriptor,
  TranscriptionCapabilities,
  TranscriptionProvider,
  VoiceProvider,
  VoiceTranscribeRequest,
} from "@rakazo/adapter-kit";
import { capTranscriptionContext } from "@rakazo/adapter-kit";
import { CartesiaVoiceProvider } from "./cartesia-voice.js";
import { ElevenLabsVoiceProvider } from "./elevenlabs-voice.js";
import { FishAudioVoiceProvider } from "./fish-audio-voice.js";
import { OpenAIVoiceProvider } from "./openai-voice.js";
import { ScriptedTranscriptionProvider } from "./scripted-transcription.js";
import { SCRIPTED_VOICE_CATALOG_ENTRY, ScriptedVoiceProvider } from "./scripted-voice.js";

export const VOICE_CATALOG = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Highest quality and cloning. Flash v2.5 for conversational calls.",
    transcribe: true,
    speech: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Simple TTS plus Whisper-class transcription. Reuse an OpenAI key.",
    transcribe: true,
    speech: true,
  },
  {
    id: "cartesia",
    name: "Cartesia",
    description: "Lowest-latency Sonic voices for interruptible calls.",
    transcribe: false,
    speech: true,
  },
  {
    id: "fish-audio",
    name: "Fish Audio",
    description: "Voice models, cloning, and expressive speech with optional transcription.",
    transcribe: true,
    speech: true,
  },
] as const;

export { SCRIPTED_VOICE_CATALOG_ENTRY };

export type HostedVoiceProviderId = (typeof VOICE_CATALOG)[number]["id"];
export type VoiceProviderId = HostedVoiceProviderId | "scripted";

function scriptedVoiceEnabled() {
  return process.env.AGENT_RUNTIME === "scripted";
}

export function listVoiceCatalog() {
  return scriptedVoiceEnabled()
    ? [...VOICE_CATALOG, SCRIPTED_VOICE_CATALOG_ENTRY]
    : [...VOICE_CATALOG];
}

/** A transcription-only test provider: it transcribes but does not speak. */
export const SCRIPTED_TRANSCRIBE_CATALOG_ENTRY = {
  id: "scripted-transcribe",
  name: "Scripted transcription",
  description: "Deterministic transcription fixture for tests. No speech.",
  transcribe: true,
  speech: false,
} as const;

/** Providers a user can select for transcription. */
export function listTranscriptionCatalog() {
  const entries: { id: string; name: string; description: string }[] = listVoiceCatalog().filter(
    (entry) => entry.transcribe,
  );
  return scriptedVoiceEnabled() ? [...entries, SCRIPTED_TRANSCRIBE_CATALOG_ENTRY] : entries;
}

export function isTranscriptionProviderId(value: string): boolean {
  return listTranscriptionCatalog().some((entry) => entry.id === value);
}

export function voiceCatalogEntry(id: string) {
  if (id === SCRIPTED_VOICE_CATALOG_ENTRY.id) return SCRIPTED_VOICE_CATALOG_ENTRY;
  return VOICE_CATALOG.find((entry) => entry.id === id);
}

export function isVoiceProviderId(value: string): value is VoiceProviderId {
  if (value === "scripted") return scriptedVoiceEnabled();
  return VOICE_CATALOG.some((entry) => entry.id === value);
}

/** Construct the provider adapter selected by a persisted voice credential. */
export function createVoiceProvider(kind: string): VoiceProvider {
  switch (kind) {
    case "elevenlabs":
      return new ElevenLabsVoiceProvider();
    case "openai":
      return new OpenAIVoiceProvider();
    case "cartesia":
      return new CartesiaVoiceProvider();
    case "fish-audio":
      return new FishAudioVoiceProvider();
    case "scripted":
      if (!scriptedVoiceEnabled()) break;
      return new ScriptedVoiceProvider();
    default:
      break;
  }
  throw new Error(
    `Unknown voice provider "${kind}". Use elevenlabs | openai | cartesia | fish-audio.`,
  );
}

/** Replace the key in an error. Cancellation and errors without the key pass through unchanged. */
function scrubKey(error: unknown, apiKey: string): unknown {
  if (!(error instanceof Error) || !apiKey || !error.message.includes(apiKey)) return error;
  if (error.name === "AbortError" || error.name === "TimeoutError") return error;
  const scrubbed = new Error(error.message.split(apiKey).join("[key]"), { cause: error.cause });
  scrubbed.name = error.name;
  return scrubbed;
}

/** Wrap a transcription provider with the checks every provider shares. */
export function guardTranscription(inner: TranscriptionProvider): TranscriptionProvider {
  return {
    describe: () => inner.describe(),
    async verify(apiKey, context) {
      try {
        const result = await inner.verify(apiKey, context);
        if (result.message && apiKey) {
          return { ...result, message: result.message.split(apiKey).join("[key]") };
        }
        return result;
      } catch (error) {
        throw scrubKey(error, apiKey);
      }
    },
    async transcribe(request: VoiceTranscribeRequest, context: AdapterContext) {
      const signal = request.signal ?? context.signal;
      if (request.audio.byteLength === 0 || request.audio.byteLength > MAX_TRANSCRIBE_BYTES) {
        throw new Error("That recording is empty or too large.");
      }
      signal.throwIfAborted();
      const capped = {
        ...request,
        context: request.context ? capTranscriptionContext(request.context) : undefined,
      };
      try {
        return await inner.transcribe(capped, context);
      } catch (error) {
        throw scrubKey(error, request.apiKey);
      }
    },
  };
}

/** Adapt a voice provider that can transcribe. */
export function transcriptionFromVoice(voice: VoiceProvider): TranscriptionProvider | null {
  const { transcribe } = voice;
  if (!transcribe) return null;
  return guardTranscription({
    describe: (): AdapterDescriptor<TranscriptionCapabilities> => ({
      ...voice.describe(),
      capabilities: { usesContext: false },
    }),
    verify: (apiKey, context) => voice.verify(apiKey, context),
    // The voice providers cannot use `context`, so it is dropped here.
    transcribe: (request, context) =>
      transcribe.call(voice, { ...request, context: undefined }, context),
  });
}

/** The transcription provider for a voice provider id, or null when it cannot transcribe. */
export function createTranscriptionProvider(providerId: string): TranscriptionProvider | null {
  if (providerId === SCRIPTED_TRANSCRIBE_CATALOG_ENTRY.id && scriptedVoiceEnabled()) {
    return guardTranscription(new ScriptedTranscriptionProvider());
  }
  return transcriptionFromVoice(createVoiceProvider(providerId));
}

export class NoVoiceConfigured extends Error {
  readonly reason: "key" | "voice";

  constructor(reason: "key" | "voice") {
    super(
      reason === "key"
        ? "Add a voice provider key in Voice settings to turn on speaking."
        : "Pick a voice in Voice settings.",
    );
    this.reason = reason;
    this.name = "NoVoiceConfigured";
  }
}

export const MAX_SPEAK_CHARS = 2000;
export const MAX_TRANSCRIBE_BYTES = 8 * 1024 * 1024;
