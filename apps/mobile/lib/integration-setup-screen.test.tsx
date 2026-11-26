// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { Linking } from "react-native";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import IntegrationSetup from "../app/(settings)/integration-setup";

const state = vi.hoisted(() => ({ rpc: vi.fn(), replace: vi.fn() }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc }));
vi.mock("../lib/appearance", () => ({ mobileTokens: () => ({}) }));
vi.mock("../lib/i18n", () => ({
  useI18n: () => ({ t: (value: string) => value }),
}));
vi.mock("../lib/native", () => ({
  native: {},
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/settings-sheet", () => ({ closeSettingsSheet: vi.fn() }));
vi.mock("../components/native-segmented-control", () => ({
  NativeSegmentedControl: ({
    onChange,
    options,
  }: {
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) =>
    createElement(
      "div",
      null,
      ...options.map((option) =>
        createElement(
          "button",
          { key: option.value, type: "button", onClick: () => onChange(option.value) },
          option.label,
        ),
      ),
    ),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    disabled,
    label,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
  }) => createElement("button", { type: "button", disabled, onClick: onPress }, label),
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    ActivityIndicator: () => createElement("i", { "data-testid": "spinner" }),
    Linking: { openURL: vi.fn() },
    ScrollView: box,
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel: string;
      onChangeText: (value: string) => void;
      value: string;
    }) =>
      createElement("input", {
        "aria-label": accessibilityLabel,
        onChange: (event: Event) => onChangeText((event.target as HTMLInputElement).value),
        value,
      }),
  };
});

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rpc.mockReset();
  state.replace.mockReset();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("offers retry after setup load failure and reloads successfully", async () => {
  state.rpc.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
    canConfigure: true,
    providers: [],
  });
  await act(async () => root.render(createElement(IntegrationSetup)));
  expect(host.textContent).toContain("Could not load integrations");
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeTruthy();
  await act(async () => retry?.click());
  expect(host.querySelector('[data-testid="spinner"]')).toBeNull();
  expect(host.textContent).toContain("Finish MCP authorization");
  expect(state.rpc).toHaveBeenCalledTimes(2);
});

it("hands Google setup off to the web app without showing credential fields", async () => {
  state.rpc.mockResolvedValue({
    canConfigure: true,
    providers: [{ id: "google", configured: true }],
    webUrl: "https://rakazo.example/settings/integrations",
  });
  await act(async () => root.render(createElement(IntegrationSetup)));

  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toContain(
    "Google",
  );
  const google = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Google",
  );
  await act(async () => google?.click());
  expect(host.textContent).toContain("Connected");
  expect(host.querySelectorAll("input")).toHaveLength(0);
  const openWebApp = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Open web app",
  );
  await act(async () => openWebApp?.click());
  expect(Linking.openURL).toHaveBeenCalledWith("https://rakazo.example/settings/integrations");
});

it("requires Pipedream identifiers when rotating a configured secret", async () => {
  state.rpc.mockResolvedValue({
    canConfigure: true,
    providers: [{ id: "pipedream", configured: true }],
    webUrl: "https://rakazo.example",
  });
  await act(async () => root.render(createElement(IntegrationSetup)));
  const pipedream = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Pipedream",
  );
  await act(async () => pipedream?.click());
  const secret = host.querySelector<HTMLInputElement>('input[aria-label="Client secret"]');
  expect(secret).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      secret,
      "new-secret",
    );
    secret!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const continueButton = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Continue",
  );
  expect(continueButton?.disabled).toBe(true);
  await act(async () => continueButton?.click());
  expect(state.rpc).not.toHaveBeenCalledWith("integrationSetup/save", expect.anything());
});
