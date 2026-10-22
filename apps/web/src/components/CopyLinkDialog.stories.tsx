import type { Meta, StoryObj } from "@storybook/react-vite";
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
