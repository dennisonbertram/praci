import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { item } from "../../pages/gtm/fixtures";
import { EmailItemCard } from "./EmailItemCard";

const email = {
  ...item,
  id: "clgtmemail0000000000000001",
  category: "outbound_email" as const,
  channel: "email" as const,
  target: "prospect@example.test",
  notes:
    "Join our beta.\nReply unsubscribe to stop these emails.\n123 Example Street, Sample City, CA 90210",
};
const meta = {
  title: "GTM/Email",
  component: EmailItemCard,
  args: {
    item: email,
    accounts: [
      { connectionId: "gmail_demo", label: "Demo Gmail", address: "founder@example.test" },
    ],
    onChange: () => {},
  },
  beforeEach: () =>
    mockRpc({
      "scratchpad.update": (input: object) => ({ ...email, ...input }),
      "scratchpad.remove": { ok: true },
      "inbox.compose.send": { status: "disabled" },
    }),
} satisfies Meta<typeof EmailItemCard>;
export default meta;
export const Ready: StoryObj<typeof meta> = {};
export const MissingAddress: StoryObj<typeof meta> = {
  args: { item: { ...email, notes: "Join our beta. Reply unsubscribe to stop these emails." } },
};
export const MissingBoth: StoryObj<typeof meta> = {
  args: { item: { ...email, notes: "Join our beta." } },
};
export const NoAccount: StoryObj<typeof meta> = { args: { accounts: [] } };
export const MultipleAccounts: StoryObj<typeof meta> = {
  args: {
    accounts: [
      { connectionId: "gmail_demo", label: "Demo Gmail" },
      { connectionId: "gmail_second", label: "Second demo Gmail" },
    ],
  },
};
