// @vitest-environment jsdom

import type { AiConsentStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiDataSharing from "../app/(settings)/ai-data-sharing";

const { rpc, alert, focus } = vi.hoisted(() => ({
  rpc: vi.fn(),
  alert: vi.fn(),
  focus: { current: undefined as (() => (() => void) | undefined) | undefined },
}));
vi.mock("./api", () => ({ rpc }));
vi.mock("expo-router", () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    focus.current = effect;
    useEffect(effect, [effect]);
  },
}));
vi.mock("react-native", () => ({
  Alert: { alert },
  ActivityIndicator: () => null,
  Linking: { openURL: vi.fn() },
  ScrollView: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("../components/settings-group", () => ({
  SettingsFooter: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SettingsGroup: ({ children }: { children: ReactNode }) =>
    createElement("section", null, children),
  SettingsRow: () => null,
  SettingsSwitch: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) =>
    createElement(
      "button",
      { type: "button", "aria-label": label, onClick: () => onChange(!value) },
      `${label}:${value}`,
    ),
  useStackedSettings: () => false,
}));
vi.mock("../lib/ai-consent", () => ({ promptAiConsent: vi.fn() }));
vi.mock("./native", () => ({
  native: { groupedPage: "grouped" },
  useThemedStyles: (fn: () => unknown) => fn(),
}));
vi.mock("./i18n", () => {
  const t = (text: string) => text;
  return { t, useI18n: () => ({ t }) };
});

const status = (allowed: boolean): AiConsentStatus => ({
  scope: "mobile",
  version: "2026-09-14",
  recipients: [
    { key: "model", name: "Example AI", use: "model", detail: "example/model", allowed },
  ],
});

describe("AI data sharing screen", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("reloads after a failed revoke and displays the server status", async () => {
    rpc
      .mockResolvedValueOnce(status(true))
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(status(false));
    await act(async () => root.render(<AiDataSharing />));
    await act(async () =>
      (container.querySelector("button[aria-label='Example AI']") as HTMLButtonElement).click(),
    );
    expect(rpc.mock.calls.map(([procedure]) => procedure)).toEqual([
      "aiConsent/status",
      "aiConsent/revoke",
      "aiConsent/status",
    ]);
    expect(container.textContent).toContain("Example AI:false");
  });

  it("ignores an older status load that answers after the latest load", async () => {
    let finishOld!: (value: AiConsentStatus) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    await act(async () => root.render(<AiDataSharing />));
    rpc.mockResolvedValueOnce(status(false));
    await act(async () => {
      focus.current!();
    });
    expect(container.textContent).toContain("Example AI:false");
    await act(async () => finishOld(status(true)));
    expect(container.textContent).toContain("Example AI:false");
  });
});
