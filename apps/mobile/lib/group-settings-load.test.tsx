// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GroupSettings from "../app/group-settings";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  failed: true,
  translate: (text: string) => text,
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ groupId: "group-1" }),
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc }));
vi.mock("../lib/i18n", () => ({
  t: state.translate,
  useI18n: () => ({ t: state.translate }),
}));
vi.mock("../lib/native", () => ({
  native: { fill: "fill" },
  useMobileTokens: () => ({
    background: "bg",
    mutedForeground: "muted",
    foreground: "ink",
    destructive: "red",
  }),
}));
vi.mock("../lib/user-error", () => ({
  errorText: (error: unknown) => (error instanceof Error ? error.message : "error"),
}));
vi.mock("../components/glass-title", () => ({
  glassHeaderOptions: () => ({}),
}));
vi.mock("../components/bot-member-picker", () => ({
  BotMemberPicker: () => <div>members</div>,
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ActivityIndicator: () => <i data-testid="spinner" />,
    Alert: { alert: vi.fn() },
    ScrollView: Box,
    View: Box,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    TextInput: ({ value }: { value?: string }) => <input value={value ?? ""} readOnly />,
  };
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.failed = true;
  state.rpc.mockReset().mockImplementation(async (procedure: string) => {
    if (state.failed && procedure === "groups/list") throw new Error("groups failed");
    if (procedure === "groups/list") return [{ id: "group-1", name: "Fixture", members: [] }];
    if (procedure === "bots/list") return [];
    return undefined;
  });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

it("shows retry after either group settings request fails", async () => {
  await act(async () => root.render(<GroupSettings />));
  expect(container.textContent).toContain("groups failed");
  expect(container.querySelector("input")).toBeNull();
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  )!;
  expect(retry).toBeTruthy();
  state.failed = false;
  await act(async () => retry.click());
  expect(container.querySelector("input")?.value).toBe("Fixture");
  expect(state.rpc.mock.calls.filter(([procedure]) => procedure === "groups/list")).toHaveLength(2);
});
