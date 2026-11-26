import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexLimits } from "./BrexLimits";
import { limitsFixture } from "./fixtures";

const meta = {
  title: "Brex/Limits",
  component: BrexLimits,
  parameters: { initialEntries: ["/app/brex/limits"] },
} satisfies Meta<typeof BrexLimits>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => mockRpc({ "brexCards.limits": limitsFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.limits": { ...limitsFixture, limits: [] } }),
};

export const Partial: Story = {
  beforeEach: () => mockRpc({ "brexCards.limits": { ...limitsFixture, partial: true } }),
};
