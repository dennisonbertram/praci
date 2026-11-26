import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { healthFindingsFixture } from "./fixtures";
import { HealthChecks } from "./HealthChecks";

const meta = {
  title: "Cap table/Views/HealthChecks",
  component: HealthChecks,
} satisfies Meta<typeof HealthChecks>;
export default meta;
type Story = StoryObj<typeof meta>;

const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 200 });
export const WithFindings: Story = {
  beforeEach: () => mockRpc({ "equity.healthFindings.list": page(healthFindingsFixture) }),
};
export const Clean: Story = {
  beforeEach: () => mockRpc({ "equity.healthFindings.list": page([]) }),
};
