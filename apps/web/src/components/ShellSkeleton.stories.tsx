import type { Meta, StoryObj } from "@storybook/react-vite";
import { OPENING_SLOW_MS, OpeningSpace, ShellSkeleton } from "./ShellSkeleton";

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
