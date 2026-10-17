import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupIntro } from "./GroupIntro";

const meta = {
  title: "Chat/Group intro",
  component: GroupIntro,
  args: {
    members: [
      { botId: "bot_1", name: "Chief", color: "#3BA776" },
      { botId: "bot_2", name: "Legal Desk", color: "#3B82F6" },
      { botId: "bot_3", name: "Investor Relations", color: "#F97316" },
    ],
    onAsk: () => undefined,
  },
} satisfies Meta<typeof GroupIntro>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeMembers: Story = {};
export const TwoMembers: Story = {
  args: {
    members: [
      { botId: "bot_1", name: "Chief", color: "#3BA776" },
      { botId: "bot_2", name: "Legal Desk", color: "#3B82F6" },
    ],
  },
};
