// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  list: vi.fn(),
  backups: vi.fn(async () => []),
  setBackups: vi.fn(async () => ({ ok: true })),
  embeddingModel: vi.fn(async () => ({ modelId: null })),
  setEmbeddingModel: vi.fn(),
  autoFileEmail: vi.fn(async () => ({ enabled: true })),
  setAutoFileEmail: vi.fn(async ({ enabled }: { enabled: boolean }) => ({ enabled })),
  credentials: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  setDefault: vi.fn(),
  probeOpenAiCompatible: vi.fn(),
  beginOAuth: vi.fn(),
  cancelOAuth: vi.fn(),
  completeOAuth: vi.fn(),
  finishOAuth: vi.fn(),
  submitOAuthCode: vi.fn(),
}));

vi.mock("../lib/rpc", () => ({
  selectedSpaceId: () => "space-1",
  rpc: {
    models,
    me: vi.fn(),
  },
}));
vi.mock("../lib/localized-provider-hint", () => ({
  localizedProviderHint: () => "API key",
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce(
      (text, part, index) => `${text}${index > 0 ? String(values[index - 1]) : ""}${part}`,
      "",
    );
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children?: ReactNode }) => children,
    Plural: ({ one, other, value }: { one: string; other: string; value: number }) =>
      value === 1 ? one : other,
  };
});
vi.mock("@rakazo/ui-web", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
    AlertDialogAction: ({
      children,
      onClick,
      disabled,
    }: {
      children?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    AlertDialogCancel: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    AlertDialogContent: Pass,
    AlertDialogDescription: Pass,
    AlertDialogFooter: Pass,
    AlertDialogHeader: Pass,
    AlertDialogTitle: Pass,
    Button: ({
      children,
      onClick,
      disabled,
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" disabled={disabled} onClick={onClick} {...props}>
        {children}
      </button>
    ),
    Dialog: Pass,
    DialogClose: Pass,
    DialogContent: Pass,
    DialogDescription: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    ModelThinkingOptions: () => null,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Skeleton: (props: ComponentProps<"div">) => <div {...props} />,
  };
});

import { rpc } from "../lib/rpc";
import { ModelSettingsOverlay } from "./ModelSettingsOverlay";

const STORED_PLACEHOLDER = "Paste a replacement key";
const deepseekEntry = {
  provider: "deepseek",
  providerName: "DeepSeek",
  id: "deepseek-chat",
  label: "DeepSeek Chat",
  billing: "API key",
  auth: "api-key" as const,
  authHint: "API key",
};
const compatibleEntry = {
  provider: "openai-compatible",
  providerName: "OpenAI-compatible",
  id: "custom",
  label: "Custom model",
  billing: "Your server",
  auth: "api-key" as const,
  authHint: "Custom server",
  placeholder: true,
};

function account(provider: string, modelId: string) {
  return {
    userId: "user-1",
    timezone: null,
    tourSeen: true,
    email: "ada@example.test",
    name: "Ada",
    spaceId: "space-1",
    isDeploymentOwner: false,
    needsModel: false,
    defaultProvider: provider,
    defaultModel: modelId,
    hostCredentialProvider: null,
    hostCredentialSource: null,
    computerHost: null,
    canChooseHostComputer: false,
    sandboxProvider: "docker",
    avatarStyle: "robot" as const,
    billingEnabled: false,
    ticketBoardEnabled: false,
  };
}

function buttons(container: HTMLElement, text: string) {
  const found = [...container.querySelectorAll("button")].filter((entry) =>
    entry.textContent?.includes(text),
  );
  if (found.length === 0) throw new Error(`Missing button: ${text}`);
  return found;
}

function keyField(container: HTMLElement) {
  const input = container.querySelector("#model-api-key");
  if (!(input instanceof HTMLInputElement)) throw new Error("Missing API key field");
  return input;
}

function compatibleKeyField(container: HTMLElement) {
  const input = [...container.querySelectorAll("input")].find(
    (entry) => entry.getAttribute("aria-label") === "API key",
  );
  if (!(input instanceof HTMLInputElement)) throw new Error("Missing compatible API key field");
  return input;
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** `ownModel: false` leaves the panel as a person on the system model first sees it. */
async function renderSettings(focusProvider?: string, ownModel = true) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ModelSettingsOverlay embedded onClose={() => undefined} focusProvider={focusProvider} />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  const open = ownModel
    ? [...container.querySelectorAll("button")].find((b) => b.textContent === "Use my own model")
    : undefined;
  if (open) await act(async () => open.click());
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.mocked(rpc.me).mockResolvedValue(account("deepseek", "deepseek-chat"));
  models.list.mockResolvedValue([deepseekEntry]);
  models.credentials.mockResolvedValue([]);
  models.connect.mockResolvedValue({});
  models.disconnect.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

it("saves a typed Data room embedding id unchanged and resets it to the default", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  models.setEmbeddingModel.mockImplementation(async ({ modelId }: { modelId: string | null }) => ({
    modelId,
  }));
  const view = await renderSettings();
  const trigger = view.container.querySelector<HTMLButtonElement>("#data-room-embedding-model")!;
  trigger.closest("details")!.open = true;
  await act(async () => trigger.click());
  await typeInto(
    document.querySelector<HTMLInputElement>('input[aria-label="Model id"]')!,
    "sample/embedding-v2",
  );
  await act(async () => {
    document
      .querySelector("input[aria-label='Model id']")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(models.setEmbeddingModel).toHaveBeenLastCalledWith({ modelId: "sample/embedding-v2" });
  expect(trigger.textContent).toContain("sample/embedding-v2");
  await act(async () => trigger.click());
  const reset = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent === "Default",
  )!;
  await act(async () => reset.click());
  expect(models.setEmbeddingModel).toHaveBeenLastCalledWith({ modelId: null });
  await view.unmount();
  vi.unstubAllGlobals();
});

it("shows a stored BYOK key when provider settings reopen", async () => {
  models.credentials.mockResolvedValue([
    {
      id: "cred-deepseek",
      provider: "deepseek",
      label: "DeepSeek",
      hasKey: true,
      isDefault: true,
      modelId: "deepseek-chat",
    },
  ]);

  const view = await renderSettings();
  try {
    const input = keyField(view.container);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe(STORED_PLACEHOLDER);
    expect(input.type).toBe("password");
    expect(view.container.textContent).not.toContain("sk-");

    await typeInto(input, "sk-replacement-key");
    expect(keyField(view.container).value).toBe("sk-replacement-key");

    await typeInto(keyField(view.container), "");
    expect(keyField(view.container).value).toBe("");
    expect(keyField(view.container).placeholder).toBe(STORED_PLACEHOLDER);

    await typeInto(keyField(view.container), "sk-replacement-key");
    await act(async () => {
      buttons(view.container, "Replace API key")[0]?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(models.connect).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "deepseek", apiKey: "sk-replacement-key" }),
    );
    expect(keyField(view.container).value).toBe("");
    expect(keyField(view.container).placeholder).toBe(STORED_PLACEHOLDER);

    models.credentials.mockResolvedValue([]);
    await act(async () => {
      buttons(view.container, "Disconnect")[0]?.click();
    });
    const confirm = buttons(view.container, "Disconnect");
    await act(async () => {
      confirm[confirm.length - 1]?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(models.disconnect).toHaveBeenCalledWith({ provider: "deepseek" });
    expect(keyField(view.container).value).toBe("");
    expect(keyField(view.container).placeholder).toBe("sk-…");
  } finally {
    await view.unmount();
  }
});

it("says no model is active, not the saved default, while no model is set up", async () => {
  vi.mocked(rpc.me).mockResolvedValue({
    ...account("deepseek", "deepseek-chat"),
    needsModel: true,
  });
  const view = await renderSettings();
  expect(view.container.textContent).toContain("Pick a provider below and connect it.");
  expect(view.container.textContent).not.toContain("Active model");
  // The detail names the provider it is about, since none is marked as connected yet.
  expect(view.container.textContent).toContain(
    "Connect DeepSeek to use it as your personal model.",
  );
  await view.unmount();
});

it("keeps the key field behind Replace key while connected, opened only when asked for", async () => {
  models.credentials.mockResolvedValue([
    {
      id: "cred-deepseek",
      provider: "deepseek",
      label: "DeepSeek",
      hasKey: true,
      isDefault: true,
      modelId: "deepseek-chat",
    },
  ]);
  const closed = await renderSettings();
  try {
    const fold = keyField(closed.container).closest("details");
    expect(fold?.querySelector("summary")?.textContent).toBe("Replace key");
    expect(fold?.open).toBe(false);
    expect(buttons(closed.container, "Disconnect").length).toBeGreaterThan(0);
    expect(closed.container.textContent).not.toContain("Active model");
  } finally {
    await closed.unmount();
  }
  const asked = await renderSettings("deepseek");
  try {
    expect(keyField(asked.container).closest("details")?.open).toBe(true);
  } finally {
    await asked.unmount();
  }
});

it("leaves the key field empty until a key is saved", async () => {
  const view = await renderSettings();
  try {
    const input = keyField(view.container);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("sk-…");
    expect(view.container.textContent).not.toContain(STORED_PLACEHOLDER);
  } finally {
    await view.unmount();
  }
});

it("treats the provider this space already uses as connected, with a key optional", async () => {
  const view = await renderSettings();
  try {
    const text = view.container.textContent ?? "";
    expect(text).toContain("Your bots already use DeepSeek.");
    expect(text).not.toContain("Connect this provider");
    expect(text).toContain("Use your own key");
    // A founder should learn they need to do nothing here before reading a list of providers.
    expect(text).toContain("They already have one, so change this only");
  } finally {
    await view.unmount();
  }
});

it("opens the own-key form when a page asks for that provider's key", async () => {
  const ownKey = (container: HTMLElement) =>
    [...container.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent?.includes("Use your own key"),
    );
  const closed = await renderSettings();
  try {
    expect(ownKey(closed.container)?.open).toBe(false);
  } finally {
    await closed.unmount();
  }
  const view = await renderSettings("deepseek");
  try {
    expect(ownKey(view.container)?.open).toBe(true);
    // The field the link promised is on screen and ready for the key.
    expect(document.activeElement).toBe(keyField(view.container));
  } finally {
    await view.unmount();
  }
});

it("focuses the stored key's replace field when opened from a rejected key", async () => {
  models.credentials.mockResolvedValue([
    {
      id: "cred-deepseek",
      provider: "deepseek",
      label: "DeepSeek",
      hasKey: true,
      isDefault: true,
      modelId: "deepseek-chat",
    },
  ]);
  const view = await renderSettings("");
  try {
    expect(document.activeElement).toBe(keyField(view.container));
    // With no new key typed, the button under the field says what it would do.
    expect(view.container.textContent).not.toContain("Save limits");
    expect(buttons(view.container, "Replace API key").at(-1)?.disabled).toBe(true);
  } finally {
    await view.unmount();
  }
});

it("shows Cloudflare account and gateway fields for a new and a saved connection", async () => {
  const entry = {
    provider: "cloudflare-ai-gateway",
    providerName: "Cloudflare AI Gateway",
    id: "workers-ai/@cf/meta/llama-3.1-8b-instruct",
    label: "Llama",
    billing: "API key",
    auth: "api-key" as const,
    authHint: "API key",
  };
  vi.mocked(rpc.me).mockResolvedValue(account(entry.provider, entry.id));
  models.list.mockResolvedValue([entry]);
  models.credentials.mockResolvedValue([]);

  const fresh = await renderSettings();
  try {
    const accountId = fresh.container.querySelector("#cloudflare-account-id");
    const gatewayId = fresh.container.querySelector("#cloudflare-gateway-id");
    expect(accountId).toBeInstanceOf(HTMLInputElement);
    expect(gatewayId).toBeInstanceOf(HTMLInputElement);
    expect((accountId as HTMLInputElement).value).toBe("");
    expect((gatewayId as HTMLInputElement).value).toBe("");
    expect(fresh.container.textContent).toContain("Account ID");
    expect(fresh.container.textContent).toContain("Gateway ID");
  } finally {
    await fresh.unmount();
  }

  models.credentials.mockResolvedValue([
    {
      id: "cred-cf",
      provider: entry.provider,
      label: "Cloudflare AI Gateway",
      hasKey: true,
      isDefault: true,
      accountId: "acct1234",
      gatewayId: "gateway-1",
      modelId: entry.id,
    },
  ]);
  const saved = await renderSettings();
  try {
    expect(
      (saved.container.querySelector("#cloudflare-account-id") as HTMLInputElement).value,
    ).toBe("acct1234");
    expect(
      (saved.container.querySelector("#cloudflare-gateway-id") as HTMLInputElement).value,
    ).toBe("gateway-1");
  } finally {
    await saved.unmount();
  }
});

it("shows a stored OpenAI-compatible key and stays empty when none is saved", async () => {
  vi.mocked(rpc.me).mockResolvedValue(account("openai-compatible", "deepseek-chat"));
  models.list.mockResolvedValue([compatibleEntry]);
  models.credentials.mockResolvedValue([
    {
      id: "cred-compatible",
      provider: "openai-compatible",
      label: "DeepSeek",
      hasKey: true,
      isDefault: true,
      baseUrl: "https://api.deepseek.com/v1",
      modelId: "deepseek-chat",
    },
  ]);

  const stored = await renderSettings();
  try {
    const input = compatibleKeyField(stored.container);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe(STORED_PLACEHOLDER);
  } finally {
    await stored.unmount();
  }

  models.credentials.mockResolvedValue([
    {
      id: "cred-compatible",
      provider: "openai-compatible",
      label: "Local",
      hasKey: false,
      isDefault: true,
      baseUrl: "http://127.0.0.1:8000/v1",
      modelId: "local-model",
    },
  ]);
  const empty = await renderSettings();
  try {
    const input = compatibleKeyField(empty.container);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Optional");
  } finally {
    await empty.unmount();
  }
});

it("lists the server's own provider under Connected, ahead of the A-Z list", async () => {
  vi.mocked(rpc.me).mockResolvedValue({
    ...account("openrouter", "or-model"),
    hostCredentialProvider: "openrouter",
    hostCredentialSource: "environment",
  } as never);
  models.list.mockResolvedValue([
    { ...deepseekEntry, provider: "amazon", providerName: "Amazon Bedrock", id: "a" },
    { ...deepseekEntry, provider: "openrouter", providerName: "OpenRouter", id: "or-model" },
  ]);
  const view = await renderSettings();
  try {
    await act(async () => {
      buttons(view.container, "More")[0]?.click();
    });
    const text = view.container.textContent ?? "";
    expect(text).toContain("Connected");
    expect(text.indexOf("OpenRouter")).toBeLessThan(text.indexOf("Amazon Bedrock"));
  } finally {
    await view.unmount();
  }
});

it("shows a skeleton, not 'No providers found', while the catalog loads", async () => {
  models.list.mockReturnValue(new Promise(() => undefined));
  const view = await renderSettings();
  try {
    expect(view.container.textContent).not.toContain("No providers found");
    expect(view.container.querySelector("[data-testid='provider-skeleton']")).not.toBeNull();
  } finally {
    await view.unmount();
  }
});

it("says no providers were found once an empty catalog has loaded", async () => {
  models.list.mockResolvedValue([]);
  const view = await renderSettings();
  try {
    expect(view.container.textContent).toContain("No providers found");
  } finally {
    await view.unmount();
  }
});

it("keeps the Data room attachment setting out of Models", async () => {
  const view = await renderSettings();
  try {
    expect(view.container.textContent).not.toContain("Add email attachments to the Data room");
  } finally {
    await view.unmount();
  }
});

it("lists common providers first and reveals the rest behind More", async () => {
  models.list.mockResolvedValue([
    { ...deepseekEntry, provider: "anthropic", providerName: "Anthropic", id: "c" },
    { ...deepseekEntry, provider: "zeta", providerName: "Zeta AI", id: "z" },
  ]);
  const view = await renderSettings();
  try {
    expect(view.container.textContent).toContain("Anthropic");
    expect(view.container.textContent).not.toContain("Zeta AI");
    await act(async () => {
      buttons(view.container, "More")[0]?.click();
    });
    expect(view.container.textContent).toContain("Zeta AI");
  } finally {
    await view.unmount();
  }
});

it("shows one line and one action on the system model, and opens the providers on request", async () => {
  const view = await renderSettings(undefined, false);
  try {
    expect(view.container.textContent).toContain("Your bots use DeepSeek Chat.");
    expect(view.container.textContent).not.toContain("Providers");
    expect(view.container.querySelectorAll("button")).toHaveLength(1);
    await act(async () => buttons(view.container, "Use my own model")[0]?.click());
    expect(view.container.textContent).toContain("Providers");
    expect(view.container.textContent).toContain("Data room search model");
  } finally {
    await view.unmount();
  }
});

it("disables the Model and Voice switch while a voice change is pending", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ModelSettingsOverlay
        embedded
        onClose={() => undefined}
        focusProvider=""
        voice={<div />}
        view="voice"
        onViewChange={() => undefined}
        switchDisabled
      />,
    );
  });
  const pills = [...container.querySelectorAll("button[aria-pressed]")] as HTMLButtonElement[];
  expect(pills).toHaveLength(2);
  expect(pills.every((b) => b.disabled)).toBe(true);
  await act(async () => root.unmount());
  container.remove();
});
