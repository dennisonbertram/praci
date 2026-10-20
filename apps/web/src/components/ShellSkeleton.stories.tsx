import type { Meta, StoryObj } from "@storybook/react-vite";
import { OpeningSpace, ShellSkeleton } from "./ShellSkeleton";

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
