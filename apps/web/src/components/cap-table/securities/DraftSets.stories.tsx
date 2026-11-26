import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { DraftSets } from "./DraftSets";

const set = (id: string, name: string, status: string, count: number) => ({
  id,
  name,
  status,
  securityKind: "certificate",
  items: Array.from({ length: count }, () => ({})),
  issuedAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const meta = {
  title: "Cap table/Securities/DraftSets",
  component: DraftSets,
  args: { kind: "certificate", onIssued: () => {} },
} satisfies Meta<typeof DraftSets>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.draftSets.list": {
        items: [set("d1", "Founder restock", "draft", 3), set("d2", "Advisor shares", "issued", 2)],
        total: 2,
        page: 1,
        pageSize: 100,
      },
    }),
};
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "equity.draftSets.list": { items: [], total: 0, page: 1, pageSize: 100 } }),
};
