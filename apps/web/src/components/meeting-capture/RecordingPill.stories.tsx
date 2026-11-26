import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecordingPill } from "./RecordingPill";

const meta = {
  title: "Meetings/RecordingPill",
  component: RecordingPill,
  args: { onStop: () => undefined },
  decorators: [
    (Story) => (
      <div className="flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecordingPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Recording: Story = {
  args: { state: { kind: "recording", title: "Pricing review with Dana", elapsedMs: 754_000 } },
};

export const NoCallAudio: Story = {
  args: {
    state: {
      kind: "recording",
      title: "Pricing review with Dana",
      elapsedMs: 754_000,
      noCallAudio: true,
    },
  },
};

/** After a reload: the call tab can be shared again from the warning. */
export const ShareTabAgain: Story = {
  args: {
    state: {
      kind: "recording",
      title: "Pricing review with Dana",
      elapsedMs: 754_000,
      noCallAudio: true,
    },
    onShareTab: () => undefined,
  },
};

/** Desktop: the warning offers to record call audio again. */
export const DesktopNoCallAudio: Story = {
  args: {
    state: {
      kind: "recording",
      title: "Pricing review with Dana",
      elapsedMs: 754_000,
      noCallAudio: true,
    },
    onShareTab: () => undefined,
    systemAudio: true,
  },
};

/** Recording call audio again failed on macOS. */
export const DesktopCallAudioError: Story = {
  args: {
    ...DesktopNoCallAudio.args,
    state: {
      kind: "recording",
      title: "Pricing review with Dana",
      elapsedMs: 754_000,
      noCallAudio: true,
      callAudioError:
        "Praci can't hear call audio. In System Settings, open Privacy & Security, then Screen & System Audio Recording, and turn on Praci.",
    },
  },
};

export const Offline: Story = {
  args: {
    state: {
      kind: "recording",
      title: "Pricing review with Dana",
      elapsedMs: 754_000,
      offline: true,
    },
  },
};

export const Transcribing: Story = { args: { state: { kind: "transcribing" } } };

/** Uploads are retried; the chunks wait on this computer. */
export const TranscribingOffline: Story = {
  args: { state: { kind: "transcribing", offline: true } },
};

export const MicrophoneStopped: Story = {
  args: { state: { kind: "transcribing", micStopped: true } },
};

export const Closed: Story = {
  args: {
    state: { kind: "failed", message: "This recording was closed and could not be saved." },
    onDismiss: () => undefined,
  },
};

export const LongRecording: Story = {
  args: {
    state: {
      kind: "recording",
      title: "Quarterly planning with the whole leadership team and the board",
      elapsedMs: 3_725_000,
    },
  },
  globals: { viewport: { value: "mobile1" } },
};
