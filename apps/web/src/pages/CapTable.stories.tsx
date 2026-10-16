import type { Contact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CapTablePage } from "./CapTable";

const contact = (id: string, name: string, kind: Contact["kind"], organization: string | null) => ({
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
  contact("c1", "Ada Example", "investor", "Example Ventures"),
  contact("c2", "Bo Sample", "auditor", "Sample & Co"),
  contact("c3", "Cy Placeholder", "investor", null),
];
const cartaServer = { id: "srv_c", enabled: true, endpoint: "https://mcp.app.carta.com/mcp" };

const meta = {
  title: "CapTable/CapTablePage",
  component: CapTablePage,
  parameters: { layout: "fullscreen" },
  args: { onConnectCarta: () => {}, onShowAgent: () => {} },
  decorators: [
    (Story) => (
      <div className="flex h-[700px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapTablePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts, "mcp.servers.list": [cartaServer] }),
};

export const CartaNotConnected: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts, "mcp.servers.list": [] }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "contacts.list": [], "mcp.servers.list": [cartaServer] }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "contacts.list": () => new Promise(() => {}) }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": () => {
        throw new Error("Could not load contacts");
      },
    }),
};
