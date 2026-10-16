import type { Meta, StoryObj } from "@storybook/react-vite";
import { ModelPreflightFeedback } from "./ModelConnectionPreflightNotice";

const meta = {
  title: "Shell/Model preflight feedback",
  component: ModelPreflightFeedback,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ModelPreflightFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { success: "Connection works.", failure: null } };

export const Failure: Story = {
  args: {
    success: null,
    failure: {
      outcome: "unauthorized",
      message: "The provider rejected the API key.",
      nextAction: "Check the key and try again.",
    },
  },
};
