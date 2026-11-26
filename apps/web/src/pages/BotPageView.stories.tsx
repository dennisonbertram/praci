import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { BotPageView } from "./BotPageView";

const meta = {
  title: "Pages/Bot page (sidebar)",
  component: BotPageView,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-[480px]">
        <Story />
      </div>
    ),
  ],
  args: { botId: "bot_fin", pageId: "page_cash" },
  beforeEach: () =>
    mockRpc({
      "threads.head": { threadId: "thread_fin", cursor: 0 },
      // Stories never deliver an event: the stream stays open.
      "threads.subscribe": () => ({
        [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => undefined) }),
      }),
      "pages.list": [
        { id: "page_cash", title: "Cash", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      "pages.get": {
        id: "page_cash",
        botId: "bot_fin",
        title: "Cash",
        content: "# Runway\n\nSample figures only.",
        revision: 1,
        updatedBy: "bot",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    }),
} satisfies Meta<typeof BotPageView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A bot page opened from the sidebar: the page title is the heading, the page uses the full width. */
export const Default: Story = {};
