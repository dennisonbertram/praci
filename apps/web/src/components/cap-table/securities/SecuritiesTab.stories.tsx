import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { SecuritiesTab } from "./SecuritiesTab";

const meta = {
  title: "Cap table/Securities/SecuritiesTab",
  component: SecuritiesTab,
} satisfies Meta<typeof SecuritiesTab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.certificates.list": { items: [], total: 0, page: 1, pageSize: 25 },
      "equity.shareClasses.list": { items: [], total: 0, page: 1, pageSize: 500 },
    }),
};
