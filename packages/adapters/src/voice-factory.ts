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
import { SCRIPTED_VOICE_CATALOG_ENTRY, ScriptedVoiceProvider } from "./scripted-voice.js";

export const VOICE_CATALOG = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Highest quality and cloning. Flash v2.5 for conversational calls.",
    transcribe: true,
    speech: true,
    transcription: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Simple TTS plus Whisper-class transcription. Reuse an OpenAI key.",
    transcribe: true,
    speech: true,
    transcription: true,
  },
  {
    id: "cartesia",
    name: "Cartesia",
    description: "Lowest-latency Sonic voices for interruptible calls.",
    transcribe: false,
    speech: true,
    transcription: false,
  },
  {
    id: "fish-audio",
    name: "Fish Audio",
    description: "Voice models, cloning, and expressive speech with optional transcription.",
    transcribe: true,
    speech: true,
    transcription: true,
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

/** Wrap a transcription provider with the checks every provider shares. */
export function guardTranscription(inner: TranscriptionProvider): TranscriptionProvider {
  return {
    describe: () => inner.describe(),
    verify: (apiKey, context) => inner.verify(apiKey, context),
    async transcribe(request: VoiceTranscribeRequest, context: AdapterContext) {
      const signal = request.signal ?? context.signal;
      if (request.audio.byteLength === 0 || request.audio.byteLength > MAX_TRANSCRIBE_BYTES) {
        throw new Error("That recording is empty or too large.");
      }
      if (signal.aborted) throw new Error("Transcription was cancelled.");
      const capped = {
        ...request,
        context: request.context ? capTranscriptionContext(request.context) : undefined,
      };
      try {
        return await inner.transcribe(capped, context);
      } catch (error) {
        // Never let the key reach a user-visible message.
        const message = error instanceof Error ? error.message : "Transcription failed.";
        throw new Error(request.apiKey ? message.split(request.apiKey).join("[key]") : message);
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
