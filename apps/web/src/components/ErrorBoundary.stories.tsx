import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionLoadFailed } from "./ErrorBoundary";

const meta = {
  title: "Shell/Section load failed",
  component: SectionLoadFailed,
} satisfies Meta<typeof SectionLoadFailed>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
