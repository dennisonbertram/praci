import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { IntegrationAgentSection } from "./IntegrationAgentSection";

const meta = {
  title: "Integrations/IntegrationAgentSection",
  component: IntegrationAgentSection,
  args: {
    service: "Mercury",
    agentName: "Mercury agent",
    agentHref: "/app/bot_ada",
    writesEnabled: false,
    shared: false,
    disabled: false,
    onWrites: fn(),
    onShared: fn(),
    usedBy: <p className="text-sm">Per-agent list</p>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[520px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IntegrationAgentSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {};
export const ChangesAllowed: Story = { args: { writesEnabled: true } };
export const Shared: Story = { args: { writesEnabled: true, shared: true } };
export const Saving: Story = { args: { disabled: true } };
export const NoChangesSwitch: Story = {
  args: { service: "Devin", agentName: "Devin agent", onWrites: undefined },
};
