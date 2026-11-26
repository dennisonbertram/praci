import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withVisibleRoot } from "../../stories/decorators";
import { OmiSegments, OmiTrash } from "./OmiSegments";
import { mockSegments } from "./omi-fixtures";

const meta = {
  title: "Integrations/OmiSegments",
  component: OmiSegments,
  beforeEach: () => mockRpc({ "omi.segments.list": mockSegments }),
} satisfies Meta<typeof OmiSegments>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {};
export const Trash: Story = {
  render: () => <OmiTrash />,
  parameters: { layout: "fullscreen" },
};
/** With no stretches the list renders nothing. */
export const NothingYet: Story = {
  decorators: [withVisibleRoot("Nothing is shown until a recording is sorted.")],
  beforeEach: () => mockRpc({ "omi.segments.list": [] }),
};
