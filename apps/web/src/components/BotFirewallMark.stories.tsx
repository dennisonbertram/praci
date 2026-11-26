import type { Meta, StoryObj } from "@storybook/react-vite";
import { BotFirewallMark } from "./BotFirewallMark";

const meta = {
  title: "Shell/Bot firewall mark",
  component: BotFirewallMark,
} satisfies Meta<typeof BotFirewallMark>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Next to a bot name in the chat header. */
export const BesideName: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-[16px] font-medium text-foreground">Support</span>
      <BotFirewallMark />
    </div>
  ),
};
