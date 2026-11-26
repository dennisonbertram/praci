import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../stories/decorators";
import { ArtifactShareDialog } from "./ArtifactShareDialog";

const meta = {
  title: "Components/ArtifactShareDialog",
  component: ArtifactShareDialog,
  decorators: [withPageBehind()],
  args: {
    name: "Weekly dashboard",
    url: "https://app.example.test/s#example-token",
    expiresAt: "2030-02-10T12:00:00.000Z",
    busy: false,
    error: null,
    onReplace: () => {},
    onStop: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof ArtifactShareDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Right after the link was made: the only time it can be copied. */
export const NewLink: Story = {};
/** Reopening an existing share: the link is not stored, so Replace link and Stop sharing remain. */
export const ExistingShare: Story = { args: { url: null } };
