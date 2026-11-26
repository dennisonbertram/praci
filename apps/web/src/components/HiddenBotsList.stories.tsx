import type { Meta, StoryObj } from "@storybook/react-vite";
import { HiddenBotsList } from "./HiddenBotsList";

const meta = {
  title: "Settings/Hidden bots",
  component: HiddenBotsList,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  args: {
    bots: [
      { id: "bot_ada", name: "Ada", color: "#6366f1" },
      { id: "bot_bram", name: "Bram", color: "#10b981" },
    ],
    onShow: () => {},
  },
} satisfies Meta<typeof HiddenBotsList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** With none hidden the section is absent. */
export const Empty: Story = { args: { bots: [] } };
