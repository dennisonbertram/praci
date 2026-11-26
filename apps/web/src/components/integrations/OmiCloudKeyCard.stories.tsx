import type { OmiCloudStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { OmiCloudKeyCard } from "./OmiCloudKeyCard";

const connected: NonNullable<OmiCloudStatus> = {
  connectionId: "conn_omi_cloud",
  status: "connected",
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 12,
  agentBotId: "bot_omi",
};

const meta = {
  title: "Integrations/OmiCloudKeyCard",
  component: OmiCloudKeyCard,
  args: { status: null, onChanged: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-[520px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OmiCloudKeyCard>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openAndConnect(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Use an Omi key" }));
  await userEvent.type(canvas.getByLabelText("Omi developer key"), "omi_dev_demo");
  await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
}

export const LinkOnly: Story = {};
export const FormOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Use an Omi key" }));
  },
};
export const Connecting: Story = {
  beforeEach: () => mockRpc({ "omiCloud.connect": () => new Promise(() => undefined) }),
  play: async ({ canvasElement }) => openAndConnect(canvasElement),
};
export const Syncing: Story = { args: { status: { ...connected, syncedThrough: null } } };
export const FirstImport: Story = {
  args: { status: { ...connected, syncedThrough: null, syncedCount: 12 } },
};
export const RemovedMeetingsKept: Story = {
  args: { status: { ...connected, status: "disconnected" } },
};
export const Connected: Story = { args: { status: connected } };
export const ReconnectNeeded: Story = {
  args: { status: { ...connected, status: "needs_reconnect" } },
};
export const KeyRejected: Story = {
  beforeEach: () =>
    mockRpc({
      "omiCloud.connect": () => {
        throw new Error("Omi rejected this key");
      },
    }),
  play: async ({ canvasElement }) => openAndConnect(canvasElement),
};
export const McpKey: Story = {
  beforeEach: () =>
    mockRpc({
      "omiCloud.connect": () => {
        throw new Error("This is an MCP key. Create a Developer key in the Omi app.");
      },
    }),
  play: async ({ canvasElement }) => openAndConnect(canvasElement),
};
export const Unreachable: Story = {
  beforeEach: () =>
    mockRpc({
      "omiCloud.connect": () => {
        throw new Error("Could not reach Omi");
      },
    }),
  play: async ({ canvasElement }) => openAndConnect(canvasElement),
};
