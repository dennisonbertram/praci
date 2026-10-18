import type { Meta, StoryObj } from "@storybook/react-vite";
import { items, readyItem } from "../../stories/fixtures/data-room";
import { Preview } from "./Preview";

const meta = {
  title: "DataRoom/Preview",
  component: Preview,
  args: {
    item: readyItem,
    folderPath: "Contracts / Sample vendor",
    onAction: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Failed: Story = { args: { item: items[2] } };
/** A PDF the browser can show: Open reads it in a new tab, Download saves it. */
export const Pdf: Story = {
  args: { item: { ...readyItem, name: "Sample agreement.pdf", mimeType: "application/pdf" } },
};
/** Read while AI reading was off: no tags yet, and the preview says why. */
export const Untagged: Story = {
  args: {
    item: {
      ...readyItem,
      facets: { ...readyItem.facets, docType: null, docDate: null, parties: [], summary: null },
    },
  },
};
