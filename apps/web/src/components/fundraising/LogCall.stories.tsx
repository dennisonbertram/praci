import type { Meta, StoryObj } from "@storybook/react-vite";
import { toPipelineRow } from "../../lib/pipeline-rows";
import { LogCallBody } from "./LogCall";
import { SAMPLE_PROSPECTS } from "./pipeline-fixtures";

const [due, , , tomorrow] = SAMPLE_PROSPECTS.map(toPipelineRow);

const meta = {
  title: "Fundraising/LogCall",
  component: LogCallBody,
  args: { onSave: () => {}, onCancel: () => {} },
  decorators: [
    (Story) => (
      <div className="w-96 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LogCallBody>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An overdue row: "Keep" leaves the date, so the row stays due until a new date or None is chosen. */
export const KeepsOldDate: Story = { args: { row: due! } };

/** A row with no date defaults to None. */
export const NoDate: Story = { args: { row: { ...tomorrow!, nextCallAt: null } } };
