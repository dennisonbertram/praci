import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { mockMe, mockModelCatalog, mockModelCredentials } from "../stories/fixtures";
import { ModelSettingsOverlay } from "./ModelSettingsOverlay";

const loaded = (extra: Record<string, unknown> = {}) =>
  mockRpc({
    "models.list": mockModelCatalog,
    "models.credentials": mockModelCredentials,
    me: mockMe,
    "models.backups": [],
    "models.embeddingModel": { modelId: "sample/embedding-v1" },
    "models.setEmbeddingModel": (input: { modelId: string | null }) => input,
    ...extra,
  });

/** A person on the system model sees one line; this opens the providers, backups and search model. */
const useOwnModel = async () =>
  userEvent.click(await screen.findByRole("button", { name: "Use my own model" }));

const meta = {
  title: "Settings/Model settings",
  component: ModelSettingsOverlay,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Also shows: EmbeddingModelField, AutoFileEmailField" } },
  },
  args: { onClose: () => undefined, embedded: true },
  decorators: [
    (Story) => (
      <div className="flex h-[720px] w-full max-w-[1080px] flex-col">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => loaded(),
} satisfies Meta<typeof ModelSettingsOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedProvider: Story = {};

export const SystemModel: Story = {
  name: "On the system model (one line)",
  beforeEach: () => loaded({ "models.credentials": [] }),
};

export const OwnModelOpened: Story = {
  name: "After Use my own model",
  beforeEach: () => loaded({ "models.credentials": [] }),
  play: useOwnModel,
};

export const WithModelPickerOpen: Story = {
  name: "Model picker open",
  play: async () => {
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }));
    await screen.findByRole("listbox");
  },
};

export const ModelPickerNoMatch: Story = {
  play: async () => {
    await userEvent.click(await screen.findByRole("combobox", { name: "Model" }));
    await userEvent.type(await screen.findByRole("combobox", { name: "Search models" }), "zzzz");
  },
};

export const DataRoomSearchModel: Story = {
  play: async () => {
    await userEvent.click(await screen.findByText("Data room search model"));
    await userEvent.click(await screen.findByRole("combobox", { name: "Embedding model" }));
  },
};

export const ProviderNotConnected: Story = {
  play: useOwnModel,
  beforeEach: () =>
    loaded({
      "models.credentials": [],
      me: { ...mockMe, defaultProvider: "demo-cloud", defaultModel: "demo-1" },
    }),
};

export const ServerCredentials: Story = {
  play: useOwnModel,
  name: "Server's own credentials",
  beforeEach: () =>
    loaded({
      "models.credentials": [],
      me: {
        ...mockMe,
        hostCredentialProvider: "sample-ai",
        hostCredentialSource: "Sample IAM",
      },
    }),
};

export const SubscriptionSignIn: Story = {
  play: useOwnModel,
  beforeEach: () =>
    loaded({
      "models.credentials": [],
      me: { ...mockMe, defaultProvider: "example-sub", defaultModel: "example-pro" },
    }),
};

export const OpenAiCompatible: Story = {
  beforeEach: () =>
    loaded({
      "models.credentials": [
        {
          id: "cred_2",
          provider: "openai-compatible",
          label: "OpenAI-compatible server",
          hasKey: false,
          isDefault: true,
          baseUrl: "http://127.0.0.1:8000/v1",
          modelId: "local-model",
          reasoning: true,
          thinkingLevel: "medium",
          maxTokens: 4096,
          contextWindow: 32000,
          authKind: "openai_compatible",
        },
      ],
      me: { ...mockMe, defaultProvider: "openai-compatible", defaultModel: "local-model" },
    }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "models.list": () => new Promise(() => undefined),
      "models.credentials": () => new Promise(() => undefined),
      me: () => new Promise(() => undefined),
    }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({ "models.list": () => Promise.reject(new Error("Could not load model settings")) }),
};

export const EmptyCatalog: Story = {
  play: useOwnModel,
  beforeEach: () => loaded({ "models.list": [], "models.credentials": [] }),
};

export const AsDialog: Story = {
  name: "As a dialog (not embedded)",
  args: { embedded: false },
  decorators: [withPageBehind()],
};

export const OwnerDefaultSpace: Story = { args: { localOwner: true } };
