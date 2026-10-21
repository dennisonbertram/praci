import type { InvestorUpdate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { UpdateEditor } from "./UpdateEditor";

const contacts = [
  { id: "c1", name: "Ada Example", email: "ada@example.test", kind: "investor" },
  { id: "c2", name: "Bo Sample", email: "bo@example.test", kind: "investor" },
  { id: "c3", name: "Cy Placeholder", email: null, kind: "investor" },
].map((c) => ({
  ...c,
  organization: null,
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
}));
const update = (over: Partial<InvestorUpdate> = {}): InvestorUpdate => ({
  id: "u1",
  audience: "investors",
  subject: "Example Co · 2026-09 update",
  period: "2026-09",
  body: "## Highlights\n\n- Shipped the first release\n- Revenue: TBD\n\n## Asks\n\nIntroductions to seed investors.",
  status: "draft",
  recipientContactIds: ["c1", "c2"],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  ...over,
});
const accounts = [
  { connectionId: "g1", label: "founder@example.test" },
  { connectionId: "g2", label: "team@example.test" },
];
const setup =
  (value: InvestorUpdate, mail: unknown[] = accounts) =>
  () =>
    mockRpc({
      "investors.updates.get": value,
      "investors.updates.accounts": mail,
      "contacts.list": contacts,
      "investors.updates.save": value,
    });

const meta = {
  title: "Investors/UpdateEditor",
  component: UpdateEditor,
  parameters: { layout: "fullscreen" },
  args: { updateId: "u1" },
  decorators: [
    (Story) => (
      <div className="flex h-[760px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UpdateEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A draft with a TBD to fix, two Gmail accounts and a recipient without an email. */
export const Draft: Story = { beforeEach: setup(update()) };

/** An empty body offers Draft with agent. */
export const EmptyBody: Story = { beforeEach: setup(update({ body: "" })) };

/** Without Gmail the To list is hidden and the one button connects Gmail. */
export const NoGmail: Story = { beforeEach: setup(update(), []) };

export const Sending: Story = {
  beforeEach: setup(
    update({
      status: "sending",
      deliveries: [
        { contactId: "c1", name: "Ada Example", state: "sent" },
        { contactId: "c2", name: "Bo Sample", state: "sending" },
      ],
    }),
  ),
};

/** One failed and one unknown delivery: Retry on each, and Mark delivered in the footer. */
export const PartlySent: Story = {
  beforeEach: setup(
    update({
      status: "partly_sent",
      sentAt: "2026-10-02T09:00:00.000Z",
      deliveries: [
        { contactId: "c1", name: "Ada Example", state: "sent" },
        { contactId: "c2", name: "Bo Sample", state: "failed" },
        { contactId: "c3", name: "Cy Placeholder", state: "unknown" },
      ],
    }),
  ),
};

/** A sent update is read-only. */
export const Sent: Story = {
  beforeEach: setup(
    update({
      status: "sent",
      sentAt: "2026-10-02T09:00:00.000Z",
      deliveries: [
        { contactId: "c1", name: "Ada Example", state: "sent" },
        { contactId: "c2", name: "Bo Sample", state: "sent" },
      ],
    }),
  ),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "investors.updates.get": () => {
        throw new Error("Could not load this update");
      },
    }),
};
