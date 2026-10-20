import type { Meta, StoryObj } from "@storybook/react-vite";
import { readyItem } from "../../stories/fixtures/data-room";
import { PreviewActions } from "./PreviewActions";

const meta = {
  title: "DataRoom/PreviewActions",
  component: PreviewActions,
  args: {
    item: { ...readyItem, name: "Sample agreement.pdf", mimeType: "application/pdf" },
    hidden: false,
    onError: () => undefined,
    onFullScreen: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-1 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PreviewActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** The browser cannot show this type, so Open is disabled; Download still works. */
export const OpenDisabled: Story = {
  args: { item: { ...readyItem, name: "Sample notes.docx", mimeType: "application/zip" } },
};
/** Amounts are hidden, so the file's contents are not opened. */
export const AmountsHidden: Story = { args: { hidden: true } };
