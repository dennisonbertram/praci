import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { OptionRepriceDialog } from "./OptionRepriceDialog";
import { demoOptionGrant } from "./option-grant-fixture";

const meta = {
  title: "Cap table/Options/OptionRepriceDialog",
  component: OptionRepriceDialog,
  decorators: [withPageBehind()],
  args: {
    grants: [demoOptionGrant(), demoOptionGrant({ id: "grant-2", label: "ES-41" })],
    onClose: () => {},
    onDone: () => {},
  },
  beforeEach: () => mockRpc({ "equity.optionGrants.update": demoOptionGrant() }),
} satisfies Meta<typeof OptionRepriceDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoGrants: Story = {};
