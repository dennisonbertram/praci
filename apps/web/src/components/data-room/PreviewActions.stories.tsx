import type { Meta, StoryObj } from "@storybook/react-vite";
import { readyItem } from "../../stories/fixtures/data-room";
import { FileViewer, PreviewActions } from "./PreviewActions";

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

const samplePdf =
  "data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+Cg==";

/** A PDF in its frame; the browser's own toolbar is hidden so only Open and Download remain. */
export const PdfViewer: Story = {
  render: (args) => (
    <div className="h-80 w-full max-w-xl">
      <FileViewer item={args.item} file={{ url: samplePdf, failed: false }} fill />
    </div>
  ),
};
