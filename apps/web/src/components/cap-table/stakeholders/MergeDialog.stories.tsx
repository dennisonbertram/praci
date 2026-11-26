import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { MergeDialog } from "./MergeDialog";

const meta = {
  title: "Cap table/Stakeholders/Merge dialog",
  component: MergeDialog,
  decorators: [withPageBehind()],
  args: {
    open: true,
    onOpenChange: () => undefined,
    onDone: () => undefined,
    stakeholders: [
      { id: "sh-1", name: "Maya Fenwick", contactEmail: "maya@example.test" },
      { id: "sh-9", name: "Maya Fenwick (old)", contactEmail: "m.fenwick@example.test" },
    ],
  },
} satisfies Meta<typeof MergeDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoSelected: Story = {};
