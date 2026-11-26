import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockRpc } from "../../lib/__mocks__/rpc";
import type { EmailPanelTab } from "./EmailSidePanel";
import { EmailSidePanel } from "./EmailSidePanel";

const people = [{ email: "priya@northwind.example.test", name: "Priya Shah" }];

const meta = {
  title: "Inbox/Email side panel",
  component: EmailSidePanel,
  parameters: { layout: "fullscreen" },
  args: { people, tab: "context", onClose: () => undefined },
  decorators: [
    (Story) => (
      <div className="h-[560px] w-96">
        <Story />
      </div>
    ),
  ],
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": {
        email: "priya@northwind.example.test",
        name: "Priya Shah",
        organization: "Northwind Capital",
        kind: "investor",
        contactId: "contact_1",
        lastEmailedAt: "2026-01-05T10:00:00.000Z",
        threadCount: 1,
        threads: [
          { id: "mail_1", subject: "Term sheet draft", receivedAt: "2026-01-05T10:00:00.000Z" },
        ],
        lastMeeting: null,
        nextMeeting: null,
        documents: [],
        todos: [],
      },
      "inbox.personSummary": { status: "unavailable" },
    }),
} satisfies Meta<typeof EmailSidePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Beside the composer there is no agent, so the panel is just Context. */
export const ContextOnly: Story = {};

/** Beside an open email: Context and Agent tabs. */
export const WithAgentTab: Story = {
  render: (args) => {
    const [tab, setTab] = useState<EmailPanelTab>("context");
    return (
      <EmailSidePanel
        {...args}
        tab={tab}
        onTab={setTab}
        agent={<p className="p-4 text-sm text-muted-foreground">Agent chat goes here.</p>}
        fullScreenTo="/app/bot_1"
      />
    );
  },
};
