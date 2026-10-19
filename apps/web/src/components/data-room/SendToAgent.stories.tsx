import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { SendToAgentMenu } from "./SendToAgent";

const agents = [
  { id: "bot_ada", name: "Ada", color: "#6366f1" },
  { id: "bot_ben", name: "Ben", color: "#10b981" },
  { id: "bot_cy", name: "A helper with a very long name", color: "#f59e0b" },
];

const meta = {
  title: "DataRoom/SendToAgent",
  decorators: [
    (Story) => (
      <div className="flex h-72 justify-center pt-4">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={<Button variant="outline">File menu</Button>} />
      <DropdownMenuContent className="min-w-36">
        <SendToAgentMenu menu="dropdown" agents={agents} onPick={() => undefined} />
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Closed: Story = {};

/** The agents, with their avatars and colours, most recent first. */
export const Open: Story = {
  play: async () => {
    await userEvent.click(
      await within(document.body).findByRole("menuitem", { name: "Send to agent" }),
    );
  },
};
