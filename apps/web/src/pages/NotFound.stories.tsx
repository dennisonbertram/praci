import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotFoundPage } from "./NotFound";

const meta = {
  title: "Pages/Not found",
  component: NotFoundPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NotFoundPage>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
