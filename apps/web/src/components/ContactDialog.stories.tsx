import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../stories/decorators";
import { ContactDialog } from "./ContactDialog";

const contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: "Acme Corp",
  kind: "customer",
  notes: "Signed the services agreement",
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
export const OnCapTable: Story = { args: { contact, onCapTable: true, onDeleted: () => {} } };
export const PrefilledFromHolder: Story = {
  args: { prefill: { name: "Bo Sample", email: "bo@example.test", organization: null } },
};
