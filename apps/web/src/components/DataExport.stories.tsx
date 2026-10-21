import type { AccountExport } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { DataExportSection } from "./DataExport";

const meta = { title: "Settings/Data export" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const job = (over: Partial<AccountExport>): AccountExport => ({
  id: "export-1",
  status: "ready",
  progress: 100,
  expiresAt: "2030-01-08T12:00:00.000Z",
  ...over,
});

const render = () => (
  <div className="w-[480px]">
    <DataExportSection />
  </div>
);

/** Nothing requested yet. */
export const Idle: Story = {
  render,
  beforeEach: () =>
    mockRpc({
      "account.exportLatest": null,
      "account.exportRequest": job({ status: "running", progress: 0 }),
    }),
};

/** The worker is building the zip. */
export const Preparing: Story = {
  render,
  beforeEach: () => mockRpc({ "account.exportLatest": job({ status: "running", progress: 40 }) }),
};

/** The zip is ready and stays available until it expires. */
export const Ready: Story = {
  render,
  beforeEach: () => mockRpc({ "account.exportLatest": job({}) }),
};

/** The last export failed; the button offers another try. */
export const Failed: Story = {
  render,
  beforeEach: () => mockRpc({ "account.exportLatest": job({ status: "failed", progress: 30 }) }),
};
