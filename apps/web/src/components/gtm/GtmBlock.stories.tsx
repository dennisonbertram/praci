import type { Meta, StoryObj } from "@storybook/react-vite";
import { overview } from "../../pages/gtm/fixtures";
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
export const Empty: Story = {
  args: { block: { type: "gtm-plan", query: { group: "drafts", channel: ["linkedin"] } } },
};
