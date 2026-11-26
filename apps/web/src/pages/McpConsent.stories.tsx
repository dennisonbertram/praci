import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { McpConsent } from "./McpConsent";

const meta = {
  title: "Auth/McpConsent",
  component: McpConsent,
  parameters: { layout: "fullscreen" },
  args: {
    clientName: "Claude Code",
    redirectHost: "127.0.0.1:53682",
    spaces: [{ id: "space-1", name: "Northwind" }],
    pending: false,
    failed: false,
    invalid: false,
    onAllow: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof McpConsent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneSpace: Story = {};

export const ChooseSpace: Story = {
  args: {
    spaces: [
      { id: "space-1", name: "Northwind" },
      { id: "space-2", name: "Fabrikam" },
    ],
  },
};

export const Pending: Story = { args: { pending: true } };

export const Failed: Story = { args: { failed: true } };

export const InvalidRequest: Story = { args: { invalid: true } };
