import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  // Dialogs render in a portal, so give the story root something to show.
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the dialog</p>
        <Story />
      </>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription",
      },
    },
  },
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sample dialog</DialogTitle>
          <DialogDescription>Invented content for the story.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Closed: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open dialog</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sample dialog</DialogTitle>
          <DialogDescription>Opens from the trigger.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No corner button</DialogTitle>
          <DialogDescription>The footer close button is the only way out.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A dialog title that is long enough to wrap onto a second line</DialogTitle>
          <DialogDescription>
            {"This description keeps going to show how the dialog handles a long paragraph. ".repeat(
              6,
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
