import type { Meta, StoryObj } from "@storybook/react-vite";
import { DueSoonChip } from "./DueSoonChip";

const meta = {
  title: "Legal/DueSoonChip",
  component: DueSoonChip,
  args: { count: 3 },
} satisfies Meta<typeof DueSoonChip>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
