import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ComputersUnavailableHint } from "./ComputersUnavailableHint";

const meta = {
  title: "Shell/Computers unavailable hint",
  component: ComputersUnavailableHint,
  parameters: {
    layout: "padded",
    docs: { description: { component: "Also shows: UnavailableCopy" } },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComputersUnavailableHint>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = { args: { sandboxProvider: "none", onOpenComputerSettings: () => {} } };

export const DockerNotResponding: Story = { args: { sandboxProvider: "docker" } };

export const NoRetry: Story = { args: { sandboxProvider: "none", showRetry: false } };

export const StillUnavailableAfterCheck: Story = {
  args: { sandboxProvider: "none" },
  beforeEach: () => mockRpc({ health: { ok: true }, me: { sandboxProvider: "none" } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Check again" }),
    );
  },
};

export const CheckFailed: Story = {
  args: { sandboxProvider: "none" },
  beforeEach: () =>
    mockRpc({
      health: () => {
        throw new Error("Network down");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Check again" }),
    );
  },
};

export const Recovered: Story = {
  args: { sandboxProvider: "none" },
  beforeEach: () => mockRpc({ health: { ok: true }, me: { sandboxProvider: "docker" } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Check again" }),
    );
  },
};
