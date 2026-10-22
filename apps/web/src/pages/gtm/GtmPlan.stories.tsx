import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { item, overview } from "./fixtures";
import { GtmPlan } from "./GtmPlan";

const meta = {
  title: "GTM/Plan",
  component: GtmPlan,
  args: { title: "Needs you", items: overview.groups.needs_you, overview, onChange: () => {} },
  parameters: { docs: { description: { component: "Also shows: GtmItem" } } },
} satisfies Meta<typeof GtmPlan>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Uncertain: Story = {
  args: { items: [{ ...item, proof: `post:demo:${"a".repeat(64)}` }] },
  beforeEach: () => mockRpc({ "gtm.queue": { status: "ready", complete: true, posts: [] } }),
};
export const Conflict: Story = {
  beforeEach: () => mockRpc({ "scratchpad.update": () => Promise.reject({ code: "CONFLICT" }) }),
};
