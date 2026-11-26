import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { RecordingPillHost } from "./RecordingPillHost";

const meta = {
  title: "Meetings/RecordingPillHost",
  component: RecordingPillHost,
  decorators: [
    (Story) => (
      <div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecordingPillHost>;
export default meta;
type Story = StoryObj<typeof meta>;

/** With no capture running the host draws nothing; the pill's own states are in RecordingPill. */
export const NothingRecording: Story = {
  beforeEach: () => mockRpc({ "meetingCaptures.active": null }),
};
