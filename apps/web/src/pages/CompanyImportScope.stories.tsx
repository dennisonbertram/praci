import type { Meta, StoryObj } from "@storybook/react-vite";
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
