import type { VoiceCatalogEntry, VoiceCredential, VoiceInfo, VoiceStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc, resetRpc } from "../stories/fixtures-2";
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
};

const meta = {
  beforeEach: () => resetRpc(),
  decorators: [
    (Story) => (
      <>
        {/* The dialog renders in a portal, so a page behind it keeps the story root non-empty. */}
        <div aria-hidden className="h-screen bg-muted/30" />
        <Story />
      </>
    ),
  ],
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

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "voice.catalog": () => Promise.reject(new Error("Could not load voice settings")),
    }),
};
