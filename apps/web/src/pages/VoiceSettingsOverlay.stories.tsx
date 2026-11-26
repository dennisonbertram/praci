import type {
  DesktopSpeechStatus,
  VoiceCatalogEntry,
  VoiceCredential,
  VoiceInfo,
  VoiceStatus,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc, resetRpcMocks } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { VoiceSettingsOverlay } from "./VoiceSettingsOverlay";

const catalog: VoiceCatalogEntry[] = [
  { id: "sample-speech", name: "Sample Speech", description: "Demo provider", transcribe: true },
  { id: "fish-audio", name: "Sample Fish", description: "Demo provider", transcribe: false },
];

const voices: VoiceInfo[] = [
  { id: "voice_a", label: "Alder", description: "Warm" },
  { id: "voice_b", label: "Birch" },
];

const credential = (provider: string): VoiceCredential => ({
  id: `cred_${provider}`,
  provider,
  hasKey: true,
  isDefault: true,
  voiceId: "voice_a",
  speechModel: "",
  transcribe: provider === "sample-speech",
});

const status: VoiceStatus = {
  configured: true,
  ready: true,
  transcribe: true,
  provider: "sample-speech",
  voiceId: "voice_a",
  transcriptionProvider: null,
  transcriptionReady: false,
};

const meta = {
  beforeEach: () => resetRpcMocks(),
  decorators: [withPageBehind()],
  title: "Settings/VoiceSettingsOverlay",
  component: VoiceSettingsOverlay,
  args: { onClose: () => undefined },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VoiceSettingsOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": catalog,
      "voice.credentials": [],
      "voice.status": { ...status, configured: false, ready: false, provider: null, voiceId: "" },
    }),
};

export const Connected: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": catalog,
      "voice.credentials": [credential("sample-speech")],
      "voice.status": status,
      "voice.voices": voices,
    }),
};

export const ConnectedWithSpeechModel: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": catalog,
      "voice.credentials": [credential("fish-audio")],
      "voice.status": { ...status, provider: "fish-audio" },
      "voice.voices": voices,
    }),
};

export const Embedded: Story = {
  args: { embedded: true },
  beforeEach: () =>
    mockRpc({
      "voice.catalog": catalog,
      "voice.credentials": [credential("sample-speech")],
      "voice.status": status,
      "voice.voices": voices,
    }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": () => new Promise(() => undefined),
      "voice.credentials": () => new Promise(() => undefined),
      "voice.status": () => new Promise(() => undefined),
    }),
};

/** A failed initial read gives the person a Try again action beside the error. */
export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": () => Promise.reject(new Error("Could not load voice settings")),
    }),
};

export const OpenAiCompatible: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": [
        {
          id: "openai-compatible",
          name: "OpenAI-compatible",
          description: "Demo provider",
          transcribe: true,
          speech: false,
        },
        ...catalog,
      ],
      "voice.credentials": [],
      "voice.status": { ...status, configured: false, ready: false, provider: null, voiceId: "" },
    }),
};

/** Opens the On this device row; a ready device is already selected. */
const openDeviceRow: Story["play"] = async ({ canvasElement }) => {
  await new Promise((resolve) => setTimeout(resolve, 50));
  [...canvasElement.querySelectorAll("button")]
    .find((button) => button.textContent?.includes("On this device"))
    ?.click();
};

const withSpeech = (state: DesktopSpeechStatus) => () => {
  const speech = {
    status: async () => state,
    prepare: async () => state,
    forget: async () => state,
    transcribe: async () => ({ ok: false as const, retry: false }),
    onStatus: () => () => undefined,
  };
  window.rakazoDesktop = { speech } as unknown as typeof window.rakazoDesktop;
  mockRpc({
    "voice.catalog": catalog,
    "voice.credentials": [],
    "voice.status": { ...status, configured: false, ready: false, provider: null, voiceId: "" },
  });
  return () => {
    window.rakazoDesktop = undefined;
  };
};

export const OnDeviceNotPrepared: Story = {
  args: { embedded: true },
  play: openDeviceRow,
  beforeEach: withSpeech({ state: "not-prepared" }),
};
export const OnDevicePreparing: Story = {
  args: { embedded: true },
  play: openDeviceRow,
  beforeEach: withSpeech({ state: "preparing", progress: 0.42 }),
};
export const OnDevicePreparingUnknown: Story = {
  args: { embedded: true },
  play: openDeviceRow,
  beforeEach: withSpeech({ state: "preparing", progress: null }),
};
export const OnDeviceReady: Story = {
  args: { embedded: true },
  beforeEach: withSpeech({ state: "ready" }),
};
export const OnDeviceError: Story = {
  args: { embedded: true },
  play: openDeviceRow,
  beforeEach: withSpeech({ state: "error" }),
};
