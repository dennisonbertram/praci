import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../stories/decorators";
import { ContactDeleteConfirm } from "./ContactDeleteConfirm";

const contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: null,
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
} as const;

const meta = {
  title: "Components/ContactDeleteConfirm",
  component: ContactDeleteConfirm,
  decorators: [withPageBehind()],
  args: {
    contact,
    linked: { portal: true, documents: ["Deck.pdf", "Terms.pdf"] },
    onCancel: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof ContactDeleteConfirm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PortalAndDocuments: Story = {};
export const PortalOnly: Story = { args: { linked: { portal: true, documents: [] } } };
export const OneDocument: Story = { args: { linked: { portal: false, documents: ["Deck.pdf"] } } };
export const Deleting: Story = { args: { busy: true } };
