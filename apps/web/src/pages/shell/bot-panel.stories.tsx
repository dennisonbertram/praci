import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { mockMe, mockModelCatalog, mockModelCredentials, scoutBot } from "../../stories/fixtures";
import { BotSettings } from "./bot-panel";

const manySkills = Array.from({ length: 13 }, (_, index) => ({
  id: `user_${index}`,
  name: `skill-${index + 1}`,
  description: `What skill ${index + 1} does and when to use it.`,
  source: "user" as const,
  readOnly: false,
  enabled: true,
}));

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
    "agentSkills.forBot": manySkills,
    "agentSkills.drafts": [],
  });
};

const meta = {
  title: "Shell/Bot settings",
  component: BotSettings,
  args: {
    bot: scoutBot,
    memoryProviderConfigured: false,
    onSkillsChange: () => undefined,
    onSave: async () => undefined,
    onExport: async () => undefined,
    onClear: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-96 p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { docs: { description: { component: "Also shows: ComputerModePicker" } } },
} satisfies Meta<typeof BotSettings>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ConnectedModelPicker: Story = {
  beforeEach: () => {
    setup();
    mockRpc({
      "models.credentials": mockModelCredentials,
      "models.list": mockModelCatalog,
      me: mockMe,
    });
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Advanced"));
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }));
  },
};

const openAdvanced: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByText("Advanced"));
};

export const Default: Story = { beforeEach: setup };

export const AdvancedOpen: Story = { beforeEach: setup, play: openAdvanced };

/** 13 skills scroll inside their own list, so Advanced stays reachable. */
export const ThirteenSkillsAdvancedOpen: Story = { beforeEach: setup, play: openAdvanced };

export const AdvancedWithMemoryScopeAndDisabledTools: Story = {
  beforeEach: setup,
  args: {
    memoryProviderConfigured: true,
    bot: { ...scoutBot, computerMode: "dedicated", disabledBuiltinTools: ["web_search"] },
  },
  play: openAdvanced,
};

/** The deployment owner on the desktop app can aim a bot at the host computer. */
export const RunsOnThisMac: Story = {
  beforeEach: setup,
  args: {
    hostComputer: { defaultHost: "docker" },
    bot: { ...scoutBot, runsOn: "this-mac", computerMode: "dedicated" },
  },
  play: openAdvanced,
};

export const NotificationsOff: Story = {
  beforeEach: setup,
  args: { bot: { ...scoutBot, notifyOnFinish: false } },
};

export const LongProfileText: Story = {
  beforeEach: setup,
  args: {
    bot: {
      ...scoutBot,
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
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByLabelText("Name"));
    await userEvent.tab();
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
