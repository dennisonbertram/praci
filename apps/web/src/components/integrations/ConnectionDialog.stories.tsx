import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { withPageBehind } from "../../stories/decorators";
import { ConnectionDialog } from "./ConnectionDialog";

const meta = {
  title: "Integrations/ConnectionDialog",
  component: ConnectionDialog,
  decorators: [withPageBehind()],
  args: {
    title: "Connect Demo",
    name: "Demo",
    logo: null,
    submitLabel: "Connect",
    fields: [{ id: "key", label: "API key", type: "password" }],
    onSubmit: async () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof ConnectionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneField: Story = {};

export const WithHelpLinkAndTwoFields: Story = {
  args: {
    fields: [
      { id: "name", label: "Key name" },
      {
        id: "secret",
        label: "Private key",
        type: "password",
        help: { href: "https://example.com/keys", label: "Where to find your key" },
      },
    ],
  },
};

export const SubmitError: Story = {
  args: {
    onSubmit: async () => {
      throw new Error("The key was refused");
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByLabelText("API key"), "demo-key");
    await userEvent.click(await body.findByRole("button", { name: "Connect" }));
  },
};
