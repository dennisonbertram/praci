import type { VoiceChatGroup } from "@rakazo/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VoiceChatCard } from "./VoiceChatCard";

const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 12, 0, seconds)).toISOString();
const message = (id: string, role: "user" | "bot", text: string, seconds: number) => ({
  id,
  role,
  createdAt: at(seconds),
  blocks: [{ kind: "text" as const, text }],
});
const marker = (title: string) => ({
  id: "m_marker",
  role: "bot",
  createdAt: at(185),
  blocks: [{ kind: "voice_call" as const, title, farewell: "Talk soon." }],
});

const turns = [
  message("m1", "user", "Can you move the demo review to Friday?", 5),
  message("m2", "bot", "Done. The demo review is now on Friday at 10. Anything else?", 12),
  message("m3", "user", "No, that is all.", 20),
];
const closing = marker("Moved the demo review");

const group: VoiceChatGroup = {
  kind: "voiceChat",
  key: "call:demo",
  callId: "demo",
  messages: [...turns, closing],
  marker: closing,
};

const meta = {
  title: "Chat/VoiceChatCard",
  component: VoiceChatCard,
  args: { group },
  decorators: [
    (Story) => (
      <div className="flex w-[520px] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VoiceChatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

/** Opens because the thread asked to jump to one of the card's messages. */
export const Expanded: Story = { args: { revealMessageId: "m2" } };

export const SummaryFromReply: Story = {
  args: { group: { ...group, messages: turns, marker: undefined } },
};

export const NoSummary: Story = {
  args: {
    group: {
      ...group,
      messages: [message("m1", "user", "Hello?", 1)],
      marker: undefined,
    },
  },
};

export const LongSummary: Story = {
  args: {
    group: {
      ...group,
      messages: [
        ...turns,
        marker("A call title that is long enough to be cut off at the card edge ".repeat(3)),
      ],
      marker: marker("A call title that is long enough to be cut off at the card edge ".repeat(3)),
    },
  },
};
