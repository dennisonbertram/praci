import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BlockscoutConnectDialog } from "./BlockscoutConnectDialog";

const meta = {
  title: "Integrations/Blockscout connect dialog",
  component: BlockscoutConnectDialog,
  args: { onConnected: () => undefined, onClose: () => undefined },
  decorators: [
    (Story) => (
      <div className="min-h-[360px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "finance.cryptoConnect": { ok: true } }),
} satisfies Meta<typeof BlockscoutConnectDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
