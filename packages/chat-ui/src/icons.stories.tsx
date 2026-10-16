import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon, CopyIcon, GlobeIcon, ImageIcon } from "./icons";

const meta = { title: "Chat/Icons" } satisfies Meta;
export default meta;

export const All: StoryObj = {
  render: () => (
    <div className="flex items-center gap-4 text-foreground">
      <CopyIcon />
      <CheckIcon />
      <ImageIcon />
      <GlobeIcon />
    </div>
  ),
};
