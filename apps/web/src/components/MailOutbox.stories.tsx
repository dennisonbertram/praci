import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { closeRestored, holdDiscard, holdSend, undoSend } from "../lib/outbox";
import type { ComposeRestore } from "./ComposeEmail";
import { NEW_MESSAGE } from "./ComposeEmail";
import { MailOutbox } from "./MailOutbox";

const restore: ComposeRestore = {
  seed: NEW_MESSAGE,
  clientId: "client_story_outbox",
  fields: {
    connectionId: "conn_1",
    to: [],
    cc: [],
    bcc: [],
    subject: "Quarterly planning notes",
    html: "",
    text: "Here are the sample notes.",
  },
  forwarded: [],
  files: [],
  saved: false,
  accounts: [{ connectionId: "conn_1", label: "me@example.test" }],
};

/** Runs `start` with the five-second hold collapsed to zero, so the story reaches the next state at once. */
function withoutHold(start: () => void) {
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) =>
    real(fn, ms === 5_000 ? 0 : ms, ...rest)) as typeof setTimeout;
  try {
    start();
  } finally {
    globalThis.setTimeout = real;
  }
}

/** The outbox is a module-level store, so each story clears what it started. */
const settle = () => {
  undoSend();
  closeRestored();
};

const meta = {
  title: "Inbox/Mail outbox",
  component: MailOutbox,
  decorators: [
    (Story) => (
      <>
        <p className="p-6 text-sm text-muted-foreground">The inbox, behind the notice.</p>
        <Story />
      </>
    ),
  ],
  beforeEach: () => {
    mockRpc({ "inbox.compose.draftSave": { status: "saved" } });
    return settle;
  },
} satisfies Meta<typeof MailOutbox>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing is waiting to send. */
export const Idle: Story = {};

/** Sending, with Undo available for the hold. */
export const Sending: Story = {
  beforeEach: () => {
    holdSend(async () => null, restore);
    return settle;
  },
};

export const Sent: Story = {
  beforeEach: () => {
    withoutHold(() => holdSend(async () => null, restore));
    return settle;
  },
};

export const DraftDiscarded: Story = {
  beforeEach: () => {
    holdDiscard(async () => undefined, restore);
    return settle;
  },
};

/** The send failed, so the composer reopens with the reason. */
export const SendFailed: Story = {
  beforeEach: () => {
    withoutHold(() =>
      holdSend(async () => "Not confirmed as sent. Check Sent before trying again.", restore),
    );
    return settle;
  },
};
