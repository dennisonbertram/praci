import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../stories/decorators";
import { InboxShortcuts } from "./InboxShortcuts";

const meta = {
  title: "Inbox/InboxShortcuts",
  component: InboxShortcuts,
  args: { open: true, onClose: () => undefined },
  decorators: [withPageBehind()],
} satisfies Meta<typeof InboxShortcuts>;
export default meta;

export const Open: StoryObj<typeof meta> = {};
