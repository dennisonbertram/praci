import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { mockBot } from "../../stories/fixtures-7";
import { BotSettings } from "./bot-panel";

// Registered per story: responses reset after a meta-level beforeEach would run.
const setup = () => {
  mockRpc({
    "voice.voices": [
      { id: "voice_1", label: "Calm" },
      { id: "voice_2", label: "Bright" },
    ],
    "models.credentials": [],
    "models.list": [],
    "scratchpad.list": [],
    "botSecrets.list": [],
    "memory.list": [],
    "agentSkills.list": [],
  });
};

const meta = {
  title: "Shell/Bot settings",
  component: BotSettings,
  args: {
    bot: mockBot,
    memoryProviderConfigured: false,
    onSkillsChange: () => undefined,
    onSave: async () => undefined,
    onExport: async () => undefined,
    onClear: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-96 p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { docs: { description: { component: "Also shows: ComputerModePicker" } } },
} satisfies Meta<typeof BotSettings>;
export default meta;

type Story = StoryObj<typeof meta>;

const openAdvanced: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByText("Advanced"));
};

export const Default: Story = { beforeEach: setup };

export const AdvancedOpen: Story = { beforeEach: setup, play: openAdvanced };

export const AdvancedWithMemoryScopeAndDisabledTools: Story = {
  beforeEach: setup,
  args: {
    memoryProviderConfigured: true,
    bot: { ...mockBot, computerMode: "dedicated", disabledBuiltinTools: ["web_search"] },
  },
  play: openAdvanced,
};

export const NotificationsOff: Story = {
  beforeEach: setup,
  args: { bot: { ...mockBot, notifyOnFinish: false } },
};

export const LongProfileText: Story = {
  beforeEach: setup,
  args: {
    bot: {
      ...mockBot,
      name: "A bot name at the limit of what fits",
      title: "A very long title that describes this bot in far too many words to fit on one line",
      description: "A long description. ".repeat(20),
    },
  },
};

export const SaveFailed: Story = {
  beforeEach: setup,
  args: {
    onSave: async () => {
      throw new Error("The server is unavailable.");
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Save" }));
  },
};

export const UnknownToolName: Story = {
  beforeEach: setup,
  play: async (context) => {
    await openAdvanced(context);
    const input = await within(context.canvasElement).findByLabelText("Disabled tools");
    await userEvent.type(input, "not_a_tool{Enter}");
  },
};
