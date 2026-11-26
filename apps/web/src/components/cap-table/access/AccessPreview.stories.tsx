import type { EquityAccessView } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { AccessPreview } from "./AccessPreview";

const restricted: EquityAccessView = {
  level: "restricted",
  fairMarketValue: null,
  personal: {
    stakeholderId: "s3",
    name: "Casey Placeholder",
    holdings: [
      {
        kind: "option",
        label: "ES-3",
        shareClassName: "Common",
        quantity: "40000",
        principalCents: null,
        issueDate: "2024-02-01",
      },
    ],
  },
};

const meta = {
  title: "Cap table/Access preview",
  component: AccessPreview,
  decorators: [withPageBehind()],
  args: {
    stakeholderId: "s3",
    name: "Casey Placeholder",
    open: true,
    onOpenChange: () => undefined,
  },
} satisfies Meta<typeof AccessPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An employee at Restricted: only their own options. */
export const Restricted: Story = {
  beforeEach: () => mockRpc({ "equity.accessView.get": restricted }),
};

/** A holder with nothing outstanding. */
export const NoAccess: Story = {
  beforeEach: () => mockRpc({ "equity.accessView.get": { level: "none" } }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () => mockRpc({ "equity.accessView.get": () => new Promise<never>(() => undefined) }),
};
