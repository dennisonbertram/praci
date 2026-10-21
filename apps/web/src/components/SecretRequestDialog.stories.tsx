import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { withPageBehind } from "../stories/decorators";
import { SecretRequestDialog } from "./SecretRequestDialog";

const meta = {
  title: "Chat/SecretRequestDialog",
  component: SecretRequestDialog,
  decorators: [withPageBehind()],
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSubmit: () => undefined,
    name: "EXAMPLE_API_KEY",
    description: "Example access for the weekly report. The key is stored for this bot only.",
  },
} satisfies Meta<typeof SecretRequestDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleLine: Story = {};

export const MultiLine: Story = {
  args: { name: "EXAMPLE_PRIVATE_KEY" },
  play: async () => {
    await userEvent.click(await within(document.body).findByRole("tab", { name: "Multi line" }));
  },
};

export const Login: Story = {
  args: { name: "Password", login: true, description: "Sign in to the example site." },
};
