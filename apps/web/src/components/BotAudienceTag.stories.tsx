import type { Meta, StoryObj } from "@storybook/react-vite";
import { BotAudienceTag } from "./BotAudienceTag";

const meta = {
  title: "Shell/Bot audience tag",
  component: BotAudienceTag,
} satisfies Meta<typeof BotAudienceTag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Next to a bot name in the chat header. */
export const BesideName: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-[16px] font-medium text-foreground">Support</span>
      <BotAudienceTag />
    </div>
  ),
};
