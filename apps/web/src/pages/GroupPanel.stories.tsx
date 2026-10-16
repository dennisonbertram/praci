import type { Group } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockBot, mockBots } from "../stories/fixtures-9";
import { CreateGroupForm, GroupSettings } from "./GroupPanel";

const noop = async () => undefined;
const bots = [
  ...mockBots,
  mockBot("bot_old", "Archived bot", "#888888", { archivedAt: "2026-01-01T00:00:00.000Z" }),
];

const group: Group = {
  id: "group_demo",
  spaceId: "space_demo",
  name: "Demo group",
  pinned: false,
  sectionId: null,
  archivedAt: null,
  members: [
    { botId: "bot_ada", name: "Ada", color: "#3b82f6" },
    { botId: "bot_bram", name: "Bram", color: "#10b981" },
  ],
  threadId: "thread_group",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Shell/Group panel",
  parameters: { docs: { description: { component: "Also shows: MemberPicker" } } },
  decorators: [
    (Story) => (
      <div className="w-80 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;

type Story = StoryObj;

export const CreateEmpty: Story = {
  render: () => <CreateGroupForm bots={bots} onCancel={() => undefined} onCreate={noop} />,
};

async function fillCreate(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByPlaceholderText("Name this group"), "Sample team");
  await userEvent.click(canvas.getByRole("button", { name: "Ada" }));
  await userEvent.click(canvas.getByRole("button", { name: "Bram" }));
}

export const CreateReady: Story = {
  render: CreateEmpty.render,
  play: ({ canvasElement }) => fillCreate(canvasElement),
};

export const CreateFails: Story = {
  render: () => (
    <CreateGroupForm
      bots={bots}
      onCancel={() => undefined}
      onCreate={async () => {
        throw new Error("Could not create group");
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await fillCreate(canvasElement);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Create group" }));
  },
};

export const Settings: Story = {
  render: () => (
    <GroupSettings
      group={group}
      bots={bots}
      onSave={noop}
      onRemove={noop}
      onClose={() => undefined}
    />
  ),
};

export const SettingsSaveFails: Story = {
  render: () => (
    <GroupSettings
      group={group}
      bots={bots}
      onSave={async () => {
        throw new Error("Could not save group");
      }}
      onRemove={noop}
      onClose={() => undefined}
    />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save" }));
  },
};

export const SettingsConfirmDelete: Story = {
  render: Settings.render,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete group" }));
  },
};
