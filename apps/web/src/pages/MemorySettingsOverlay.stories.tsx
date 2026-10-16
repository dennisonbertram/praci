import type { SpaceMemoryConfig } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { MemorySettingsOverlay } from "./MemorySettingsOverlay";

const meta = {
  title: "Settings/MemorySettingsOverlay",
  component: MemorySettingsOverlay,
  parameters: {
    docs: { description: { component: "Also shows: ScopePicker (the Default scope toggles)" } },
  },
  args: { onClose: () => undefined, onConfigChange: () => undefined, config: null },
  decorators: [withPageBehind()],
} satisfies Meta<typeof MemorySettingsOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

const beforeEach = () => mockRpc({ "memory.list": [], "bots.list": [], "bots.listArchived": [] });

const connected: SpaceMemoryConfig = {
  provider: "serenity",
  settings: {
    endpoint: "https://memory.example.com/mcp",
    brainLabel: "demo",
    allowWrites: "false",
  },
  defaultMemoryScope: "isolated",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const NotConnected: Story = { beforeEach };
export const Loading: Story = { beforeEach, args: { config: undefined } };
export const Connected: Story = { beforeEach, args: { config: connected } };
export const ConnectedShared: Story = {
  beforeEach,
  args: { config: { ...connected, defaultMemoryScope: "shared" } },
};
export const UnknownProvider: Story = {
  beforeEach,
  args: { config: { ...connected, provider: "removed" } },
};
export const Embedded: Story = { beforeEach, args: { embedded: true } };
