import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ContextPanel } from "./ContextPanel";

const facts = (email: string, name: string) => ({
  email,
  name,
  organization: "Northwind Capital",
  kind: "investor",
  contactId: "contact_1",
  lastEmailedAt: "2026-01-05T10:00:00.000Z",
  threadCount: 3,
  threads: [
    { id: "mail_1", subject: "Term sheet draft", receivedAt: "2026-01-05T10:00:00.000Z" },
    { id: "mail_2", subject: "Intro call follow-up", receivedAt: "2025-12-18T10:00:00.000Z" },
  ],
  lastMeeting: {
    title: "Intro call",
    start: "2025-12-16T15:00:00.000Z",
    href: "https://calendar.example.test/event/1",
  },
  nextMeeting: { title: "Board prep", start: "2999-01-10T15:00:00.000Z", href: null },
  documents: [{ id: "doc_1", name: "Series A term sheet.pdf" }],
  todos: [{ id: "todo_1", text: "Send the updated cap table", dueOn: null }],
});

const meta = {
  title: "Inbox/Context panel",
  component: ContextPanel,
  parameters: { layout: "fullscreen" },
  args: { people: [{ email: "priya@northwind.example.test", name: "Priya Shah" }] },
  decorators: [
    (Story) => (
      <div className="w-80 border-s border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContextPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Facts first, then the model's short summary above them. */
export const WithSummary: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": facts("priya@northwind.example.test", "Priya Shah"),
      "inbox.personSummary": {
        status: "ok",
        summary:
          "Priya leads the Series A at Northwind Capital. You last spoke on the intro call and she sent a term sheet draft on January 5.",
      },
    }),
};

/** No model or no consent for it: the facts stand alone. */
export const FactsOnly: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": facts("priya@northwind.example.test", "Priya Shah"),
      "inbox.personSummary": { status: "unavailable" },
    }),
};

/** The facts are in and the summary is still being written. */
export const Summarizing: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": facts("priya@northwind.example.test", "Priya Shah"),
      "inbox.personSummary": () => new Promise(() => {}),
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "inbox.personContext": () => new Promise(() => {}) }),
};

export const Nothing: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": {
        ...facts("new@example.test", ""),
        name: null,
        organization: null,
        kind: null,
        contactId: null,
        lastEmailedAt: null,
        threadCount: 0,
        threads: [],
        lastMeeting: null,
        nextMeeting: null,
        documents: [],
        todos: [],
      },
    }),
  args: { people: [{ email: "new@example.test" }] },
};

/** Several recipients: one section each, the first open. */
export const SeveralPeople: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.personContext": (input: unknown) =>
        facts((input as { email: string }).email, "Priya Shah"),
      "inbox.personSummary": { status: "unavailable" },
    }),
  args: {
    people: [
      { email: "priya@northwind.example.test", name: "Priya Shah" },
      { email: "sam@example.test", name: "Sam Lee" },
      { email: "kim@example.test" },
    ],
  },
};
