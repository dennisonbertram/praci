import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { teamBots } from "../../stories/fixtures";
import { BotCreatePicker } from "./bot-picker";

const noop = () => undefined;

const meta = {
  title: "Shell/Bot create picker",
  component: BotCreatePicker,
  args: {
    bots: teamBots,
    onCreateBot: noop,
    onOpenBot: noop,
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

export const NoBots: Story = { args: { bots: [] } };

export const Searching: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText("Search"), "cl");
  },
};

export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText("Search"), "zzz");
  },
};
