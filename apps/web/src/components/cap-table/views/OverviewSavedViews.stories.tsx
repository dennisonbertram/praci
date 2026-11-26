import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { OverviewSavedViews } from "./OverviewSavedViews";

const at = "2026-01-01T00:00:00.000Z";
const meta = {
  title: "Cap table/Overview/Saved views",
  component: OverviewSavedViews,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OverviewSavedViews>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing saved yet. */
export const None: Story = {
  beforeEach: () =>
    mockRpc({ "equity.savedViews.list": { items: [], total: 0, page: 1, pageSize: 500 } }),
};

/** Two saved overview views; the current URL already matches the second one's params. */
export const Two: Story = {
  parameters: { initialEntries: ["/app/cap-table?view=stakeholder&fd=0"] },
  beforeEach: () =>
    mockRpc({
      "equity.savedViews.list": {
        items: [
          {
            id: "v1",
            page: "overview",
            name: "Fully diluted",
            params: "",
            createdAt: at,
            updatedAt: at,
          },
          {
            id: "v2",
            page: "overview",
            name: "By stakeholder, outstanding",
            params: "view=stakeholder&fd=0",
            createdAt: at,
            updatedAt: at,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 500,
      },
    }),
};
