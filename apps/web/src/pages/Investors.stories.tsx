import type { Contact, InvestorUpdate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { InvestorsPage } from "./Investors";

const contact = (id: string, name: string, kind: Contact["kind"], organization: string | null) => ({
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
  contact("c1", "Ada Example", "investor", "Example Ventures"),
  contact("c2", "Bo Sample", "board", "Sample & Co"),
  contact("c3", "Cy Placeholder", "investor", null),
];
const noUpdates = {
  "investors.updates.list": [],
  "investors.reminder": { cadence: "monthly" },
};
const update = (over: Partial<InvestorUpdate>): InvestorUpdate => ({
  id: "u1",
  audience: "investors",
  subject: "Example Co · 2026-09 update",
  period: "2026-09",
  body: "September went well.",
  status: "draft",
  recipientContactIds: ["c1", "c3"],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  ...over,
});
const cartaServer = { id: "srv_c", enabled: true, endpoint: "https://mcp.app.carta.com/mcp" };

const snapshot = {
  companyName: "Example Co",
  asOf: "2026-10-01",
  fullyDilutedShares: 8_500_000,
  source: "carta" as const,
  sourceRef: null,
  canUndo: false,
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
  title: "Investors/InvestorsPage",
  component: InvestorsPage,
  parameters: { layout: "fullscreen" },
  args: { onShowAgent: () => {} },
  decorators: [
    (Story) => (
      <div className="flex h-[700px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvestorsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({ "contacts.list": contacts, "mcp.servers.list": [cartaServer], ...noUpdates }),
};

/** Audit requests in Action items: a new one, one with a draft ready and new mail, and a closed one behind Show done. */
export const WithAuditRequests: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      ...noUpdates,
      "investors.audits.list": [
        {
          id: "a1",
          fund: "Example Audit LLP",
          asOf: null,
          asOfMatched: true,
          dueDate: "2026-11-30",
          status: "open",
          mailThreadId: "t1",
          connectionId: "k1",
          draftRef: null,
          senderKnown: false,
          notes: "",
          dataRoomItemId: null,
          drafting: false,
          newMail: false,
          createdAt: "2026-10-20T10:00:00.000Z",
        },
        {
          id: "a2",
          fund: "Sample Ventures Fund II",
          asOf: "2026-09-30",
          asOfMatched: false,
          dueDate: "2026-11-15",
          status: "drafted",
          mailThreadId: "t2",
          connectionId: "k1",
          draftRef: "d1",
          senderKnown: true,
          notes: "",
          dataRoomItemId: null,
          drafting: false,
          newMail: true,
          createdAt: "2026-10-18T10:00:00.000Z",
        },
      ],
    }),
};

/** The Portal column: never invited, invited, opened, revoked, and unblocked with no new link yet. */
export const PortalStates: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [
        contact("c1", "Ada Example", "investor", "Example Ventures"),
        {
          ...contact("c2", "Bo Sample", "investor", null),
          portalLinkSentAt: "2026-10-12T10:00:00.000Z",
        },
        {
          ...contact("c3", "Cy Placeholder", "investor", null),
          portalLinkSentAt: "2026-10-12T10:00:00.000Z",
          portalLastSeenAt: "2026-10-13T10:00:00.000Z",
        },
        {
          ...contact("c4", "Di Fund", "investor", "Fund IV"),
          portalLinkSentAt: "2026-10-12T10:00:00.000Z",
          portalBlockedAt: "2026-10-14T10:00:00.000Z",
        },
        {
          ...contact("c5", "Ed Sample", "investor", null),
          portalLastSeenAt: "2026-10-13T10:00:00.000Z",
        },
      ],
      "mcp.servers.list": [cartaServer],
      ...noUpdates,
    }),
};

/** A Posted update in the list, alongside a sent one. */
export const WithPostedUpdate: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.reminder": { cadence: "monthly" },
      "investors.updates.list": [
        update({ id: "u5", status: "posted", sentAt: "2026-10-03T09:00:00.000Z" }),
        update({ id: "u4", status: "sent", sentAt: "2026-09-02T09:00:00.000Z" }),
      ],
    }),
};

/** A draft waiting in Action items, a Sending row, a Partly sent row with Retry, and a sent update. */
export const WithUpdates: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.reminder": { cadence: "quarterly" },
      "investors.updates.list": [
        update({ id: "u1" }),
        update({ id: "u2", subject: "Example Co · 2026-08 update", status: "sending" }),
        update({
          id: "u3",
          subject: "Example Co · 2026-07 update",
          status: "partly_sent",
          sentAt: "2026-08-02T09:00:00.000Z",
          deliveries: [
            { contactId: "c1", name: "Ada Example", state: "sent" },
            { contactId: "c3", name: "Cy Placeholder", state: "failed" },
          ],
        }),
        update({
          id: "u4",
          subject: "Example Co · 2026-06 update",
          status: "sent",
          sentAt: "2026-07-02T09:00:00.000Z",
        }),
      ],
    }),
};

export const CartaNotConnected: Story = {
  beforeEach: () => mockRpc({ "contacts.list": contacts, "mcp.servers.list": [] }),
};

/** No table yet: pick where it comes from. */
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
      "investors.capTable": { snapshot, syncing: false },
    }),
};

export const ReadingCarta: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [],
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot: null, syncing: true },
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
export const NoBoardMembers: Story = {
  parameters: { initialEntries: ["/app/investors?kind=board"] },
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
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot: null, syncing: false },
    }),
};

