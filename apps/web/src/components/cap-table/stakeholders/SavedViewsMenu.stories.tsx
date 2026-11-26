import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { SavedViewsMenu } from "./SavedViewsMenu";

const at = "2026-01-01T00:00:00.000Z";
const meta = {
  title: "Cap table/Stakeholders/Saved views",
  component: SavedViewsMenu,
} satisfies Meta<typeof SavedViewsMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const None: Story = {
  beforeEach: () =>
    mockRpc({ "equity.savedViews.list": { items: [], total: 0, page: 1, pageSize: 100 } }),
};

export const Two: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.savedViews.list": {
        items: [
          {
            id: "v1",
            page: "stakeholders",
            name: "Ex-employees",
            params: "rel=ex_employee",
            createdAt: at,
            updatedAt: at,
          },
          {
            id: "v2",
            page: "stakeholders",
            name: "Investors",
            params: "rel=investor",
            createdAt: at,
            updatedAt: at,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      },
    }),
};
