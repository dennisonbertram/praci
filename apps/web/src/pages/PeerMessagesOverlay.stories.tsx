import type { ThreadMessage } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { PeerMessagesOverlay } from "./PeerMessagesOverlay";

const meta = {
  title: "Chat/PeerMessagesOverlay",
  component: PeerMessagesOverlay,
  decorators: [withPageBehind()],
  args: {
    botId: "bot_a",
    botName: "Planner",
    botColor: "#6366f1",
    peerBotId: "bot_b",
    peerBotName: "Researcher",
    peerBotColor: "#f59e0b",
    onClose: () => undefined,
  },
} satisfies Meta<typeof PeerMessagesOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

const message = (n: number, blocks: ThreadMessage["blocks"]): ThreadMessage => ({
  id: `msg_${n}`,
  threadId: "thread_a",
  seq: n,
  role: "bot",
  blocks,
  createdAt: `2026-01-01T00:0${n}:00.000Z`,
});

const history: ThreadMessage[] = [
  message(1, [
    {
      kind: "bot_message_sent",
      toBotId: "bot_b",
      toBotName: "Researcher",
      text: "Can you summarize the **sample** report?",
    },
  ]),
  message(2, [
    {
      kind: "bot_message_received",
      fromBotId: "bot_b",
      fromBotName: "Researcher",
      text: "Sure. It has three sections:\n\n- Overview\n- Findings\n- Next steps",
    },
  ]),
];

export const Conversation: Story = {
  beforeEach: () => mockRpc({ "threads.messages": { messages: history, olderCursor: null } }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "threads.messages": () => new Promise(() => undefined) }),
};

export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "threads.messages": () => {
        throw new Error("offline");
      },
    }),
};

export const NoMessages: Story = {
  beforeEach: () => mockRpc({ "threads.messages": { messages: [], olderCursor: null } }),
};
