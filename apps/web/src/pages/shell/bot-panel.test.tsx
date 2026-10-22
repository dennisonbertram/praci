// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/rpc", () => ({
  rpc: {
    voice: { voices: vi.fn().mockResolvedValue([]) },
    models: {
      credentials: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
    },
    me: vi.fn().mockResolvedValue(null),
    connections: {
      list: vi.fn().mockResolvedValue([]),
      effectiveAccess: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    variant: _variant,
    size: _size,
    ...props
  }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
    <button type="button" {...props} />
  ),
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
  Switch: ({
    onCheckedChange: _onCheckedChange,
    checked: _checked,
    ...props
  }: ComponentProps<"button"> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => <button type="button" {...props} />,
  Toggle: ({
    onPressedChange: _onPressedChange,
    pressed,
    variant: _variant,
    size: _size,
    ...props
  }: ComponentProps<"button"> & {
    variant?: string;
    size?: string;
    pressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  }) => (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => _onPressedChange?.(!pressed)}
      {...props}
    >
      {props.children}
    </button>
  ),
}));
vi.mock("./avatar-studio-popover", () => ({ AvatarStudioPopover: () => null }));
vi.mock("./bot-credentials", () => ({ BotCredentialsSection: () => null }));
vi.mock("./BotSkillsSection", () => ({ BotSkillsSection: () => null }));
vi.mock("../ScratchpadSection", () => ({ ScratchpadSection: () => null }));
vi.mock("../KnowledgeSection", () => ({ KnowledgeSection: () => null }));

import { rpc } from "../../lib/rpc";
import { BotSettings } from "./bot-panel";

const longInstructions = "I".repeat(4_000);

function bot(description = "Billing"): Bot {
  return {
    id: "bot-1",
    spaceId: "space-1",
    name: "Ada",
    title: "Helper",
    description,
    instructions: longInstructions,
    color: "ink",
    notifyOnFinish: true,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: "thread-1",
    preview: "",
    status: "idle",
    runErrorId: null,
    computerMode: "team",
    updatedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    voiceId: null,
    autoSpeak: false,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    teamChatAmbientEnabled: false,
    teamChatRules: "",
    disabledBuiltinTools: [],
    audience: "internal",
    externalMessageTargets: [],
    externalComputerTools: false,
    webhookConfigured: false,
    spawnKey: null,
    runPhase: null,
  };
}

let container: HTMLDivElement;
let root: Root;
const onSave = vi.fn(
  async (_patch: Parameters<ComponentProps<typeof BotSettings>["onSave"]>[0]) => undefined,
);

async function render(
  description = "Billing",
  hostComputer?: { defaultHost: "docker" | "this-mac" },
) {
  await act(async () => {
    root.render(
      <BotSettings
        bot={bot(description)}
        hostComputer={hostComputer}
        memoryProviderConfigured={false}
        onSkillsChange={() => undefined}
        onSave={onSave}
        onExport={async () => undefined}
        onClear={() => undefined}
      />,
    );
  });
}

function descriptionField(): HTMLTextAreaElement {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("Missing description field");
  return textarea;
}

async function setDescription(value: string) {
  const textarea = descriptionField();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      textarea,
      value,
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Leaving the description field is how a text edit is saved. */
async function clickSave() {
  const before = onSave.mock.calls.length;
  await act(async () => {
    descriptionField().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  if (onSave.mock.calls.length === before) throw new Error("save did not run");
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  onSave.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("BotSettings model choices", () => {
  it("submits DeepSeek API ids and does not offer a display label", async () => {
    vi.mocked(rpc.models.credentials).mockResolvedValueOnce([
      {
        id: "cred-deepseek",
        provider: "deepseek",
        label: "DeepSeek",
        hasKey: true,
        isDefault: true,
        modelId: "DeepSeek-V4.1-Flash",
      },
    ]);
    vi.mocked(rpc.models.list).mockResolvedValueOnce([
      {
        provider: "deepseek",
        providerName: "DeepSeek",
        id: "deepseek-flash",
        label: "DeepSeek V4.1 Flash",
        billing: "",
      },
      {
        provider: "deepseek",
        providerName: "DeepSeek",
        id: "deepseek-v4-pro",
        label: "DeepSeek V4 Pro",
        billing: "",
      },
    ]);
    await render();
    await act(async () => {
      await Promise.resolve();
    });
    const model = container.querySelector("select");
    if (!(model instanceof HTMLSelectElement)) throw new Error("Missing model select");
    const values = [...model.options].map((option) => option.value);
    expect(values).toContain("deepseek::deepseek-flash");
    expect(values).toContain("deepseek::deepseek-v4-pro");
    expect(values).not.toContain("deepseek::DeepSeek-V4.1-Flash");
    expect(values.some((value) => value.includes("DeepSeek"))).toBe(false);
  });
});

describe("BotSettings description saves", () => {
  it("leaves instructions off a save that does not edit the description", async () => {
    await render();
    await clickSave();
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("description");
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("instructions");
  });

  it("does not resend instructions when the bot prop stays on the old description", async () => {
    await render();
    await setDescription("Invoices");
    await clickSave();
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      description: "Invoices",
      instructions: "Invoices",
    });

    // The parent still passes the description from when the panel opened.
    await render();
    await clickSave();
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]?.[0]).not.toHaveProperty("description");
    expect(onSave.mock.calls[1]?.[0]).not.toHaveProperty("instructions");
  });

  it("still saves a description edited back to the stale prop value", async () => {
    await render();
    await setDescription("Invoices");
    await clickSave();
    await render();
    await setDescription("Billing");
    await clickSave();
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({
      description: "Billing",
      instructions: "Billing",
    });
  });

  it("keeps the previous description as the baseline when a save fails", async () => {
    onSave.mockRejectedValueOnce(new Error("offline"));
    await render();
    await setDescription("Invoices");
    await clickSave();
    await clickSave();
    expect(onSave.mock.calls[1]?.[0]).toMatchObject({
      description: "Invoices",
      instructions: "Invoices",
    });
  });
});

