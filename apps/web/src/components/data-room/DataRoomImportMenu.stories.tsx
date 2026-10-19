import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { DataRoomImportMenu } from "./DataRoomImportMenu";

const meta = {
  title: "Data room/DataRoomImportMenu",
  component: DataRoomImportMenu,
  args: { folderPath: ["Finance", "Cap Table"], onDone: () => undefined },
  beforeEach: () =>
    mockRpc({
      "connections.list": [
        {
          id: "c1",
          connectorId: "google",
          provider: "gmail",
          displayName: "Example mail",
          status: "connected",
        },
      ],
      "connections.catalog": [
        { connectorId: "google", slug: "gmail" },
        { connectorId: "google", slug: "googledrive" },
      ],
      "mcp.servers.list": [],
    }),
} satisfies Meta<typeof DataRoomImportMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Email is connected; Google Drive and Box lead to their connect pages. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Import" }));
  },
};
