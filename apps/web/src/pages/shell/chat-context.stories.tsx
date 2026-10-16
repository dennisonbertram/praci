import type { ThreadMessage } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../stories/fixtures-9";
import { ComposerReplyPreview, ReplyLine, TimeSeparator } from "./chat-context";

// A 1x1 sample image so the thumbnail has something to show.
const SAMPLE_IMAGE = btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#888"/></svg>',
);
const attachment = {
  kind: "image",
  artifactId: "art_demo",
  mimeType: "image/svg+xml",
  name: "sample.svg",
} as const;
const target = { botId: "bot_demo" };

const meta = {
  title: "Chat/Reply context",
  parameters: {
    docs: { description: { component: "Also shows: ReplyThumbnail (via the image stories)" } },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  beforeEach: () =>
    mockRpc({
      "artifacts.get": { contentBase64: SAMPLE_IMAGE, mimeType: "image/svg+xml" },
    }),
} satisfies Meta;
export default meta;

type Story = StoryObj;

const noop = () => undefined;

function reply(extra: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: "msg_2",
    threadId: "thread_demo",
    seq: 2,
    role: "user",
    blocks: [{ kind: "text", text: "Sounds good." }],
    replyToMessageId: "msg_1",
    replyPreview: { role: "bot", text: "Shall I send the sample invoice today?" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

export const TimeSeparatorToday: Story = {
  render: () => <TimeSeparator createdAt={new Date().toISOString()} locale="en" />,
};

export const TimeSeparatorEarlier: Story = {
  render: () => <TimeSeparator createdAt="2026-01-01T09:30:00.000Z" locale="en" />,
};

export const ComposerPreview: Story = {
  render: () => (
    <ComposerReplyPreview author="Ada" text="Shall I send the sample invoice?" onDismiss={noop} />
  ),
};

export const ComposerPreviewQuote: Story = {
  render: () => (
    <ComposerReplyPreview
      author="Ada"
      text="A longer message the reply is about"
      quote="only this selected part"
      onDismiss={noop}
    />
  ),
};

export const ComposerPreviewLong: Story = {
  render: () => (
    <ComposerReplyPreview
      author="Ada"
      text="A very long message that keeps going well past the width of the composer so it must be truncated with an ellipsis"
      onDismiss={noop}
    />
  ),
};

export const ComposerPreviewImage: Story = {
  render: () => (
    <ComposerReplyPreview
      author="Ada"
      text=""
      attachment={attachment}
      target={target}
      onDismiss={noop}
    />
  ),
};

export const ComposerPreviewFile: Story = {
  render: () => (
    <ComposerReplyPreview
      author="Ada"
      text=""
      attachment={{ ...attachment, kind: "file", name: "report.pdf" }}
      onDismiss={noop}
    />
  ),
};

export const ReplyLineText: Story = {
  render: () => <ReplyLine message={reply({})} author="Ada" onJump={noop} />,
};

export const ReplyLineImage: Story = {
  render: () => (
    <ReplyLine
      message={reply({ replyPreview: { role: "bot", text: "", attachment } })}
      author="Ada"
      target={target}
      onJump={noop}
    />
  ),
};

export const ReplyLineUnavailable: Story = {
  render: () => <ReplyLine message={reply({ replyPreview: null })} author="Ada" />,
};
