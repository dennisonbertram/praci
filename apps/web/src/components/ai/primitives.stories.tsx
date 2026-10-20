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

export const LoadingWithStep: Story = {
  render: () => (
    <LoadingState
      label="Searching your mail"
      startedAt={Date.now() - 4_000}
      detail={'Searching mail: from Kevin · after Oct 1 · "pick a time"'}
    />
  ),
};

export const LoadingQuiet: Story = {
  render: () => (
    <LoadingState
      label="Searching your mail"
      startedAt={Date.now() - 20_000}
      detail="Searching mail: from Kevin · after Oct 1"
      detailSince={Date.now() - 18_000}
      waitingLabel="Still waiting on Gmail"
    />
  ),
};

export const LoadingStillWaiting: Story = {
  render: () => (
    <LoadingState
      label="Searching your mail"
      startedAt={Date.now() - 95_800}
      detail="Gmail is limiting requests, retrying"
      detailSince={Date.now() - 50_000}
      waitingLabel="Still waiting on Gmail"
    />
  ),
};

export const Success: Story = { render: () => <SuccessPop label="Approved" /> };

export const Card: Story = {
  render: () => (
    <BuiCard className="w-72 p-4">
      <LoadingState label="Working" />
    </BuiCard>
  ),
};
