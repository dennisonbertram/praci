import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockBots } from "../../stories/fixtures-0";
import { CommandPalette } from "./command-palette";

const meta = {
  title: "Shell/Command palette",
  component: CommandPalette,
  args: { open: true, onOpenChange: () => undefined, bots: mockBots, onSelectBot: () => undefined },
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the palette</p>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof CommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoBots: Story = { args: { bots: [] } };

export const ManyBots: Story = {
  name: "More than nine bots (shortcuts stop at 9)",
  args: {
    bots: Array.from({ length: 11 }, (_, i) => ({
      ...(mockBots[0] ?? ({} as never)),
      id: `bot_${i}`,
      name: `Sample bot ${i + 1}`,
    })),
  },
};

export const NoSearchMatch: Story = {
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "zzzz");
  },
};

export const Closed: Story = { args: { open: false } };