/** Connected, but no model is set up, so the card offers Add a model before the read. */
export const ConnectedNoModel: Story = {
  args: { onOpenModelSettings: () => {}, needsModel: true },
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot: null, syncing: false },
    }),
};

/** A refresh in progress over an earlier read: the subtitle says Reading Carta. */
export const Refreshing: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot, syncing: true },
    }),
};

/** A typed-in table: rows are edited in place and saved on blur. */
export const TypedIn: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [],
      "investors.capTable": {
        snapshot: {
          ...snapshot,
          source: "native" as const,
          asOf: "2026-10-20",
          fullyDilutedShares: 8_500_000,
          holders: snapshot.holders.filter((h) => h.security !== "SAFE"),
        },
        syncing: false,
      },
      "investors.capTableSave": () => new Promise(() => {}),
    }),
};

const sheetRef = { driveFileId: "sheet-file", name: "Cap table" };

/** A sheet read over an earlier table: the source line says Reading sheet. */
export const ReadingSheet: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [],
      "investors.capTable": {
        snapshot: { ...snapshot, source: "sheet" as const, sourceRef: sheetRef },
        syncing: false,
        reading: true,
        lastReadFailed: false,
      },
    }),
};

/** The last read failed: the old table stays and the source line turns to the warning color. */
export const SheetReadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [],
      "investors.capTable": {
        snapshot: { ...snapshot, source: "sheet" as const, sourceRef: sheetRef },
        syncing: false,
        reading: false,
        lastReadFailed: true,
      },
    }),
};

/** The first read of a newly chosen sheet failed, so there is no table to show. */
export const FirstSheetReadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [],
      "investors.capTable": {
        snapshot: {
          ...snapshot,
          source: "sheet" as const,
          sourceRef: sheetRef,
          holders: [],
          fullyDilutedShares: 0,
        },
        syncing: false,
        reading: false,
        lastReadFailed: true,
      },
    }),
};

/** Right after a source switch the source menu offers Undo. */
export const SwitchedSource: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot: { ...snapshot, canUndo: true }, syncing: false },
    }),
};

/** The cap table read failed: the error sits where the figures would be. */
export const CapTableLoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "investors.capTable": () => {
        throw new Error("Could not load");
      },
    }),
};

const capFolders = [
  { id: "f1", name: "Finance", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "f2", name: "Cap Table", parentId: "f1", createdAt: "2026-10-01T00:00:00.000Z" },
];
const document = (id: string, name: string, docType: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 120_000,
  folderId: "f2",
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  facets: {
    docType,
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-12T00:00:00.000Z",
});

/** Files in the Finance / Cap Table Data room folder show under the table. */
export const WithDocuments: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "dataRoom.folders": capFolders,
      "dataRoom.items.list": {
        items: [
          document("i1", "Example option plan.pdf", "contract"),
          document("i2", "Sample seed agreement.pdf", "contract"),
        ],
        nextCursor: null,
      },
    }),
};

const holder = (
  name: string,
  security: string,
  shares: number | null,
  percent: number | null,
  amountUsd: number | null = null,
) => ({
  name,
  email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.test`,
  organization: null,
  security,
  shares,
  amountUsd,
  percent,
});

/** A full table: ten holders and four SAFEs, so the page scrolls under its fixed header. */
const fullSnapshot = {
  ...snapshot,
  fullyDilutedShares: 9_350_000,
  amountRaisedUsd: null,
  optionPoolAvailable: 600_000,
  shareClasses: [
    { name: "Common", shares: 8_400_000, percent: 84 },
    { name: "Options", shares: 1_000_000, percent: 10 },
  ],
  holders: [
    holder("Founder One", "Common", 3_000_000, 30),
    holder("Founder Two", "Common", 3_000_000, 30),
    holder("Founder Three", "Common", 1_500_000, 15),
    holder("Casey Advisor", "Common", 250_000, 2.5),
    holder("Early Employee A", "Options", 250_000, 2.5),
    holder("Early Employee B", "Options", 250_000, 2.5),
    holder("Early Employee C", "Options", 200_000, 2),
    holder("Early Employee D", "Options", 150_000, 1.5),
    holder("Consultant E", "Options", 100_000, 1),
    holder("Consultant F", "Options", 50_000, 0.5),
    holder("Angel One", "SAFE", null, null, 100_000),
    holder("Angel Two", "SAFE", null, null, 100_000),
    holder("Angel Three", "SAFE", null, null, 100_000),
    holder("Angel Four", "SAFE", null, null, 50_000),
  ],
};

/** A long table with SAFE holders shown as plain rows outside the percent column. */
export const FullTableWithSafes: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [
        contact("c9", "Casey Advisor", "other", "Independent advisor"),
        contact("c10", "Angel One", "investor", null),
      ],
      "mcp.servers.list": [cartaServer],
      "investors.capTable": { snapshot: fullSnapshot, syncing: false },
    }),
};

/** Two share classes: a donut would repeat the cards, so the summary is one row and the table starts higher. */
export const TwoShareClasses: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [contact("c9", "Casey Advisor", "other", "Independent advisor")],
      "mcp.servers.list": [cartaServer],
      "carta.capTable": {
        snapshot: {
          ...fullSnapshot,
          shareClasses: [
            { name: "Common", shares: 8_400_000, percent: 84 },
            { name: "Options", shares: 1_600_000, percent: 16 },
          ],
        },
        syncing: false,
      },
    }),
};

/** Carta is connected and the cap table is still loading: the skeleton has the tabs, cards and rows of the page. */
export const LoadingCapTable: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": contacts,
      "mcp.servers.list": [cartaServer],
      "carta.capTable": () => new Promise(() => {}),
    }),
};
