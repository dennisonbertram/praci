import type { Meta, StoryObj } from "@storybook/react-vite";
import { XPostPreview } from "./XPostPreview";

const meta = {
  title: "GTM/X preview",
  component: XPostPreview,
  args: {
    text: "Looking for our first 50 design partners. https://example.com/early-access",
    accountLabel: "Demo company",
  },
} satisfies Meta<typeof XPostPreview>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
export const OverLimit: StoryObj<typeof meta> = { args: { text: "a".repeat(281) } };
export const Unicode: StoryObj<typeof meta> = { args: { text: "Hello 😀 中文 e\u0301" } };
