import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { SidebarPages } from "./SidebarPages";

const team = {
  key: "team-health",
  route: "/app/team-health",
  platforms: ["web"],
  available: true,
} as const;

const meta = {
  title: "Shell/Sidebar pages",
  component: SidebarPages,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: { templates: [team] },
} satisfies Meta<typeof SidebarPages>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing added yet: only the add row. */
export const NothingAdded: Story = {
  beforeEach: () =>
    mockRpc({ "sidebarPages.list": { pages: [], addable: ["team-health"], botPages: [] } }),
};

/** The page is added, so its row shows and the add row is gone. */
export const PageAdded: Story = {
  beforeEach: () =>
    mockRpc({
      "sidebarPages.list": { pages: [{ templateKey: "team-health" }], addable: [], botPages: [] },
    }),
};

const bots = [{ id: "bot_fin", name: "Finance agent", color: "#4f6f9f", status: "idle" }] as const;

/** A bot page is added: its row shows the title with the bot's avatar; another page is still addable. */
export const BotPageAdded: Story = {
  args: { bots },
  beforeEach: () =>
    mockRpc({
      "sidebarPages.list": {
        pages: [{ pageId: "page_cash", botId: "bot_fin", title: "Cash" }],
        addable: [],
        botPages: [{ botId: "bot_fin", pages: [{ id: "page_burn", title: "Burn" }] }],
      },
    }),
};

/** No template is available: nothing is shown. */
export const NothingAvailable: Story = {
  args: { templates: [{ ...team, available: false }] },
};
