import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FolderDocuments } from "./FolderDocuments";

const item = (id: string, name: string, docType: string | null) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 90_000,
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

const meta = {
  title: "Data room/FolderDocuments",
  component: FolderDocuments,
  args: { folderPath: ["Finance", "Cap Table"] },
} satisfies Meta<typeof FolderDocuments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  beforeEach: () =>
    mockRpc({
      "dataRoom.folders": [
        { id: "f1", name: "Finance", parentId: null, createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "f2", name: "Cap Table", parentId: "f1", createdAt: "2026-10-01T00:00:00.000Z" },
      ],
      "dataRoom.items.list": {
        items: [
          item("i1", "Example option plan.pdf", "contract"),
          item("i2", "Scan 001.pdf", null),
        ],
        nextCursor: null,
      },
    }),
};

/** An empty or missing folder renders nothing. */
export const Empty: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-8">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "dataRoom.folders": [] }),
};
