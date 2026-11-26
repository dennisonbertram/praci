import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { DeliverDocument } from "./DeliverDocument";
import { demoRequest } from "./fixtures";

const doc = (id: string, name: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 120_000,
  folderId: null,
  source: "upload",
});

const meta = {
  title: "Cap table/Deliver document",
  component: DeliverDocument,
  decorators: [withPageBehind()],
  args: {
    open: true,
    onOpenChange: () => undefined,
    holders: [
      demoRequest,
      { ...demoRequest, stakeholderId: "s9", name: "No Contact", contactId: null },
    ],
  },
} satisfies Meta<typeof DeliverDocument>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two holders chosen, one without an investor contact. */
export const Deliver: Story = {
  beforeEach: () =>
    mockRpc({
      "dataRoom.items.list": {
        items: [
          doc("d1", "2026 Q3 investor letter.pdf"),
          doc("d2", "Stock purchase agreement.pdf"),
        ],
        nextCursor: null,
      },
      "investors.share": { links: [] },
    }),
};

/** An empty Data room. */
export const NoDocuments: Story = {
  beforeEach: () => mockRpc({ "dataRoom.items.list": { items: [], nextCursor: null } }),
};
