import type { DataRoomApiProcessing } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProcessingStrip } from "./ProcessingStrip";

const base: DataRoomApiProcessing = {
  reading: 412,
  indexing: 300,
  tagging: 125,
  failed: 0,
  current: "Sample agreement.pdf",
};

const meta = {
  title: "DataRoom/ProcessingStrip",
  component: ProcessingStrip,
  args: { processing: base, total: 1_104 },
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessingStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Just after a large import: most files are still being read. */
export const Active: Story = {};
/** Nearly through: only indexing is left. */
export const MostlyDone: Story = {
  args: { processing: { ...base, reading: 0, tagging: 0, indexing: 12 }, total: 1_104 },
};
/** Failed files are not mentioned here: the list row and the sidebar badge show them. */
export const WithFailures: Story = {
  args: { processing: { ...base, reading: 40, indexing: 0, tagging: 6, failed: 3 }, total: 200 },
};
/** The few seconds after the last file is processed. */
export const Done: Story = {
  args: { processing: { ...base, reading: 0, indexing: 0, tagging: 0 }, finished: true },
};

/** Imports still running share the line with the processing count. */
export const WithImport: Story = {
  args: { importing: { done: 399, total: 1_104 } },
};
