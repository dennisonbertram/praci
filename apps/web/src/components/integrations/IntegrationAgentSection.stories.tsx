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
    exclusive: false,
    disabled: false,
    onWrites: fn(),
    onExclusive: fn(),
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
export const OnlyThisAgent: Story = { args: { writesEnabled: true, exclusive: true } };
export const Saving: Story = { args: { disabled: true } };
