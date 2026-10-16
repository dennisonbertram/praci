import type { Meta, StoryObj } from "@storybook/react-vite";
import { items, readyItem } from "../../stories/fixtures/data-room";
import { Preview } from "./Preview";

const meta = {
  title: "DataRoom/Preview",
  component: Preview,
  args: {
    item: readyItem,
    folderPath: "Contracts / Sample vendor",
    onAction: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Failed: Story = { args: { item: items[2] } };
