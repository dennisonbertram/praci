import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortalDead } from "./PortalDead";

const meta = {
  title: "Portal/PortalDead",
  component: PortalDead,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PortalDead>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An expired, revoked or unknown link: one sentence and nothing else. */
export const Default: Story = {};
/** `/portal` itself: the same page without the sentence. */
export const Quiet: Story = { args: { quiet: true } };
