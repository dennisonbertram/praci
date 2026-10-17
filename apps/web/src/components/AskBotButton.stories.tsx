import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AskBotButton } from "./AskBotButton";

const meta = {
  title: "Pages/Ask bot button",
  component: AskBotButton,
  args: { botName: "Finance agent", onClick: fn() },
} satisfies Meta<typeof AskBotButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InboxBot: Story = { args: { botName: "Inbox agent" } };
