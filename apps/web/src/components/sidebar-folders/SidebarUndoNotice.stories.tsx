import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SidebarUndoNotice } from "./SidebarUndoNotice";

const meta = {
  title: "Shell/Sidebar folders/Undo notice",
  component: SidebarUndoNotice,
  parameters: { layout: "fullscreen" },
  args: { message: "Auto-grouped", onUndo: fn(), onDismiss: fn() },
  decorators: [(Story) => <div className="h-40 bg-background">{Story()}</div>],
} satisfies Meta<typeof SidebarUndoNotice>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
