import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockRpc } from "../lib/__mocks__/rpc";
import type { RakazoDesktop } from "../lib/desktop";
import { DefaultRunsOnSection, RunsOnPicker } from "./RunsOnPicker";

const meta = {
  title: "Shell/Runs on picker",
  component: RunsOnPicker,
  args: { value: "docker", onChange: () => {} },
  parameters: { docs: { description: { component: "Also shows: DefaultRunsOnSection" } } },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <RunsOnPicker {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof RunsOnPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sandbox: Story = {};

/** The warning shows only once This Mac is selected. */
export const ThisMac: Story = { args: { value: "this-mac" } };

export const Disabled: Story = { args: { disabled: true } };

/** Hidden unless the server and the desktop app both allow host access. */
export const DefaultSetting: StoryObj<typeof DefaultRunsOnSection> = {
  render: () => <DefaultRunsOnSection />,
  beforeEach: () => {
    window.rakazoDesktop = { platform: "darwin" } as unknown as RakazoDesktop;
    mockRpc({
      "deployment.get": () => ({ computerHost: "this-mac", canChooseHostComputer: true }),
    });
    return () => {
      window.rakazoDesktop = undefined;
    };
  },
};
