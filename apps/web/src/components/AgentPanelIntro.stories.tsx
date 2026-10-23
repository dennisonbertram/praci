import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AgentPanelIntro } from "./AgentPanelIntro";

const meta = {
  title: "Pages/Agent panel intro",
  component: AgentPanelIntro,
  args: {
    description: "Answers questions about your bank, card, statement and crypto accounts.",
    suggestions: ["What is our runway?", "Where did spend go up this month?"],
    onPick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AgentPanelIntro>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sending: Story = { args: { disabled: true } };

export const NoDescription: Story = { args: { description: "" } };

/** No model is set up: the questions would only fail, so the panel offers Add a model. */
export const NeedsModel: Story = { args: { onAddModel: fn() } };

/** A full-page chat (Mercury, Carta) lines the intro up with the composer column. */
export const FullPage: Story = {
  args: { className: "md:px-[max(1.75rem,calc((100%-900px)/2))]" },
  decorators: [
    (Story) => (
      <div className="w-[1100px]">
        <Story />
      </div>
    ),
  ],
};
