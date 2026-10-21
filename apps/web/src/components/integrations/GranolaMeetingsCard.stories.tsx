import type { MeetingsStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { GranolaMeetingsCard } from "./GranolaMeetingsCard";

const connected: NonNullable<MeetingsStatus> = {
  connectionId: "conn_demo",
  status: "connected",
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 12,
  consentOff: false,
  agentBotId: "bot_granola",
};

const meta = {
  title: "Integrations/GranolaMeetingsCard",
  component: GranolaMeetingsCard,
  args: {
    status: null,
    bothRoutes: false,
    agentName: "Granola agent",
    onChanged: fn(),
    onOpenAiDataSharing: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-[520px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GranolaMeetingsCard>;
export default meta;
type Story = StoryObj<typeof meta>;

async function typeKeyAndConnect(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByLabelText(/Granola API key/, { selector: "input" }), "demo-key");
  await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
}

export const Empty: Story = {};

/** The connect call never settles, so the button stays on "Connecting…". */
export const Connecting: Story = {
  beforeEach: () => mockRpc({ "meetings.connect": () => new Promise(() => undefined) }),
  play: ({ canvasElement }) => typeKeyAndConnect(canvasElement),
};

export const Rejected: Story = {
  beforeEach: () =>
    mockRpc({
      "meetings.connect": () => Promise.reject(new Error("Granola rejected this key")),
    }),
  play: ({ canvasElement }) => typeKeyAndConnect(canvasElement),
};

export const CouldNotReach: Story = {
  beforeEach: () =>
    mockRpc({ "meetings.connect": () => Promise.reject(new Error("Could not reach Granola")) }),
  play: ({ canvasElement }) => typeKeyAndConnect(canvasElement),
};

export const Syncing: Story = { args: { status: { ...connected, syncedThrough: null } } };
export const Synced: Story = { args: { status: connected } };
export const SyncedOne: Story = { args: { status: { ...connected, syncedCount: 1 } } };
export const SyncLate: Story = {
  args: { status: { ...connected, lastSyncedAt: "2026-10-18T10:00:00Z" } },
};
export const NeedsReconnect: Story = {
  args: { status: { ...connected, status: "needs_reconnect" } },
};
export const ConsentOff: Story = { args: { status: { ...connected, consentOff: true } } };
export const Disconnected: Story = { args: { status: { ...connected, status: "disconnected" } } };
export const NoAgent: Story = { args: { status: { ...connected, agentBotId: null } } };
export const BothRoutesConnected: Story = { args: { status: connected, bothRoutes: true } };
