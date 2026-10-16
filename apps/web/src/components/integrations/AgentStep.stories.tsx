import { Dialog, DialogContent } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockBots } from "../../stories/fixtures-0";
import { AgentStep } from "./AgentStep";

/** The step renders the dialog's title and description, so it needs a dialog around it. */
const meta = {
  title: "Integrations/Agent step",
  component: AgentStep,
  args: {
    appName: "Sample Mail",
    bots: mockBots,
    busy: false,
    error: null,
    onContinue: () => undefined,
    onSkip: () => undefined,
  },
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the dialog</p>
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <Story />
          </DialogContent>
        </Dialog>
      </>
    ),
  ],
} satisfies Meta<typeof AgentStep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Busy: Story = { args: { busy: true } };
export const WithError: Story = { args: { error: "Could not save access. Try again." } };
export const NoAgents: Story = { args: { bots: [] } };
