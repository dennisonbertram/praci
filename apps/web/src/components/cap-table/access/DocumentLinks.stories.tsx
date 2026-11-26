import type { EquityDocumentLink } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { DocumentLinks } from "./DocumentLinks";
import { page } from "./fixtures";

const link = (
  id: string,
  dataRoomItemId: string,
  name: string,
  target: EquityDocumentLink["target"],
  targetLabel: string,
  createdAt: string,
): EquityDocumentLink => ({ id, dataRoomItemId, name, target, targetLabel, createdAt });

/** Invented links, one of each kind. */
export const demoLinks: EquityDocumentLink[] = [
  link(
    "l1",
    "d1",
    "Stock purchase agreement.pdf",
    { kind: "stakeholder", id: "s2" },
    "Blue Example Fund",
    "2026-10-02T09:00:00.000Z",
  ),
  link(
    "l2",
    "d2",
    "Certificate ledger.pdf",
    { kind: "certificate", id: "c1" },
    "CS-12",
    "2026-10-05T14:30:00.000Z",
  ),
  link(
    "l3",
    "d3",
    "Subscription agreement.pdf",
    { kind: "round", id: "r1" },
    "Series A",
    "2026-10-11T11:15:00.000Z",
  ),
];

const doc = (id: string, name: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 120_000,
  folderId: null,
  source: "upload",
});

const documents = {
  items: [doc("d1", "Stock purchase agreement.pdf"), doc("d2", "Certificate ledger.pdf")],
  nextCursor: null,
};

const meta = {
  title: "Cap table/Document links",
  component: DocumentLinks,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentLinks>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One link of each kind. */
export const Linked: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.documentLinks.list": demoLinks,
      "equity.documentLinks.create": demoLinks[0],
      "equity.documentLinks.delete": { ok: true },
      "dataRoom.items.list": documents,
      "equity.stakeholders.list": page([
        { id: "s2", name: "Blue Example Fund" },
        { id: "s3", name: "Casey Placeholder" },
      ]),
      "equity.certificates.list": page([{ id: "c1", label: "CS-12" }]),
      "equity.fundingRounds.list": page([{ id: "r1", name: "Series A" }]),
    }),
};

/** Nothing attached yet. */
export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.documentLinks.list": [] }),
};
