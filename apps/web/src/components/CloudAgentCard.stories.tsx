import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudAgentCard } from "./CloudAgentCard";

const block = {
  kind: "cloud_agent",
  agentId: "agent_demo",
  title: "Add a sample settings page",
  status: "running",
  url: "https://example.com/agents/demo",
  branch: "feat/sample-settings",
} as const;

const meta = {
  title: "Chat/Cloud agent card",
  component: CloudAgentCard,
  args: { block },
} satisfies Meta<typeof CloudAgentCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};
export const Finished: Story = { args: { block: { ...block, status: "finished" } } };
export const WithPullRequest: Story = {
  args: {
    block: { ...block, status: "finished", prUrl: "https://example.com/pull/42" },
  },
};
export const Failed: Story = { args: { block: { ...block, status: "failed" } } };
export const Cancelled: Story = { args: { block: { ...block, status: "cancelled" } } };
export const NoLinkOrBranch: Story = {
  args: { block: { ...block, url: "not a link", branch: undefined } },
};
export const LongTitle: Story = {
  args: {
    block: {
      ...block,
      title:
        "Refactor the sample import pipeline so that every step reports progress and can be retried on its own",
    },
  },
};
