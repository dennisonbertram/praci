// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Models from "../app/(settings)/models";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  announce: vi.fn(),
  sheet: vi.fn(),
  backups: [] as unknown[],
  backupsReply: undefined as undefined | (() => Promise<unknown>),
}));

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));
vi.mock("expo-router", async () => {
  const { useEffect } = await import("react");
  return { useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    View: box,
    ScrollView: box,
    ActivityIndicator: () => <i data-testid="spinner" />,
    Text: ({ children, accessibilityRole }: Record<string, unknown>) => (
      <span role={accessibilityRole as string}>{children as ReactNode}</span>
    ),
    TextInput: ({
      accessibilityLabel,
      value,
      onChangeText,
    }: {
      accessibilityLabel?: string;
      value?: string;
      onChangeText?: (value: string) => void;
    }) => (
      <input
        aria-label={accessibilityLabel}
        value={value ?? ""}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    ),
    Pressable: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
      accessibilityValue,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
      accessibilityValue?: { text?: string };
    }) => (
      <button
        type="button"
        disabled={disabled}
        aria-label={accessibilityLabel}
        data-value={accessibilityValue?.text}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: unknown) => styles },
    Platform: { OS: "ios" },
    Keyboard: { dismiss: vi.fn() },
    Linking: { openURL: vi.fn() },
    Alert: { alert: vi.fn() },
    AccessibilityInfo: { announceForAccessibility: state.announce },
  };
});
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
    accessibilityLabel,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
  }) => (
    <button type="button" disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/native-switch", () => ({
  NativeSwitch: ({
    accessibilityLabel,
    value,
    onValueChange,
  }: {
    accessibilityLabel?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <input
      type="checkbox"
      aria-label={accessibilityLabel}
      checked={value}
      onChange={(event) => onValueChange(event.target.checked)}
    />
  ),
}));
vi.mock("../components/row-accessories", () => ({ Checkmark: () => null, Chevron: () => null }));
vi.mock("./api", () => ({
  captureApiRequestContext: async () => ({}),
  rpc: state.rpc,
  selectedSpaceId: () => null,
}));
vi.mock("./appearance", () => ({ mobileTokens: () => ({}) }));
vi.mock("./i18n", () => {
  const t = (text: string, values?: Record<string, unknown>) =>
    text.replace(/\{(\w+)\}/g, (_, key) => String(values?.[key] ?? ""));
  return { t, useI18n: () => ({ t }) };
});
vi.mock("./message-action-sheet", () => ({ presentMessageActionSheet: state.sheet }));
vi.mock("./model-auth", () => ({
  cancelModelOAuthAttempt: vi.fn(),
  finishModelOAuthAttempt: vi.fn(),
  waitForModelOAuth: vi.fn(),
}));
vi.mock("./native", () => ({
  native: {},
  useResolvedAppearance: () => "light",
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("./user-error", () => ({
  errorText: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

const me = {
  userId: "u1",
  spaceId: "s1",
  defaultProvider: "openai-compatible",
  defaultModel: "",
};
const catalog = [
  { provider: "openai-compatible", providerName: "Custom server", id: "custom", label: "Custom" },
  { provider: "acme", providerName: "Acme", id: "acme-1", label: "Acme One" },
];
const credentials = [{ provider: "acme", modelId: "acme-1", label: "Acme", hasKey: true }];

let root: Root;
let container: HTMLDivElement;
let failures: Record<string, string>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  failures = {};
  state.backups = [];
  state.backupsReply = undefined;
  state.announce.mockReset();
  state.sheet.mockReset();
  state.rpc.mockReset().mockImplementation(async (proc: string) => {
    if (failures[proc]) throw new Error(failures[proc]);
    if (proc === "me") return me;
    if (proc === "models/list") return catalog;
    if (proc === "models/credentials") return credentials;
    if (proc === "models/backups") return state.backupsReply ? state.backupsReply() : state.backups;
    if (proc === "models/probeOpenAiCompatible") return { models: ["m1", "m2"] };
    return undefined;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(async () => root.render(<Models />));
const button = (label: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === label || b.getAttribute("aria-label") === label,
  )!;
const input = (label: string) =>
  container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
const press = (label: string) =>
  act(async () => {
    button(label).click();
  });
const type = (label: string, value: string) =>
  act(async () => {
    const el = input(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const errors = () =>
  [...container.querySelectorAll("span")].filter((s) =>
    /^(Probe|Save|Enter) /.test(s.textContent ?? ""),
  );
const follows = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

async function openCustomServer() {
  failures["models/probeOpenAiCompatible"] = "Probe refused";
  await render();
  await type("OpenAI-compatible server URL", "http://127.0.0.1:8000/v1");
  await type("Model id", "my-model");
}

describe("Models settings feedback", () => {
  it("shows a failed probe under Find models and announces it", async () => {
    await openCustomServer();
    await press("Find models");
    const [error] = errors();
    expect(error!.textContent).toBe("Probe refused");
    expect(follows(button("Find models"), error!)).toBe(true);
    expect(follows(error!, button("Save"))).toBe(true);
    expect(state.announce).toHaveBeenCalledWith("Probe refused");
  });

  it("shows a failed save under Save, replacing the probe error, and announces it", async () => {
    await openCustomServer();
    await press("Find models");
    failures["models/connect"] = "Save refused";
    await press("Save");
    const found = errors();
    expect(found.map((e) => e.textContent)).toEqual(["Save refused"]);
    expect(follows(button("Save"), found[0]!)).toBe(true);
    expect(state.announce).toHaveBeenLastCalledWith("Save refused");
  });

  it("clears the previous result before reporting an invalid limit", async () => {
    await openCustomServer();
    await press("Find models");
    await press("Advanced");
    await type("Maximum output tokens", "abc");
    await press("Save");
    expect(errors().map((e) => e.textContent)).toEqual([
      expect.stringMatching(/^Enter a whole number from 1 to \d+ for maximum output tokens\.$/),
    ]);
    expect(state.rpc).not.toHaveBeenCalledWith("models/connect", expect.anything());
  });

  it("saves the typed endpoint and model when the form is valid", async () => {
    await openCustomServer();
    await press("Save");
    expect(state.rpc).toHaveBeenCalledWith(
      "models/connect",
      expect.objectContaining({
        provider: "openai-compatible",
        baseUrl: "http://127.0.0.1:8000/v1",
        modelId: "my-model",
      }),
    );
    expect(errors()).toEqual([]);
  });

  it("shows the thinking value on the reasoning-effort row after enabling thinking", async () => {
    await openCustomServer();
    await press("Advanced");
    expect(container.querySelector('[aria-label="Reasoning effort"]')).toBeNull();
    await act(async () => input("Supports thinking").click());
    expect(button("Reasoning effort").getAttribute("data-value")).toBe("Default");
    expect(button("Reasoning effort").textContent).toContain("Default");
  });
});

describe("Models backup editor loading", () => {
  it("keeps editing and saving locked until the saved backups have loaded", async () => {
    let finish!: (value: unknown) => void;
    state.backupsReply = () => new Promise((resolve) => (finish = resolve));
    await render();
    expect(button("Add connected model").disabled).toBe(true);
    expect(button("Save backups").disabled).toBe(true);
    await act(async () => finish([]));
    expect(button("Add connected model").disabled).toBe(false);
    await press("Add connected model");
    expect(state.sheet).toHaveBeenCalledOnce();
  });

  it("stays locked and offers Retry when the backups fail to load, then unlocks on success", async () => {
    failures["models/backups"] = "Backups down";
    await render();
    expect(container.textContent).toContain("Backups down");
    expect(button("Add connected model").disabled).toBe(true);
    expect(button("Save backups").disabled).toBe(true);
    delete failures["models/backups"];
    await press("Retry");
    expect(button("Add connected model").disabled).toBe(false);
  });

  it("saves a removed backup through models/setBackups", async () => {
    state.backups = [{ provider: "acme", modelId: "acme-1" }];
    await render();
    expect(button("Save backups").disabled).toBe(true);
    await press("Remove Acme · Acme One");
    expect(button("Save backups").disabled).toBe(false);
    await press("Save backups");
    expect(state.rpc).toHaveBeenCalledWith("models/setBackups", [], expect.anything());
    expect(container.textContent).toContain("Backup models saved.");
  });
});
