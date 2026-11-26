import type { Meta, StoryObj } from "@storybook/react-vite";
import { DictationButton, DictationError } from "./dictation-button";

const meta = {
  title: "Shell/DictationButton",
  component: DictationButton,
  args: { status: "idle", onClick: () => undefined },
} satisfies Meta<typeof DictationButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Listening: Story = { args: { status: "listening" } };
export const Transcribing: Story = { args: { status: "transcribing" } };
export const Disabled: Story = { args: { disabled: true } };
export const Failed: StoryObj = {
  render: () => <DictationError message="Could not transcribe that recording." />,
};
