import type { Meta, StoryObj } from "@storybook/react-vite";
import { MercuryLine } from "./MercuryLine";

const meta = {
  title: "Fundraising/MercuryLine",
  component: MercuryLine,
  args: { onConnect: () => {}, onRefresh: () => {}, onReconnect: () => {} },
  decorators: [
    (Story) => (
      <div className="flex justify-end p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MercuryLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {
  args: { state: { status: "not_connected", lastSyncedAt: null, unreadable: 0 } },
};

/** The menu holds Refresh. */
export const Synced: Story = {
  args: { state: { status: "ok", lastSyncedAt: new Date().toISOString(), unreadable: 0 } },
};

/** The menu holds Refresh and Reconnect. */
export const SyncFailed: Story = {
  args: { state: { status: "error", lastSyncedAt: null, unreadable: 0 } },
};

/** Rows Mercury sent that could not be read are named; none were written. */
export const SomeUnreadable: Story = {
  args: { state: { status: "ok", lastSyncedAt: new Date().toISOString(), unreadable: 2 } },
};
