import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolCallLabel } from "./ToolCallLabel";

const meta = {
  title: "Chat/ToolCallLabel",
  component: ToolCallLabel,
  args: { name: "mcp__finance-brex__get_banking_transactions", state: "done" },
} satisfies Meta<typeof ToolCallLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};
export const Running: Story = { args: { state: "running" } };
export const Failed: Story = { args: { state: "failed" } };
export const WaitingForApproval: Story = {
  args: { name: "mcp__finance-brex__lock_card", state: "waiting" },
};
export const Repeated: Story = { args: { count: 3 } };

export const Kinds: Story = {
  render: () => (
    <div className="w-72 space-y-1">
      <ToolCallLabel name="mcp__finance-brex__list_cards" />
      <ToolCallLabel name="mcp__mercury__getAccounts" />
      <ToolCallLabel name="SLACK_FIND_CHANNELS" />
      <ToolCallLabel name="mail_search" />
      <ToolCallLabel name="mcp__finance-brex__create_purchasing_card" state="running" />
      <ToolCallLabel name="brex_get_card_by_id" service="Brex" state="failed" />
    </div>
  ),
};
