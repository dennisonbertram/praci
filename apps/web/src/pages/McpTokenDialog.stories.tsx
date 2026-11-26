import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../stories/decorators";
import { McpTokenDialog, McpTokenReveal } from "./McpTokenDialog";

const spaces = [
  { id: "space-1", name: "Northwind", current: true },
  { id: "space-2", name: "Side project", current: false },
];

const meta = {
  title: "Settings/Create token dialog",
  component: McpTokenDialog,
  decorators: [withPageBehind()],
  args: {
    spaces,
    mcpUrl: "https://example.ts.net/mcp",
    onCreated: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof McpTokenDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};

/** One Space: the Space choice is not shown. */
export const OneSpace: Story = { args: { spaces: [spaces[0]!] } };

/** The step after Create; the invented token is not a real credential. */
export const TokenShownOnce: Story = {
  render: () => (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Token created</DialogTitle>
        </DialogHeader>
        <McpTokenReveal
          token="praci_pat_EXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLEEXAMPLE0"
          mcpUrl="https://example.ts.net/mcp"
          onDone={() => undefined}
        />
      </DialogContent>
    </Dialog>
  ),
};
