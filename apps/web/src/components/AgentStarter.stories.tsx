import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentStarter } from "./AgentStarter";

const meta = {
  title: "Shell/Agent starter",
  component: AgentStarter,
  parameters: { layout: "padded" },
  args: {
    description:
      "The Carta agent reads your cap table from Carta and answers questions about it. Try one:",
    prompts: [
      "Who owns what?",
      "How much of the option pool is left?",
      "Which SAFEs are unconverted?",
    ],
    onPick: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentStarter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** While a message is being sent the questions cannot be picked again. */
export const Sending: Story = { args: { disabled: true } };
