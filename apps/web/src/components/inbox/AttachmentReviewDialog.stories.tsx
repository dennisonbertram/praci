import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { AttachmentReviewDialog } from "./AttachmentReviewDialog";

const REVIEW = `**What it is:** An invoice from Sample Supply Co for 1,200.00, due 2026-11-15.

**Needs action:** Pay by 2026-11-15.

**Security:** The bank details differ from the last invoice and the email asks for payment today. Confirm by phone before paying.`;

const meta = {
  title: "Inbox/Attachment review",
  component: AttachmentReviewDialog,
  args: {
    messageId: "msg_demo",
    attachment: { id: "a1", filename: "Invoice 2026-114.pdf" },
    onClose: () => {},
  },
  decorators: [withPageBehind()],
} satisfies Meta<typeof AttachmentReviewDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The first answer is the review; the box below asks follow-ups. */
export const Review: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.reviewAttachment": (input: { question?: string }) =>
        input.question
          ? { status: "ok", answer: "The new account ends in 4421." }
          : { status: "ok", answer: REVIEW },
    }),
};

/** Nothing is sent until the model's recipient is allowed. */
export const NeedsConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.reviewAttachment": {
        status: "needs_consent",
        recipient: { key: "model:demo", name: "Demo model" },
      },
    }),
};

export const Failed: Story = {
  beforeEach: () => mockRpc({ "inbox.reviewAttachment": { status: "unavailable" } }),
};
