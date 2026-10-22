import type { Meta, StoryObj } from "@storybook/react-vite";
import { BotCreatePicker } from "./bot-picker";

const noop = () => undefined;

const meta = {
  title: "Shell/Bot create picker",
  component: BotCreatePicker,
  args: {
    onCreateBot: noop,
    onCreateGroup: noop,
    onCreateSpace: noop,
    onShowGroupInfo: noop,
    onShowSpaceInfo: noop,
  },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-lg border border-border bg-popover">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotCreatePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
