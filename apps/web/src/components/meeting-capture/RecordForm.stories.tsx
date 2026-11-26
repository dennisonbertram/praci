import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecordForm } from "./RecordForm";

const meta = {
  title: "Meetings/RecordForm",
  component: RecordForm,
  args: { policy: "remind", onStart: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-72 rounded-lg bg-popover p-2.5 shadow-md ring-1 ring-foreground/10">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecordForm>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The space asks the person to tell everyone. */
export const Remind: Story = {};

/** Start waits for the box. */
export const Confirm: Story = { args: { policy: "confirm" } };

export const WithTabAudio: Story = { args: { tabAudioAvailable: true } };

/** The desktop app records call audio without a picker, so the box starts checked. */
export const DesktopCallAudio: Story = { args: { tabAudioAvailable: true, systemAudio: true } };

export const Starting: Story = { args: { busy: true } };

export const MicrophoneBlocked: Story = {
  args: { error: "Microphone access is blocked. Allow it in your browser and try again." },
};
