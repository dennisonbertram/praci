import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  OPENING_SLOW_MS,
  OpeningSpace,
  ShellSkeleton,
  STILL_LOADING_MS,
  StillLoading,
  ThreadSkeleton,
} from "./ShellSkeleton";

const meta = {
  title: "Shell/ShellSkeleton",
  component: ShellSkeleton,
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShellSkeleton>;
export default meta;

export const Full: StoryObj<typeof meta> = {};

export const CenteredLine: StoryObj = {
  render: () => (
    <div className="flex h-64 bg-background">
      <OpeningSpace />
    </div>
  ),
};

export const SlowOpening: StoryObj = {
  render: () => (
    <div className="flex h-64 bg-background">
      <OpeningSpace />
    </div>
  ),
  parameters: {
    docs: { description: { story: "Appears after 8 seconds: Still opening with Try again." } },
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, OPENING_SLOW_MS + 200));
  },
};

export const LoadingThread: StoryObj = {
  render: () => (
    <div className="flex h-96 bg-background">
      <ThreadSkeleton />
    </div>
  ),
};

export const StillLoadingAfter20s: StoryObj = {
  render: () => (
    <div className="p-6">
      <StillLoading onRetry={() => undefined} />
    </div>
  ),
  parameters: {
    docs: { description: { story: "Appears after 20 seconds beside any page skeleton." } },
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, STILL_LOADING_MS + 200));
  },
};