describe("BotSettings saving without a Save button", () => {
  it("has no Save button", async () => {
    await render();
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(
      "Save",
    );
  });

  it("saves Advanced choices as soon as they change", async () => {
    await render();
    const privateMode = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Private",
    );
    await act(async () => privateMode?.click());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ computerMode: "dedicated" });
  });

  it("offers Runs on only where the host is allowed, and saves the choice", async () => {
    await render();
    expect(container.textContent).not.toContain("Runs on");
    await render("Billing", { defaultHost: "docker" });
    expect(container.textContent).toContain("Runs on");
    const mac = [...container.querySelectorAll("button")].find((b) =>
      /^This (Mac|computer)$/.test(b.textContent ?? ""),
    );
    await act(async () => mac?.click());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ runsOn: "this-mac" });
  });

  it("shows Saved after a save and clears it after about two seconds", async () => {
    vi.useFakeTimers();
    try {
      await render();
      await clickSave();
      expect(container.textContent).toContain("Saved");
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });
      expect(container.textContent).not.toContain("Saved");
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the unknown tool right under the Disabled tools field", async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>("input[placeholder='Web search']");
    if (!input) throw new Error("Missing disabled tools field");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "nonexistent_tool, web_search",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const message = input.closest("label")?.nextElementSibling;
    expect(message?.textContent).toBe("Unknown tool: nonexistent_tool");
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("BotSettings for a bot just created with New bot", () => {
  it("shows only the name until More settings is pressed", async () => {
    await act(async () => {
      root.render(
        <BotSettings
          bot={bot("")}
          focusName
          memoryProviderConfigured={false}
          onSkillsChange={() => undefined}
          onSave={onSave}
          onExport={async () => undefined}
          onClear={() => undefined}
        />,
      );
    });
    expect(container.querySelector("input")).not.toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('[data-testid="bot-settings-advanced"]')).toBeNull();
    const more = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("More settings"),
    );
    await act(async () => more?.click());
    expect(container.querySelector("textarea")).not.toBeNull();
    expect(container.querySelector('[data-testid="bot-settings-advanced"]')).not.toBeNull();
  });
});

describe("BotSettings audience", () => {
  const helper = "Talks to people outside your company. Private tools are turned off.";
  async function renderWith(
    overrides: Partial<Bot> = {},
    targets: { id: string; name: string }[] = [],
  ) {
    await act(async () => {
      root.render(
        <BotSettings
          bot={{ ...bot(), ...overrides }}
          messageTargets={targets}
          memoryProviderConfigured={false}
          onSkillsChange={() => undefined}
          onSave={onSave}
          onExport={async () => undefined}
          onClear={() => undefined}
        />,
      );
    });
  }
  const button = (testId: string) =>
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);

  it("shows no explanation while the bot is internal", async () => {
    await renderWith();
    expect(button("bot-audience-internal")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).not.toContain(helper);
    expect(container.textContent).not.toContain("Can message");
  });

  it("follows an audience change that arrives from the server", async () => {
    await renderWith();
    await renderWith({ audience: "external" });
    expect(button("bot-audience-external")?.getAttribute("aria-pressed")).toBe("true");
    expect(button("bot-audience-internal")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows a disabled tool by a readable name", async () => {
    await renderWith({ disabledBuiltinTools: ["web_search"] });
    expect(container.textContent).toContain("Web search");
    expect(container.textContent).not.toContain("web_search");
  });

  it("saves the audience on selecting External and then shows the helper and the allowlist", async () => {
    await renderWith({}, [{ id: "bot-2", name: "Chief" }]);
    await act(async () => {
      button("bot-audience-external")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ audience: "external" }));
    expect(container.textContent).toContain(helper);
    expect(container.textContent).toContain("Can message");
    expect(container.textContent).toContain("Chief");
    expect(container.textContent).toContain("Computer and browser");
  });

  it("names the connections an external bot still reaches", async () => {
    vi.mocked(rpc.connections.list).mockResolvedValueOnce([
      { id: "c1", displayName: "Slack", status: "connected" },
      { id: "c2", displayName: "Notion", status: "connected" },
    ] as never);
    vi.mocked(rpc.connections.effectiveAccess).mockResolvedValueOnce({
      c1: { shared: "some", botIds: ["bot-1"] },
      c2: { shared: "all", botIds: ["bot-9"] },
    });
    await renderWith({ audience: "external" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Still has access to: Slack");
    expect(container.textContent).not.toContain("Notion");
  });

  it("offers the system model on a page agent", async () => {
    await renderWith({ spawnKey: "legal-agent:user-1" });
    const model = container.querySelector("select");
    expect(model?.textContent).toContain("System model");
  });

  it("says the system model is used when the chosen provider is not connected", async () => {
    vi.mocked(rpc.models.credentials).mockResolvedValueOnce([]);
    vi.mocked(rpc.models.list).mockResolvedValueOnce([
      {
        provider: "openrouter",
        providerName: "OpenRouter",
        id: "meta/muse-wonder",
        label: "Muse Wonder",
        billing: "",
      },
    ]);
    await renderWith({
      spawnKey: "legal-agent:user-1",
      modelProvider: "openrouter",
      modelId: "meta/muse-wonder",
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Using the system model: Muse Wonder isn't available");
  });

  it("has no switch for a page or integration agent", async () => {
    await renderWith({ spawnKey: "finance-agent:user-1" });
    expect(button("bot-audience-external")).toBeNull();
  });
});
