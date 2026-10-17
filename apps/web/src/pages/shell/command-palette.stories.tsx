import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { withPageBehind } from "../../stories/decorators";
import { detailedBots } from "../../stories/fixtures";
import { CommandPalette } from "./command-palette";

const meta = {
  title: "Shell/Command palette",
  component: CommandPalette,
  args: {
    open: true,
    onOpenChange: () => undefined,
    bots: detailedBots,
    onSelectBot: () => undefined,
    pages: [
      { id: "inbox", label: "Inbox" },
      { id: "finance", label: "Finance" },
      { id: "data-room", label: "Data room" },
    ],
    groups: [{ id: "group_1", label: "Sample group" }],
  },
  decorators: [withPageBehind("Page behind the palette")],
} satisfies Meta<typeof CommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoBots: Story = { args: { bots: [] } };

export const ManyBots: Story = {
  name: "More than nine bots (shortcuts stop at 9)",
  args: {
    bots: Array.from({ length: 11 }, (_, i) => ({
      ...(detailedBots[0] ?? ({} as never)),
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

export const SearchFindsPage: Story = {
  name: "Search lists a matching page first",
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "fin");
  },
};
