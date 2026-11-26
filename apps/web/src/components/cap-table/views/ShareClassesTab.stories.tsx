import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { shareClassesFixture } from "./fixtures";
import { ShareClassesTab } from "./ShareClassesTab";

const overview = {
  classes: [
    { shareClassId: "sc-seed", outstandingShares: "2500000" },
    { shareClassId: "sc-common", outstandingShares: "7000000" },
  ],
};

const meta = {
  title: "Cap table/Views/ShareClassesTab",
  component: ShareClassesTab,
} satisfies Meta<typeof ShareClassesTab>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Series Seed has more shares outstanding than authorized. */
export const WithClasses: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.shareClasses.list": { items: shareClassesFixture, total: 2, page: 1, pageSize: 100 },
      "equity.overview": overview,
    }),
};
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.shareClasses.list": { items: [], total: 0, page: 1, pageSize: 100 },
      "equity.overview": { classes: [] },
    }),
};
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.shareClasses.list": () => new Promise<never>(() => undefined) }),
};
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({ "equity.shareClasses.list": () => Promise.reject(new Error("Network down")) }),
};
