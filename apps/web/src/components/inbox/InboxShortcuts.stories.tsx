import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxShortcuts } from "./InboxShortcuts";

const meta = {
  title: "Inbox/InboxShortcuts",
  component: InboxShortcuts,
  args: { open: true, onClose: () => undefined },
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the dialog</p>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof InboxShortcuts>;
export default meta;

export const Open: StoryObj<typeof meta> = {};
