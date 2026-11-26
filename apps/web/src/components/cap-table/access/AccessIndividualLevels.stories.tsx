import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { AccessIndividualLevels } from "./AccessIndividualLevels";
import { demoGrants, demoGroups, demoRequest, demoStakeholders, page } from "./fixtures";

const meta = {
  title: "Cap table/Access individual levels",
  component: AccessIndividualLevels,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessIndividualLevels>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Group levels for most, one override. */
export const Individuals: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": page(demoStakeholders),
      "equity.accessGrants.list": page(demoGrants),
      "equity.accessGroups.list": demoGroups,
      "equity.accessHolders.list": page([demoRequest]),
      "equity.accessGrants.set": demoGrants[0],
    }),
};

/** No stakeholders yet. */
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": page([]),
      "equity.accessGrants.list": page([]),
      "equity.accessGroups.list": demoGroups,
      "equity.accessHolders.list": page([demoRequest]),
    }),
};
