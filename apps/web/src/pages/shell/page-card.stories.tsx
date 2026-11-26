import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { PageCard } from "./page-card";

const meta = {
  title: "Shell/Page card",
  component: PageCard,
  args: { botId: "bot_support", pageId: "page_cs", title: "Customer support" },
} satisfies Meta<typeof PageCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The page exists and is not in the sidebar yet. */
export const NotInSidebar: Story = {
  beforeEach: () =>
    mockRpc({
      "sidebarPages.list": {
        pages: [],
        addable: [],
        botPages: [{ botId: "bot_support", pages: [{ id: "page_cs", title: "Customer support" }] }],
      },
    }),
};

/** The owner added it, so the card offers removal. */
export const InSidebar: Story = {
  beforeEach: () =>
    mockRpc({
      "sidebarPages.list": {
        pages: [{ pageId: "page_cs", botId: "bot_support", title: "Customer support" }],
        addable: [],
        botPages: [],
      },
    }),
};

/** The page was deleted after the agent made it. */
export const Deleted: Story = {
  beforeEach: () => mockRpc({ "sidebarPages.list": { pages: [], addable: [], botPages: [] } }),
};
