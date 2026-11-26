import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { OptionBulkCancelDialog } from "./OptionBulkCancelDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const meta = {
  title: "Cap table/Options/OptionBulkCancelDialog",
  component: OptionBulkCancelDialog,
  decorators: [withPageBehind()],
  args: {
    grants: [demoOptionGrant(), demoOptionGrant({ id: "grant-2", label: "ES-41" })],
    onClose: () => {},
    onDone: () => {},
  },
  beforeEach: () => mockRpc({ "equity.optionActions.cancel": demoOptionGrant() }),
} satisfies Meta<typeof OptionBulkCancelDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoGrants: Story = {};
