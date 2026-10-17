import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { InboxAgentIntro } from "./InboxAgentIntro";

const meta = {
  title: "Inbox/Agent intro",
  component: InboxAgentIntro,
  args: { onAsk: fn() },
  decorators: [
    (Story) => (
      <div className="flex h-[420px] w-[370px] flex-col border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InboxAgentIntro>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The panel before the first message. */
export const Empty: Story = {};
