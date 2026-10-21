import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { ContactDialog } from "./ContactDialog";

const contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: "Acme Corp",
  kind: "customer",
  notes: "Signed the services agreement",
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
} as const;

const meta = {
  title: "Components/ContactDialog",
  component: ContactDialog,
  decorators: [withPageBehind()],
  args: { contact: null, onClose: () => {}, onSaved: () => {} },
} satisfies Meta<typeof ContactDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {};
export const Editing: Story = { args: { contact, onDeleted: () => {} } };
/** A holder on the cap table: the one case that says editing does not change Carta. */
export const OnCapTable: Story = { args: { contact, fromCapTable: true, onDeleted: () => {} } };
export const PrefilledFromHolder: Story = {
  args: { prefill: { name: "Bo Sample", email: "bo@example.test", organization: null } },
};

export const AddedByAgent: Story = {
  args: { contact: { ...contact, addedBy: { id: "b1", name: "Chief" } }, onDeleted: () => {} },
};
/** Opened from the Cap table, where a hint says contacts do not change Carta. */
export const FromCapTable: Story = { args: { fromCapTable: true } };
/** The duplicate-email error sits under the Email field, with a way to open the existing contact. */
export const DuplicateEmail: Story = {
  args: {
    prefill: { name: "Ada Again", email: "ada@example.test", organization: null },
    contacts: [contact],
    onOpenContact: () => {},
  },
  beforeEach: () =>
    mockRpc({
      "contacts.save": () => {
        throw new Error("Another contact already has this email.");
      },
    }),
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("button", { name: "Save" }));
  },
};
