import type { ModelCatalogEntry, ModelCredential } from "@rakazo/contracts";

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
