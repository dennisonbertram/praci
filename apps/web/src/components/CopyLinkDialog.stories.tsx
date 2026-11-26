import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@rakazo/ui-web";
import { withPageBehind } from "../stories/decorators";
import { CopyLinkDialog } from "./CopyLinkDialog";

const link = (contactId: string, name: string) => ({
  contactId,
  name,
  link: `https://app.example.test/portal/open#${contactId}-example-token`,
});

const meta = {
  title: "Components/CopyLinkDialog",
  component: CopyLinkDialog,
  decorators: [withPageBehind()],
  args: { links: [link("c1", "Ada Example")], onClose: () => {} },
} satisfies Meta<typeof CopyLinkDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneLink: Story = {};
/** Sharing a document with several investors when no email provider is configured. */
export const SeveralLinks: Story = {
  args: { links: [link("c1", "Ada Example"), link("c2", "Bo Sample")] },
};

/** An artifact share link: its own title and note, and a Stop sharing action beside Done. */
export const WithNoteAndAction: Story = {
  args: {
    links: [link("a1", "Weekly dashboard")],
    title: "Share link",
    note: "Anyone with this link can view this version until you stop sharing or for 30 days.",
    actions: <Button variant="outline">Stop sharing</Button>,
  },
};
