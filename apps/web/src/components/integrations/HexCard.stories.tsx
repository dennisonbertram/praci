import type { LocalMeetingsStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { HexCard } from "./HexCard";

const connected = (extra: Partial<NonNullable<LocalMeetingsStatus>> = {}): LocalMeetingsStatus => ({
  connectionId: "conn_hex",
  status: "connected",
  syncedThrough: "2026-10-31T14:24:00Z",
  lastSyncedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  count: 12,
  ...extra,
});

const meta = {
  title: "Integrations/HexCard",
  component: HexCard,
  args: { available: true },
  decorators: [
    (Story) => (
      <div className="max-w-[360px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HexCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop on a Mac, before the user connected Hex. */
export const NotConnected: Story = {
  beforeEach: () => mockRpc({ "meetings.localStatus": null }),
};

export const Syncing: Story = {
  args: { outcome: "idle" },
  beforeEach: () =>
    mockRpc({
      "meetings.localStatus": connected({ lastSyncedAt: null, syncedThrough: null, count: 0 }),
    }),
};

export const Synced: Story = {
  args: { outcome: "ok" },
  beforeEach: () => mockRpc({ "meetings.localStatus": connected() }),
};

export const InstallHex: Story = {
  args: { outcome: "not_found" },
  beforeEach: () => mockRpc({ "meetings.localStatus": connected() }),
};

export const UpdateHex: Story = {
  args: { outcome: "update" },
  beforeEach: () => mockRpc({ "meetings.localStatus": connected() }),
};

export const CouldNotRead: Story = {
  args: { outcome: "failed" },
  beforeEach: () => mockRpc({ "meetings.localStatus": connected() }),
};

/** On the web or another desktop: read-only, with Disconnect. */
export const OnWeb: Story = {
  args: { available: false },
  beforeEach: () => mockRpc({ "meetings.localStatus": connected() }),
};

/** On the web with no connection the tile is not shown at all. */
export const HiddenOnWeb: Story = {
  args: { available: false },
  beforeEach: () => mockRpc({ "meetings.localStatus": null }),
};
