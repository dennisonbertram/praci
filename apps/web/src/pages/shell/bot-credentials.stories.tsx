import type { BotSecretMetadata } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BotCredentialsSection } from "./bot-credentials";

const at = "2026-01-01T00:00:00.000Z";
const secrets: BotSecretMetadata[] = [
  {
    name: "demo-api",
    origin: "https://api.example.com",
    auth: { type: "bearer" },
    createdAt: at,
    updatedAt: at,
  },
  {
    name: "demo-header",
    origin: "https://hooks.example.com",
    auth: { type: "header", name: "X-Demo-Key" },
    createdAt: at,
    updatedAt: at,
  },
  {
    name: "demo-basic",
    origin: "https://basic.example.com",
    auth: { type: "basic", username: "demo-user" },
    createdAt: at,
    updatedAt: at,
  },
  {
    name: "demo-login",
    origin: "https://login.example.com",
    auth: { type: "login" },
    createdAt: at,
    updatedAt: at,
  },
  { name: "demo_token", origin: "", auth: { type: "command" }, createdAt: at, updatedAt: at },
  {
    name: "Legacy Name",
    origin: "https://old.example.com",
    auth: null,
    createdAt: at,
    updatedAt: at,
  },
];

const meta = {
  title: "Shell/Bot credentials",
  component: BotCredentialsSection,
  args: { botId: "bot_demo" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotCredentialsSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCredentials: Story = { beforeEach: () => mockRpc({ "botSecrets.list": secrets }) };

export const Empty: Story = { beforeEach: () => mockRpc({ "botSecrets.list": [] }) };

export const Loading: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": () => Promise.reject(new Error("offline")) }),
};

export const ConfirmingRemove: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": secrets }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByTestId("credential-remove-demo-api"));
  },
};

export const ReplacingValue: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": secrets }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByTestId("credential-replace-demo-login"),
    );
  },
};

const startAdding = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(await canvas.findByTestId("credential-add"));
  return canvas;
};

export const AddingBearer: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": [] }),
  play: async ({ canvasElement }) => {
    await startAdding(canvasElement);
  },
};

export const AddingHeader: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": [] }),
  play: async ({ canvasElement }) => {
    const canvas = await startAdding(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox"), "header");
  },
};

export const AddingLogin: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": [] }),
  play: async ({ canvasElement }) => {
    const canvas = await startAdding(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox"), "login");
  },
};

export const AddingCommandVariable: Story = {
  beforeEach: () => mockRpc({ "botSecrets.list": [] }),
  play: async ({ canvasElement }) => {
    const canvas = await startAdding(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox"), "command");
    await userEvent.type(canvas.getByTestId("credential-name"), "demo_token");
  },
};
