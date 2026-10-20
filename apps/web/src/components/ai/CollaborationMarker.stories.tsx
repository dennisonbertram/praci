import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActiveBotGlyph, CollaborationMarker } from "./CollaborationMarker";

const meta = {
  title: "Chat/CollaborationMarker",
  component: CollaborationMarker,
  args: {
    ariaLabel: "Open the exchange between Scout and Ledger",
    color: "#7c6cf0",
    identity: "scout",
    label: "Scout asked Ledger for last month's totals",
    onClick: () => undefined,
  },
  parameters: { docs: { description: { component: "Also shows: ActiveBotGlyph" } } },
} satisfies Meta<typeof CollaborationMarker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongLabel: Story = {
  render: (args) => (
    <div className="w-64">
      <CollaborationMarker
        {...args}
        label="Scout asked Ledger for the quarterly totals across every connected account and category"
      />
    </div>
  ),
};

export const WithActiveBots: Story = {
  render: () => (
    <ActiveBotGlyph
      label="Scout and Ledger are working"
      startedAt={Date.now()}
      bots={[
        { botId: "bot_scout", name: "Scout", color: "#7c6cf0" },
        { botId: "bot_ledger", name: "Ledger", color: "#e0703c" },
      ]}
    />
  ),
};

export const WithRunPhase: Story = {
  render: () => (
    <ActiveBotGlyph
      label="Starting"
      detail="Connecting to Devin"
      detailSince={Date.now() - 20_000}
      waitingLabel="Still waiting on Devin"
      startedAt={Date.now() - 20_000}
      bots={[{ botId: "bot_scout", name: "Scout", color: "#7c6cf0" }]}
    />
  ),
};
