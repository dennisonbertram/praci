import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { BulkImportDialog } from "./BulkImportDialog";

const meta = {
  title: "Cap table/Stakeholders/Bulk import",
  component: BulkImportDialog,
  decorators: [withPageBehind()],
  args: {
    open: true,
    onOpenChange: () => undefined,
    customProperties: [],
    onDone: () => undefined,
  },
} satisfies Meta<typeof BulkImportDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Add: Story = { args: { mode: "add" } };

export const Update: Story = { args: { mode: "update" } };
