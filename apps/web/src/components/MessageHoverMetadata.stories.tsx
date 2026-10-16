import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageHoverMetadata } from "./MessageHoverMetadata";

const meta = {
  title: "Chat/MessageHoverMetadata",
  component: MessageHoverMetadata,
  decorators: [
    (Story) => (
      <div className="group/message relative mx-auto my-8 w-64 rounded-2xl bg-muted p-3 text-sm">
        A sample message bubble. Hover it to reveal the rail.
        <Story />
      </div>
    ),
  ],
  args: { children: <span className="text-xs text-muted-foreground">10:42 AM</span> },
} satisfies Meta<typeof MessageHoverMetadata>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = { args: { side: "start" } };
export const End: Story = { args: { side: "end" } };
export const Pinned: Story = { args: { side: "end", pinned: true } };
