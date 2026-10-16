import { Dialog, DialogContent } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SignInStep } from "./SignInStep";

/** The step renders the dialog's title and description, so it needs a dialog around it. */
const meta = {
  title: "Integrations/Sign-in step",
  component: SignInStep,
  args: {
    appName: "Sample Mail",
    state: { kind: "waiting" },
    onOpenAgain: () => undefined,
    onTryAgain: () => undefined,
    onClose: () => undefined,
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
} satisfies Meta<typeof SignInStep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {};
export const WaitingWindowClosed: Story = { args: { state: { kind: "waiting", closed: true } } };
export const WaitingNoRetry: Story = { args: { onOpenAgain: undefined } };
export const Blocked: Story = { args: { state: { kind: "blocked" } } };
export const Failed: Story = {
  args: { state: { kind: "failed", message: "The provider refused the sign-in." } },
};
