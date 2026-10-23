import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyImportScope } from "./CompanyImportScope";
import { importCatalog } from "./company-import-fixtures";

const meta = {
  title: "Company/Import scope",
  component: CompanyImportScope,
  args: {
    source: importCatalog.sources[0]!,
    scope: {},
    folders: importCatalog.folders,
    onClose: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof CompanyImportScope>;
export default meta;
type Story = StoryObj<typeof meta>;
function renderScope(args: Parameters<typeof CompanyImportScope>[0]) {
  return (
    <div className="min-h-screen p-6">
      <p className="text-sm text-muted-foreground">Import setup</p>
      <CompanyImportScope {...args} />
    </div>
  );
}
export const DataRoom: Story = { render: renderScope };
export const Gmail: Story = {
  render: renderScope,
  args: { source: importCatalog.sources[1]!, scope: { after: "2023-10-21", labelIds: ["INBOX"] } },
};
export const Slack: Story = {
  render: renderScope,
  args: {
    source: { ...importCatalog.sources[2]!, available: true, reason: null },
    scope: { after: "2023-10-21" },
  },
  beforeEach: () =>
    mockRpc({
      "companyImport.channels": (input: { includePrivate: boolean }) => ({
        channels: input.includePrivate
          ? [
              { id: "GSELECTED1", name: "project-planning", private: true, direct: false },
              { id: "DSELECTED1", name: "DSELECTED1", private: true, direct: true },
            ]
          : [
              { id: "CPUBLIC1", name: "general", private: false, direct: false },
              { id: "CPUBLIC2", name: "launches", private: false, direct: false },
            ],
        nextCursor: null,
      }),
    }),
};
export const SlackPrivateSelection: Story = {
  ...Slack,
  args: {
    ...Slack.args,
    scope: { channelIds: ["CPUBLIC2"], privateChannelIds: ["GSELECTED1"], after: "2023-10-21" },
  },
};
export const SlackUnavailable: Story = {
  ...Slack,
  beforeEach: () =>
    mockRpc({
      "companyImport.channels": () => {
        throw new Error("Source unavailable");
      },
    }),
};
