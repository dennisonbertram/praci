import type { Meta, StoryObj } from "@storybook/react-vite";
import { RowsSkeleton } from "./RowsSkeleton";

const meta = {
  title: "Shell/RowsSkeleton",
  component: RowsSkeleton,
  decorators: [
    (Story) => (
      <div className="w-[min(640px,100vw)] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RowsSkeleton>;
export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Few: StoryObj<typeof meta> = { args: { rows: 3 } };
