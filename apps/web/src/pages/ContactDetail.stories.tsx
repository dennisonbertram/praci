import { NotificationToaster } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ContactDetailPage } from "./ContactDetail";

const contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: "Acme Corp",
  kind: "investor" as const,
  notes: "Met at a demo day.",
  pipelineRecord: { id: "r1", name: "Acme Corp", status: "intro_made" as const },
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};

const meta = {
  title: "Pages/ContactDetail",
  component: ContactDetailPage,
  args: { id: "c1" },
} satisfies Meta<typeof ContactDetailPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact,
        mail: [
          {
            id: "m1",
            subject: "Intro to Example Co",
            from: "Ada Example",
            snippet: "Thanks for the deck, a few questions.",
            receivedAt: "2026-10-20T10:00:00.000Z",
          },
        ],
        meetings: [{ id: "g1", title: "Partner meeting", startedAt: "2026-10-18T15:00:00.000Z" }],
        documents: [{ id: "d1", name: "Pitch deck.pdf" }],
        safes: [{ id: "s1", amountCents: 25_000_000, status: "signed" }],
      },
    }),
};

export const DetailsOnly: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": { contact, mail: [], meetings: [], documents: [], safes: [] },
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "contacts.detail": () => new Promise(() => {}) }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({ "contacts.detail": () => Promise.reject(new Error("Contact not found")) }),
};

export const AddedByAgent: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact: { ...contact, addedBy: { id: "b1", name: "Chief" }, pipelineRecord: undefined },
        mail: [],
        meetings: [],
        documents: [],
        safes: [],
      },
    }),
};

export const LongNotes: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact: {
          ...contact,
          organization: "The Example Street Capital Partners Long-Term Opportunity Fund III",
          email: "ada.example.with.a.deliberately.long.unbroken.address@example-investments.test",
          notes:
            "Met at a demo day.\n\nFollowed up with the deck and the hiring plan.\n\nPrefers a short weekly note over calls; wants to meet the team before the next round.",
        },
        mail: [],
        meetings: [],
        documents: [],
        safes: [],
      },
    }),
};

export const Phone: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact,
        mail: [
          {
            id: "m1",
            subject: "Intro to Example Co",
            from: "Ada Example",
            snippet: "Thanks for the deck, a few questions.",
            receivedAt: "2026-10-20T10:00:00.000Z",
          },
        ],
        meetings: [{ id: "g1", title: "Partner meeting", startedAt: "2026-10-18T15:00:00.000Z" }],
        documents: [{ id: "d1", name: "Pitch deck.pdf" }],
        safes: [{ id: "s1", amountCents: 25_000_000, status: "signed" }],
      },
    }),
  globals: { viewport: { value: "mobile1" } },
};

/** A click on the email address opens the composer addressed to the contact. */
export const ComposeFromEmail: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": { contact, mail: [], meetings: [], documents: [], safes: [] },
      "inbox.list": {
        accounts: [{ connectionId: "g1", label: "ada@gmail.test", address: "ada@gmail.test" }],
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("link", { name: "ada@example.test" }),
    );
    await within(document.body).findByRole("button", { name: "Send" });
  },
};

/** At the ten-thread cap, a last row leads to every thread with the contact in Inbox. */
export const MailAtLimit: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact,
        mail: Array.from({ length: 10 }, (_, i) => ({
          id: `m${i + 1}`,
          subject: `Thread ${i + 1}`,
          from: "Ada Example",
          snippet: "Thanks for the deck, a few questions.",
          receivedAt: "2026-10-20T10:00:00.000Z",
        })),
        meetings: [],
        documents: [],
        safes: [],
      },
    }),
};

/** At the ten-meeting cap, a last row leads to every meeting with the contact in Meetings. */
export const MeetingsAtLimit: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.detail": {
        contact,
        mail: [],
        meetings: Array.from({ length: 10 }, (_, i) => ({
          id: `g${i + 1}`,
          title: `Partner check-in ${i + 1}`,
          startedAt: "2026-10-18T15:00:00.000Z",
        })),
        documents: [],
        safes: [],
      },
    }),
};

/** Deleting a contact keeps a notice with Undo on screen. */
export const DeletedWithUndo: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <NotificationToaster onOpen={() => {}} />
      </>
    ),
  ],
  beforeEach: () =>
    mockRpc({
      "contacts.detail": { contact, mail: [], meetings: [], documents: [], safes: [] },
      "contacts.list": [contact],
      "contacts.linked": { portal: false, documents: [], safes: 0 },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Edit" }));
    await userEvent.click(await within(document.body).findByRole("button", { name: "Delete" }));
    await within(document.body).findByText("Deleted Ada Example");
  },
};
