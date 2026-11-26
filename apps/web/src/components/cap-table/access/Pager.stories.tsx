import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pager } from "./Pager";

const meta = {
  title: "Cap table/Pager",
  component: Pager,
  args: { page: 2, pageSize: 25, total: 137, onPage: () => undefined },
} satisfies Meta<typeof Pager>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The second of six pages. */
export const Middle: Story = {};

/** The last page, partly filled. */
export const Last: Story = { args: { page: 6 } };
