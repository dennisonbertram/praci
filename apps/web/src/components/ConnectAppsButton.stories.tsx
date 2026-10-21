import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectAppsButton } from "./ConnectAppsButton";

const meta = {
  title: "Shell/ConnectAppsButton",
  component: ConnectAppsButton,
  args: { active: false, onClick: () => {} },
  decorators: [
    (Story) => (
      <div className="w-64 bg-sidebar py-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectAppsButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The plain row, with no app logos: nothing implies an app is connected. */
export const Default: Story = {};

/** On the Integrations page. */
export const Active: Story = { args: { active: true } };
