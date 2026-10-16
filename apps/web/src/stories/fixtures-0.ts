import type { Bot, Me, ModelCatalogEntry, ModelCredential } from "@rakazo/contracts";
import * as rpcModule from "../lib/rpc";

/** Invented agents shared by the batch 0 stories. */
const bot = (id: string, name: string, patch: Partial<Bot> = {}): Bot => ({
  id,
  spaceId: "space_demo",
  name,
  title: "",
  description: "",
  instructions: "",
  color: "#6d5bd0",
  notifyOnFinish: false,
  pinned: false,
  sectionId: null,
  archivedAt: null,
  unread: false,
  parentBotId: null,
  memoryScope: null,
  threadId: `thread_${id}`,
  preview: "",
  status: "idle",
  runErrorId: null,
  computerMode: "team",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  voiceId: null,
  autoSpeak: false,
  modelProvider: null,
  modelId: null,
  thinkingLevel: null,
  teamChatAmbientEnabled: false,
  teamChatRules: "",
  disabledBuiltinTools: [],
  webhookConfigured: false,
  spawnKey: null,
  ...patch,
});

export const mockBots: Bot[] = [
  bot("bot_ada", "Ada", {
    title: "Bookkeeper",
    description: "Reconciles the sample ledger every week.",
    color: "#2f7d6d",
  }),
  bot("bot_ben", "Ben", {
    title: "Researcher",
    preview: "Found three sample sources.",
    status: "running",
  }),
  bot("bot_cy", "A bot with a very long name that has to truncate in the row", {
    color: "#b4532a",
    description:
      "A long description that also has to be cut off when the row is narrower than the text.",
  }),
];

export const mockMe: Me = {
  ticketBoardEnabled: false,
  userId: "user_demo",
  email: "demo@example.test",
  name: "Demo User",
  spaceId: "space_demo",
  isDeploymentOwner: true,
  needsModel: false,
  defaultProvider: "sample-ai",
  defaultModel: "sample-large",
  hostCredentialProvider: null,
  hostCredentialSource: null,
  computerHost: null,
  canChooseHostComputer: false,
  sandboxProvider: "none",
  avatarStyle: "robot",
  billingEnabled: false,
};

export const mockModelCatalog: ModelCatalogEntry[] = [
  {
    provider: "sample-ai",
    providerName: "Sample AI",
    id: "sample-large",
    label: "Sample Large",
    billing: "Billed to your Sample AI account.",
    auth: "api-key",
    thinkingLevels: ["off", "low", "medium", "high"],
  },
  {
    provider: "sample-ai",
    providerName: "Sample AI",
    id: "sample-small",
    label: "Sample Small (free tier)",
    billing: "Free within the sample limits.",
    auth: "api-key",
  },
  {
    provider: "demo-cloud",
    providerName: "Demo Cloud",
    id: "demo-1",
    label: "Demo One",
    billing: "Billed to your Demo Cloud account.",
    auth: "api-key",
  },
  {
    provider: "example-sub",
    providerName: "Example Subscription",
    id: "example-pro",
    label: "Example Pro",
    billing: "Uses your Example subscription.",
    auth: "oauth",
    subscription: true,
    signIn: "device-code",
    oauthLabel: "Sign in with Example",
  },
  {
    provider: "openai-compatible",
    providerName: "OpenAI-compatible server",
    id: "custom",
    label: "Custom model",
    billing: "Billed by your server.",
    auth: "api-key",
    placeholder: true,
  },
];

export const mockModelCredentials: ModelCredential[] = [
  {
    id: "cred_1",
    provider: "sample-ai",
    label: "Sample AI",
    hasKey: true,
    isDefault: true,
    modelId: "sample-large",
    authKind: "api_key",
  },
];

/**
 * rpc responses for a story. The static Storybook build loads src/lib/__mocks__/rpc.ts twice: once
 * as the replacement for src/lib/rpc.ts (what components call) and once under its own path. A
 * `mockRpc` imported from the __mocks__ path fills the second copy, which no component reads. This
 * reaches the copy the components use, through the module they import, and clears it first because
 * the preview's reset only clears the other copy.
 */
type RpcMock = {
  mockRpc: (map: Record<string, unknown>) => void;
  resetRpcMocks: () => void;
};
export function mockRpc(map: Record<string, unknown>): void {
  const mock = rpcModule as unknown as RpcMock;
  mock.resetRpcMocks();
  mock.mockRpc(map);
}

/**
 * Keeps external images (logo CDNs) from loading: the browser blocks them with a console error,
 * and a story must not depend on the network. They show the component's letter fallback instead.
 * Use as a `beforeEach`; it returns the cleanup.
 */
export function stubExternalImages(): () => void {
  const external = (value: unknown) => typeof value === "string" && /^https?:\/\//.test(value);
  const setAttribute = Element.prototype.setAttribute;
  const srcProperty = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  // React sets the attribute on the element it renders, and also loads each image's real URL
  // through the property on a detached image to preload it.
  Element.prototype.setAttribute = function (name: string, value: string) {
    const image = this instanceof HTMLImageElement && name === "src";
    return setAttribute.call(this, name, image && external(value) ? "data:," : value);
  };
  if (srcProperty?.set) {
    const set = srcProperty.set;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...srcProperty,
      set(value: string) {
        set.call(this, external(value) ? "data:," : value);
      },
    });
  }
  return () => {
    Element.prototype.setAttribute = setAttribute;
    if (srcProperty) Object.defineProperty(HTMLImageElement.prototype, "src", srcProperty);
  };
}
