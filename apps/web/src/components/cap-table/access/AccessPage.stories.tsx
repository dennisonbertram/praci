import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { AccessPage } from "./AccessPage";
import { demoGrants, demoGroups, demoRequest, demoStakeholders, page } from "./fixtures";

const meta = {
  title: "Cap table/Access",
  component: AccessPage,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens on the investors list. */
export const Access: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessHolders.list": page([demoRequest]),
      "equity.accessGroups.list": demoGroups,
      "equity.stakeholders.list": page(demoStakeholders),
      "equity.accessGrants.list": page(demoGrants),
    }),
};
