import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortalOpen } from "./PortalOpen";

const meta = {
  title: "Portal/PortalOpen",
  component: PortalOpen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PortalOpen>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A link with its token in the fragment: only an Open button, and no company name. */
export const Default: Story = {
  beforeEach: () => {
    window.location.hash = "#example-token";
    return () => {
      window.location.hash = "";
    };
  },
};

/** No token in the address: the same page as a link that no longer works. */
export const NoToken: Story = {
  beforeEach: () => {
    window.location.hash = "";
  },
};
