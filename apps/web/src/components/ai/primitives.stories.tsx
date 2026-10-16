import type { Meta, StoryObj } from "@storybook/react-vite";
import { BuiCard, LoadingState, Shimmer, SuccessPop } from "./primitives";

const meta = {
  title: "AI/Primitives",
  parameters: {
    docs: { description: { component: "Also shows: DefaultLoadingState (inside LoadingState)" } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ShimmerLabel: Story = { render: () => <Shimmer>Thinking</Shimmer> };

export const Loading: Story = { render: () => <LoadingState /> };

export const LoadingCustomLabel: Story = {
  render: () => <LoadingState label="Reading the statement" startedAt={Date.now() - 65_000} />,
};

export const LoadingCustomIndicator: Story = {
  render: () => <LoadingState indicator={<span aria-hidden>...</span>} label="Sending" />,
};

export const Success: Story = { render: () => <SuccessPop label="Approved" /> };

export const Card: Story = {
  render: () => (
    <BuiCard className="w-72 p-4">
      <LoadingState label="Working" />
    </BuiCard>
  ),
};
