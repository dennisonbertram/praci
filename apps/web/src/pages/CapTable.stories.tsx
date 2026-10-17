import type { Contact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { mockMe } from "../stories/fixtures";
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

const snapshot = {
  companyName: "Example Co",
  asOf: "2026-10-01",
  fullyDilutedShares: 10_000_000,
  amountRaisedUsd: null,
  optionPoolAvailable: 500_000,
  latest409a: { pricePerShareUsd: 1.25, date: "2026-09-01" },
  shareClasses: [
    { name: "Common", shares: 6_000_000, percent: 60 },
    { name: "Options", shares: 1_000_000, percent: 10 },
    { name: "Series Seed Preferred", shares: 3_000_000, percent: 30 },
  ],
  holders: [
    {
      name: "Founder Example",
      email: null,
      organization: null,
      security: "Common",
      shares: 6_000_000,
      amountUsd: null,
      percent: 60,
    },
    {
      name: "Granted options",
      email: null,
      organization: null,
      security: "Options",
      shares: 1_000_000,
      amountUsd: null,
      percent: 10,
    },
    {
      name: "Ada Example",
      email: "ada.example@example.test",
      organization: "Example Ventures",
      security: "Series Seed Preferred",
      shares: 1_000_000,
      amountUsd: null,
      percent: 10,
    },
    {
      name: "Dee Newcomer",
      email: null,
      organization: "Newcomer Fund",
      security: "SAFE",
      shares: null,
      amountUsd: 250_000,
      percent: null,
    },
  ],
  updatedAt: "2026-10-15T00:00:00.000Z",
};

const meta = {
  title: "CapTable/CapTablePage",
  component: CapTablePage,
  parameters: { layout: "fullscreen" },
  args: { onShowAgent: () => {} },
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

export const WithSnapshot: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot, syncing: false },
    }),
};

export const ReadingCarta: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [],
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot: null, syncing: true },
    }),
};

export const CartaNeedsSignIn: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [{ ...cartaServer, oauthStatus: "reconnect" }],
    }),
};

/** A kind tab with no contacts of that kind names the kind and offers to add one. */
export const NoAuditors: Story = {
  parameters: { initialEntries: ["/app/cap-table?kind=auditor"] },
  beforeEach: () =>
    mockRpc({ "contacts.list": [contacts[0], contacts[2]], "mcp.servers.list": [cartaServer] }),
};

/** The connection check failed: an error with Try again, never an assumed connection. */
export const ConnectionCheckFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": () => {
        throw new Error("Could not reach the server");
      },
    }),
};

/** Connected, but the Carta agent has not read anything yet. */
export const ConnectedNeverRead: Story = {
  beforeEach: () =>
    mockRpc({
      me: mockMe,
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot: null, syncing: false },
    }),
};

/** Connected, but no model is set up, so the card offers Add a model before the read. */
export const ConnectedNoModel: Story = {
  args: { onOpenModelSettings: () => {} },
  beforeEach: () =>
    mockRpc({
      me: { ...mockMe, needsModel: true },
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot: null, syncing: false },
    }),
};

/** A refresh in progress over an earlier read: the subtitle says Reading Carta. */
export const Refreshing: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot, syncing: true },
    }),
};

/** Shareholders tab: Carta's common holders only. */
export const ShareholdersTab: Story = {
  parameters: { initialEntries: ["/app/cap-table?kind=shareholder"] },
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": { snapshot, syncing: false },
    }),
};

/** The cap table read failed: the error sits where the figures would be. */
export const CapTableLoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": () => {
        throw new Error("Could not load");
      },
    }),
};
