import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../stories/decorators";
import { Button } from "./button";
import { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetTitle } from "./sheet";

const meta = {
  title: "UI/Sheet",
  component: Sheet,
  decorators: [withPageBehind()],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Also shows: SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetBody, SheetFooter",
      },
    },
  },
} satisfies Meta<typeof Sheet>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A bottom sheet with a title, a scrolling body and a footer. */
export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetTitle>Sample sheet</SheetTitle>
        <SheetBody>
          <p>Content that scrolls when it is taller than the sheet.</p>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button>Done</Button>} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
