import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { TerminateDialog } from "./TerminateDialog";

const noop = () => undefined;
const meta = {
  title: "Cap table/Stakeholders/Terminate dialog",
  component: TerminateDialog,
  decorators: [withPageBehind()],
  args: {
    open: true,
    onOpenChange: noop,
    onDone: noop,
    stakeholders: [{ id: "sh-1", name: "Maya Fenwick" }],
  },
} satisfies Meta<typeof TerminateDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = {};

export const Several: Story = {
  args: {
    stakeholders: [
      { id: "sh-1", name: "Maya Fenwick" },
      { id: "sh-7", name: "Sam Whitlock" },
    ],
  },
};
