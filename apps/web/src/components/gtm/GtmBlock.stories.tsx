import type { Meta, StoryObj } from "@storybook/react-vite";
import { overview } from "../../pages/gtm/fixtures";
import { withVisibleRoot } from "../../stories/decorators";
import { GtmBlock } from "./GtmBlock";

const meta = {
  title: "GTM/Live block",
  component: GtmBlock,
  args: { overview, onChange: () => {}, block: { type: "gtm-plan", query: { group: "drafts" } } },
} satisfies Meta<typeof GtmBlock>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Plan: Story = {};
export const FilteredPlan: Story = {
  args: { block: { type: "gtm-plan", query: { group: "done", channel: ["x"], limit: 3 } } },
};
export const Channels: Story = { args: { block: { type: "gtm-channels", query: {} } } };
export const Metric: Story = {
  args: { block: { type: "gtm-metric", query: { label: "Completed", count: "done", goal: 50 } } },
};
/** Nothing matches, so the block renders nothing. */
export const Empty: Story = {
  decorators: [withVisibleRoot("No drafts match, so the block is hidden.")],
  args: { block: { type: "gtm-plan", query: { group: "drafts", channel: ["linkedin"] } } },
};
