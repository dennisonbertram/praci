import type { Meta, StoryObj } from "@storybook/react-vite";
import { useListParams } from "../../lib/list-params";
import { SORT_FIELDS, toPipelineRow } from "../../lib/pipeline-rows";
import { PipelineFilter, pipelineFilters } from "./PipelineFilter";
import { SAMPLE_PROSPECTS } from "./pipeline-fixtures";

const rows = SAMPLE_PROSPECTS.map(toPipelineRow);

function Demo() {
  const list = useListParams(SORT_FIELDS, { field: "nextCall", dir: "asc" });
  return (
    <PipelineFilter
      filters={pipelineFilters(rows)}
      list={list}
      sortFields={[
        ["name", "Prospect"],
        ["status", "Status"],
        ["nextCall", "Next call"],
      ]}
    />
  );
}

const meta = {
  title: "Fundraising/PipelineFilter",
  component: Demo,
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
/** Two filters on: the button reads "Filter · 2" and offers Clear filters. */
export const TwoActive: Story = { parameters: { initialEntries: ["/?status=met&interest=maybe"] } };
