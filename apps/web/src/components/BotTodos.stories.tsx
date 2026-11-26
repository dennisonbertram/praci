import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { BotTodos } from "./BotTodos";

const day = 86_400_000;

const meta = {
  component: BotTodos,
  decorators: [
    (Story) => (
      <div className="w-96 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotTodos>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An undated item, one due soon and one overdue (its date is red). */
export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "scratchpad.waitingOnYou": [
        {
          id: "i1",
          botId: "bot_ada",
          botName: "Ada",
          title: "Sign the sample vendor form",
          waitingOn: "you",
          dueAt: null,
        },
        {
          id: "i2",
          botId: "bot_ben",
          botName: "Ben",
          title: "Review the sample budget",
          waitingOn: "you",
          dueAt: new Date(Date.now() + 2 * day).toISOString(),
        },
        {
          id: "i3",
          botId: "bot_ben",
          botName: "Ben",
          title: "Reply to the sample landlord",
          waitingOn: null,
          dueAt: new Date(Date.now() - 3 * day).toISOString(),
        },
      ],
      "scratchpad.update": {},
    }),
};

/** Nothing waiting: the component renders nothing. */
export const Empty: Story = { beforeEach: () => mockRpc({ "scratchpad.waitingOnYou": [] }) };

/** The first request failed, so the strip offers a retry instead of disappearing. */
export const LoadFails: Story = {
  beforeEach: () =>
    mockRpc({
      "scratchpad.waitingOnYou": () => {
        throw new Error("offline");
      },
    }),
};

/** Five items: three show, the rest sit behind "Show 2 more". */
export const Many: Story = {
  beforeEach: () =>
    mockRpc({
      "scratchpad.waitingOnYou": Array.from({ length: 5 }, (_, i) => ({
        id: `m${i}`,
        botId: "bot_ada",
        botName: "Ada",
        title:
          i === 2
            ? "Review the sample board deck and send every comment back before the call"
            : `Sample item ${i + 1}`,
        waitingOn: "you",
        dueAt: i === 0 ? new Date(Date.now() - 2 * day).toISOString() : null,
      })),
      "scratchpad.update": {},
    }),
};
