import type { ModelCatalogEntry, ModelCredential } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ModelBackupsSettings } from "./ModelBackupsSettings";

const catalog: ModelCatalogEntry[] = [
  {
    provider: "alpha",
    providerName: "Alpha AI",
    id: "alpha-large",
    label: "Alpha Large",
    billing: "",
  },
  {
    provider: "alpha",
    providerName: "Alpha AI",
    id: "alpha-small",
    label: "Alpha Small",
    billing: "",
  },
  { provider: "beta", providerName: "Beta Labs", id: "beta-1", label: "Beta One", billing: "" },
  { provider: "gamma", providerName: "Gamma", id: "gamma-1", label: "Gamma One", billing: "" },
];

const credentials: ModelCredential[] = [
  { id: "cred_a", provider: "alpha", label: "Alpha", hasKey: true, isDefault: true },
  { id: "cred_b", provider: "beta", label: "Beta", hasKey: true, isDefault: false },
];

const me = { userId: "user_demo", spaceId: "space_demo" };

const meta = {
  title: "Settings/Model backups",
  component: ModelBackupsSettings,
  args: { userId: me.userId, spaceId: me.spaceId, catalog, credentials },
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
  beforeEach: () =>
    mockRpc({
      me,
      "models.backups": [
        { provider: "alpha", modelId: "alpha-small" },
        { provider: "beta", modelId: "beta-1" },
      ],
      "models.setBackups": { ok: true },
    }),
} satisfies Meta<typeof ModelBackupsSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithBackups: Story = {};

export const Empty: Story = { beforeEach: () => mockRpc({ me, "models.backups": [] }) };

export const NoProviderConnected: Story = {
  args: { credentials: [] },
  beforeEach: () => mockRpc({ me, "models.backups": [] }),
};

/** A saved backup whose provider is no longer connected. */
export const NotConnected: Story = {
  beforeEach: () => mockRpc({ me, "models.backups": [{ provider: "gamma", modelId: "gamma-1" }] }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ me: () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      me: () => {
        throw new Error("Could not load backup models");
      },
    }),
};

/** Removing a row makes the list unsaved; saving shows the confirmation. */
export const Saved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /^Remove Beta Labs/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save backups" }));
    await canvas.findByText("Backup models saved.");
  },
};

export const SaveFailed: Story = {
  beforeEach: () =>
    mockRpc({
      me,
      "models.backups": [{ provider: "alpha", modelId: "alpha-small" }],
      "models.setBackups": () => {
        throw new Error("Could not save backup models");
      },
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /^Remove Alpha AI/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Save backups" }));
  },
};
