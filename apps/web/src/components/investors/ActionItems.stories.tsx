import type { AuditRequest, InvestorUpdate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ActionItems } from "./ActionItems";

const draft = (id: string, subject: string, createdAt: string): InvestorUpdate => ({
  id,
  audience: "investors",
  subject,
  period: "2026-09",
  body: "",
  status: "draft",
  recipientContactIds: [],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt,
  updatedAt: createdAt,
});

const meta = {
  title: "Investors/ActionItems",
  component: ActionItems,
  args: { onOpen: () => {} },
} satisfies Meta<typeof ActionItems>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The routine's monthly draft, waiting to be reviewed and sent. */
export const UpdateDraft: Story = {
  args: { drafts: [draft("u1", "Example Co · 2026-09 update", "2026-10-01T09:00:00.000Z")] },
};

export const SeveralDrafts: Story = {
  args: {
    drafts: [
      draft("u1", "Example Co · 2026-09 update", "2026-10-01T09:00:00.000Z"),
      draft("u2", "Example Co · 2026-Q3 board note", "2026-10-03T09:00:00.000Z"),
    ],
  },
};

const audit = (over: Partial<AuditRequest>): AuditRequest => ({
  id: "a1",
  fund: "Example Audit LLP",
  asOf: "2026-09-30",
  asOfMatched: true,
  dueDate: "2026-11-15",
  status: "open",
  mailThreadId: "t1",
  connectionId: "k1",
  draftRef: null,
  senderKnown: true,
  notes: "",
  dataRoomItemId: null,
  drafting: false,
  newMail: false,
  createdAt: "2026-10-20T10:00:00.000Z",
  ...over,
});

/** The row exists the moment the mail arrives; Draft reply starts the Investors agent. */
export const NewAuditRequest: Story = {
  args: { drafts: [], audits: [audit({})] },
};

/** The sender is not an Auditors contact and the cap table had no holdings for the date. */
export const AuditWarnings: Story = {
  args: {
    drafts: [],
    audits: [audit({ id: "a2", senderKnown: false, asOfMatched: false, dueDate: null })],
  },
};

export const AuditDraftReady: Story = {
  args: {
    drafts: [],
    audits: [audit({ status: "drafted", draftRef: "d1", newMail: true })],
  },
};

export const AuditDrafting: Story = {
  args: { drafts: [], audits: [audit({ drafting: true })] },
};

/** The run ended with the request still open: the row says so and Draft reply is back. */
export const AuditDraftEnded: Story = {
  args: { drafts: [], audits: [audit({})], draftEnded: new Set(["a1"]) },
};

export const AuditAndUpdate: Story = {
  args: {
    drafts: [draft("u1", "Example Co · 2026-09 update", "2026-10-01T09:00:00.000Z")],
    audits: [audit({}), audit({ id: "a3", fund: "Sample Fund I", status: "done" })],
  },
};
