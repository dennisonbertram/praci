import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./skeleton";

const meta = { title: "UI/Skeleton", component: Skeleton } satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { className: "h-4 w-48" } };

export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  ),
};

/** Static: no pulse, for an empty section that keeps its layout. */
export const Static: Story = { args: { className: "h-4 w-48", static: true } };
