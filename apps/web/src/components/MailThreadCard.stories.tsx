import type { MessageBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { MailThreadCard } from "./MailThreadCard";

type Block = Extract<MessageBlock, { kind: "mail_thread" }>;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const block: Block = {
  kind: "mail_thread",
  subject: "Q3 vendor invoice",
  messages: [
    {
      from: "Sample Vendor <billing@vendor.example>",
      to: "you@example.test",
      date: ago(60 * 26),
      text: "Hello,\n\nPlease find the sample invoice for the third quarter attached.\n\nThanks,\nSample Vendor",
      attachments: ["invoice-q3.pdf"],
    },
    {
      from: "You <you@example.test>",
      to: "Sample Vendor <billing@vendor.example>",
      cc: "Demo Teammate <teammate@example.test>",
      date: ago(60 * 20),
      text: "Thanks. Can you confirm the purchase order number on it?",
    },
    {
      from: "Sample Vendor <billing@vendor.example>",
      to: "you@example.test",
      date: ago(60 * 3),
      text: "The purchase order number is PO-0000. A corrected copy is attached.",
      attachments: ["invoice-q3-corrected.pdf"],
    },
  ],
};

const meta = {
  title: "Chat/MailThreadCard",
  component: MailThreadCard,
  args: { block },
} satisfies Meta<typeof MailThreadCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed to one line; the model's context is the same thread. */
export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Email thread/ }));
    await expect(canvas.getByText(/corrected copy/)).toBeInTheDocument();
    await expect(canvas.getByText("invoice-q3-corrected.pdf")).toBeInTheDocument();
  },
};

export const SingleMessage: Story = {
  args: { block: { ...block, messages: block.messages.slice(0, 1) } },
};
