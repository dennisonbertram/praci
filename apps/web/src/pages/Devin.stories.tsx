import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { DevinPage } from "./Devin";
import {
  connectorGone,
  emptyOverview,
  notConnected,
  notConnectedMember,
  overview,
  rejected,
} from "./devin/fixtures";

const never = () => new Promise(() => {});
const fails = () => Promise.reject(new Error("Could not reach the server"));

const meta = {
  title: "Devin/Page",
  component: DevinPage,
  args: { onAskAgent: () => {}, onConnect: () => {}, onReconnect: () => {} },
} satisfies Meta<typeof DevinPage>;
export default meta;

type Story = StoryObj<typeof meta>;
const reads = (data: unknown) => () => mockRpc({ "devin.sessions": data });

export const Default: Story = { beforeEach: reads(overview) };

/** A 600 px pane: below the container's `@2xl`, so the compact list replaces the table. */
export const Narrow: Story = {
  beforeEach: reads(overview),
  decorators: [
    (Story) => (
      <div className="flex h-[900px] w-[600px]">
        <Story />
      </div>
    ),
  ],
};

/** A member who did not connect Devin: the same rows, no Ask. */
export const Member: Story = {
  beforeEach: reads({
    ...overview,
    connection: { ...overview.connection, manage: false, isConnector: false, agentBotId: null },
  }),
};

export const Empty: Story = { beforeEach: reads(emptyOverview) };

/** The last read is old: the header says how old, and some sessions could not be read. */
export const StalePartial: Story = {
  beforeEach: reads({ ...overview, stale: true, partial: true }),
};

export const Rejected: Story = { beforeEach: reads(rejected) };

export const RejectedMember: Story = {
  beforeEach: reads({ ...rejected, connection: { ...rejected.connection, manage: false } }),
};

export const ConnectorGone: Story = { beforeEach: reads(connectorGone) };

export const NotConnectedOwner: Story = { beforeEach: reads(notConnected) };

export const NotConnectedMember: Story = { beforeEach: reads(notConnectedMember) };

/** The first read worked; a later one failed. The rows stay and the notice says so. */
export const RefreshFailed: Story = {
  beforeEach: () => {
    let count = 0;
    mockRpc({
      "devin.sessions": () => (count++ === 0 ? Promise.resolve(overview) : fails()),
    });
  },
  play: async () => {
    window.dispatchEvent(new Event("focus"));
  },
};

export const Loading: Story = { beforeEach: () => mockRpc({ "devin.sessions": never }) };

export const LoadError: Story = { beforeEach: () => mockRpc({ "devin.sessions": fails }) };
