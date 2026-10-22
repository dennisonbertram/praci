import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkedInPostPreview } from "./LinkedInPostPreview";

const meta = {
  title: "GTM/LinkedIn preview",
  component: LinkedInPostPreview,
  args: {
    text: "We are inviting 50 teams to join our design partner program.\n\nTell us which workflow you want to simplify.",
    accountLabel: "Demo company page",
  },
} satisfies Meta<typeof LinkedInPostPreview>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
export const OverLimit: StoryObj<typeof meta> = { args: { text: "a".repeat(3001) } };
