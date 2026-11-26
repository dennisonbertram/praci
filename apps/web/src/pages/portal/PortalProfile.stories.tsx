import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortalProfile } from "./PortalProfile";

const meta = {
  title: "Portal/Profile",
  component: PortalProfile,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PortalProfile>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: one button, the form opens on demand. */
export const Closed: Story = {};
