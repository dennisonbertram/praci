import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { StoredMeetingsList } from "./StoredMeetingsList";

const meta = {
  title: "Integrations/StoredMeetingsList",
  component: StoredMeetingsList,
  parameters: { layout: "fullscreen" },
  beforeEach: () =>
    mockRpc({
      "meetings.list": {
        items: [
          { id: "m1", title: "Weekly sync", startedAt: "2026-10-19T10:00:00Z" },
          { id: "m2", title: "Board prep", startedAt: "2026-10-18T15:30:00Z" },
          { id: "m3", title: "Customer call", startedAt: "2026-10-16T09:00:00Z" },
        ],
        nextCursor: null,
      },
    }),
} satisfies Meta<typeof StoredMeetingsList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Meetings: Story = {};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "meetings.list": { items: [], nextCursor: null } }),
};

export const ConfirmingDelete: Story = {
  play: async ({ canvasElement }) => {
    const [first] = await within(canvasElement).findAllByRole("button", { name: "Delete" });
    if (first) await userEvent.click(first);
  },
};
