import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { RecordButtonView } from "./RecordButton";

const meta = {
  title: "Meetings/RecordButton",
  component: RecordButtonView,
  decorators: [
    (Story) => (
      <div className="flex min-h-72 justify-end p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecordButtonView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Remind: Story = {
  args: { availability: { loaded: true, policy: "remind", engine: true, device: false } },
};

export const RemindOpen: Story = {
  ...Remind,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /Record/ }));
  },
};

export const ConfirmOpen: Story = {
  args: { availability: { loaded: true, policy: "confirm", engine: true, device: false } },
  play: RemindOpen.play,
};

/** No speech-to-text engine: Record becomes a way to add one. */
export const NoEngine: Story = {
  args: { availability: { loaded: true, policy: "remind", engine: false, device: false } },
};

/** The space policy is off: nothing is drawn. */
export const PolicyOff: Story = {
  args: { availability: { loaded: true, policy: "off", engine: true, device: false } },
};
