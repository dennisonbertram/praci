import type { InvestorUpdate } from "@rakazo/contracts";
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
