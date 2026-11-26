import type { Contact } from "@rakazo/contracts";
import { NotificationToaster } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { resetDeletedContacts } from "../lib/use-contact-notices";
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
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

const contacts = [
  contact("c1", "Ada Example", "customer", "Acme Corp"),
  contact("c2", "Bo Sample", "vendor", "Sample & Co"),
  contact("c3", "Cy Placeholder", "legal", "Placeholder LLP"),
  contact("c4", "Di Demo", "investor", null),
  contact("c5", "Casey Advisor (Mock)", "advisor", "Placeholder Advisory Group"),
];

const meta = {
  title: "Pages/Contacts",
  component: ContactsPage,
  args: { onAskAgent: () => {} },
} satisfies Meta<typeof ContactsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { beforeEach: () => mockRpc({ "contacts.list": contacts }) };

/** In a workspace among several, the header names it. */
/** Phone: name, organization and email under it, Kind as a badge. */
export const Phone: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
  globals: { viewport: { value: "mobile1" } },
};

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

export const SortedByKind: Story = {
  parameters: { initialEntries: ["/app/contacts?sort=kind&dir=desc"] },
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
};

export const NoMatches: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts }),
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("searchbox"), "zzz");
  },
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": () => {
        throw new Error("Could not load contacts");
      },
    }),
};

/** Deleting a contact from its row menu keeps a notice with Undo on screen. */
export const DeletedWithUndo: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <NotificationToaster onOpen={() => {}} />
      </>
    ),
  ],
  beforeEach: () => {
    resetDeletedContacts();
    mockRpc({
      "contacts.list": contacts,
      "contacts.linked": { portal: false, documents: [], safes: 0 },
      "contacts.delete": { ok: true },
    });
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Actions for Ada Example" }),
    );
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Delete" }));
    await within(document.body).findByText("Deleted Ada Example");
  },
};
