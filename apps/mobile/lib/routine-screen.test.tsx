// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RoutineScreen from "../app/routine";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  t: (s: string) => s,
  focus: undefined as (() => void) | undefined,
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    state.focus = callback;
    useEffect(callback, [callback]);
  },
  useLocalSearchParams: () => ({ botId: "bot-1", routineId: "routine-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc }));
vi.mock("../lib/i18n", () => ({
  t: state.t,
  dateLocaleForUi: () => "en-US",
  useI18n: () => ({ t: state.t }),
}));
vi.mock("../lib/native", () => ({
  native: { fill: "fill" },
  useMobileTokens: () => ({
    background: "background",
    mutedForeground: "muted",
    destructive: "red",
    foreground: "foreground",
  }),
}));
vi.mock("../components/glass-title", () => ({
  glassHeaderOptions: (title: string) => ({ title }),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
    createElement("button", { type: "button", onClick: onPress }, label),
}));
vi.mock("../lib/user-error", () => ({
  errorText: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    ActivityIndicator: () => createElement("i"),
    ScrollView: box,
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
    View: box,
  };
});

let root: Root;
let host: HTMLElement;
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const routine = {
  id: "routine-1",
  name: "Daily review",
  prompt: "Review updates.",
  active: true,
  crons: [],
  timezone: "UTC",
  watch: null,
  managedKind: null,
  webhookEnabled: false,
  githubEnabled: false,
  messageProvider: null,
  status: {
    lastRunAt: null,
    nextRunAt: null,
    lastCheckedAt: null,
    lastChangedAt: null,
    pausedReason: null,
  },
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.rpc.mockReset();
  state.focus = undefined;
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("shows Try again after a failed load and reloads the routine when pressed", async () => {
  state.rpc.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([routine]);
  await act(async () => root.render(createElement(RoutineScreen)));
  await flush();
  expect(host.textContent).toContain("Could not load routine");
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeTruthy();
  await act(async () => retry?.click());
  await flush();
  expect(state.rpc).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("Review updates.");
});

it("clears the routine details when a retry finds that it was deleted", async () => {
  state.rpc.mockResolvedValueOnce([routine]).mockResolvedValueOnce([]);
  await act(async () => root.render(createElement(RoutineScreen)));
  await flush();

  await act(async () => state.focus?.());
  await flush();

  expect(host.textContent).toContain("This routine no longer exists");
  expect(host.textContent).not.toContain("Review updates.");
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).not.toContain(
    "Open conversation",
  );
});

it("keeps the last routine details when a retry fails due to a network error", async () => {
  state.rpc.mockResolvedValueOnce([routine]).mockRejectedValueOnce(new Error("offline"));
  await act(async () => root.render(createElement(RoutineScreen)));
  await flush();

  await act(async () => state.focus?.());
  await flush();

  expect(host.textContent).toContain("Could not load routine");
  expect(host.textContent).toContain("Review updates.");
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toContain(
    "Open conversation",
  );
});

it("clears the routine when a focus refresh returns not found", async () => {
  const missing = Object.assign(new Error("missing"), { status: 404 });
  state.rpc.mockResolvedValueOnce([routine]).mockRejectedValueOnce(missing);
  await act(async () => root.render(createElement(RoutineScreen)));
  await flush();

  await act(async () => state.focus?.());
  await flush();

  expect(host.textContent).toContain("Could not load routine");
  expect(host.textContent).not.toContain("Review updates.");
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toContain(
    "Try again",
  );
});

it("keeps the routine when a focus refresh fails with a non-404 error", async () => {
  const unavailable = Object.assign(new Error("offline"), { status: 503 });
  state.rpc.mockResolvedValueOnce([routine]).mockRejectedValueOnce(unavailable);
  await act(async () => root.render(createElement(RoutineScreen)));
  await flush();

  await act(async () => state.focus?.());
  await flush();

  expect(host.textContent).toContain("Could not load routine");
  expect(host.textContent).toContain("Review updates.");
});
