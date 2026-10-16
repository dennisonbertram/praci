import type { Meta, StoryObj } from "@storybook/react-vite";
import type { GroupAvatarMember } from "./group-avatar";
import { GroupAvatar } from "./group-avatar";

const members: GroupAvatarMember[] = [
  { botId: "bot_a", name: "Ada", color: "#7c3aed" },
  { botId: "bot_b", name: "Ben", color: "#0ea5e9" },
  { botId: "bot_c", name: "Cy", color: "#10b981" },
  { botId: "bot_d", name: "Dee", color: "#f59e0b" },
  { botId: "bot_e", name: "Eli", color: "#ef4444" },
];

const meta = {
  title: "UI/Group avatar",
  component: GroupAvatar,
  args: { members, size: 48 },
} satisfies Meta<typeof GroupAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoMembers: Story = { args: { members: [] } };
export const OneMember: Story = { args: { members: members.slice(0, 1) } };
export const Pair: Story = { args: { members: members.slice(0, 2) } };
export const Three: Story = { args: { members: members.slice(0, 3) } };
export const FiveWithCount: Story = {};
export const Large: Story = { args: { size: 96 } };
export const WithRunningMember: Story = {
  args: {
    members: [
      { botId: "bot_a", name: "Ada", color: "#7c3aed", status: "running" },
      ...members.slice(1, 2),
    ],
  },
};
