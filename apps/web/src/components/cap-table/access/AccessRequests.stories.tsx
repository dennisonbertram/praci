import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { AccessRequests } from "./AccessRequests";
import { demoRequest, page } from "./fixtures";

const meta = {
  title: "Cap table/Access requests",
  component: AccessRequests,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessRequests>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One investor asking for full detail. */
export const OneRequest: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessHolders.list": page([demoRequest]),
      "equity.accessHolders.resolveRequest": { ...demoRequest, requestedLevel: null },
    }),
};

/** Nothing waiting. */
export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.accessHolders.list": page([]) }),
};
