import type { Contact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ContactsPage } from "./Contacts";

const contact = (
  id: string,
  name: string,
  kind: Contact["kind"],
  organization: string | null,
): Contact => ({
  id,
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.test`,
  organization,
  kind,
  notes: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

const contacts = [
  contact("c1", "Ada Example", "customer", "Acme Corp"),
  contact("c2", "Bo Sample", "vendor", "Sample & Co"),
  contact("c3", "Cy Placeholder", "legal", "Placeholder LLP"),
  contact("c4", "Di Demo", "investor", null),
];

const meta = { title: "Pages/Contacts", component: ContactsPage } satisfies Meta<
  typeof ContactsPage
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { beforeEach: () => mockRpc({ "contacts.list": contacts }) };

/** In a workspace among several, the header names it. */
export const NamedWorkspace: Story = {
  args: { spaceName: "Example Co" },
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
};

export const Empty: Story = { beforeEach: () => mockRpc({ "contacts.list": [] }) };

export const Searched: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("searchbox"), "acme");
  },
};

export const NoMatches: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("searchbox"), "zzz");
  },
};
