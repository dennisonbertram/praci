import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { demoRequest } from "./fixtures";
import { LinkContact } from "./LinkContact";

const contact = (id: string, name: string, email: string | null) =>
  ({ id, name, email, kind: "investor" }) as never;

const meta = {
  title: "Cap table/Link contact",
  component: LinkContact,
  decorators: [withPageBehind()],
  args: {
    holder: { ...demoRequest, contactId: null },
    linkedContactIds: new Set(["c3"]),
    open: true,
    onOpenChange: () => undefined,
    onLinked: () => undefined,
  },
} satisfies Meta<typeof LinkContact>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An unlinked holder; one contact is taken by another holder and not offered. */
export const Unlinked: Story = {
  beforeEach: () =>
    mockRpc({
      "contacts.list": [
        contact("c2", "Blue Example Fund IR", "ir@blue-example.test"),
        contact("c3", "Taken Example", "taken@example.test"),
      ],
      "equity.accessHolders.linkContact": { ...demoRequest, contactId: "c2" },
    }),
};
