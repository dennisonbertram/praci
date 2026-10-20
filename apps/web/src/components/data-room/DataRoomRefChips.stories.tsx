import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataRoomRefChips } from "./DataRoomRefChips";

const meta = {
  title: "DataRoom/DataRoomRefChips",
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <DataRoomRefChips
      refs={[
        { id: "itm_1", name: "Sample agreement.pdf" },
        { id: "itm_2", name: "Sample budget.xlsx" },
        { id: "itm_3", name: "A sample file with a very long name that must be cut short.txt" },
      ]}
    />
  ),
} satisfies Meta;
export default meta;

/** Under a sent message: one chip per file, linking to it in the Data room. */
export const Default: StoryObj = {};
