import type { Meta, StoryObj } from "@storybook/react-vite";
import { FinanceNotFound } from "./FinanceNotFound";

const meta = {
  title: "Finance/NotFound",
  component: FinanceNotFound,
} satisfies Meta<typeof FinanceNotFound>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
