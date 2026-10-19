// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  onAppState: undefined as undefined | ((s: string) => void),
  onPush: undefined as undefined | (() => void),
}));
const scope = vi.hoisted(() => ({ space: "space-a" }));
vi.mock("./api", () => ({
  rpc,
  currentApiBase: () => "https://api.test",
  selectedSpaceId: () => scope.space,
  subscribeApiBase: () => () => undefined,
}));
vi.mock("./session", () => ({
  currentSessionGeneration: () => 1,
  subscribeSessionGeneration: () => () => undefined,
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_e: string, l: (s: string) => void) => {
      state.onAppState = l;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("expo-notifications", () => ({
  addNotificationReceivedListener: (l: () => void) => {
    state.onPush = l;
    return { remove: vi.fn() };
  },
}));

import {
  markSurfaceSeen,
  refreshUnseenCounts,
  useUnseenCount,
  useUnseenCountsRefresh,
} from "./unseen-notifications";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useUnseenCountsRefresh(true);
  return <span data-dot={useUnseenCount("inbox") > 0} />;
}

beforeEach(() => {
  rpc.mockReset();
  scope.space = "space-a";
});

it("shows the dot from unseenCounts, refreshes on foreground and push, clears on markSeen", async () => {
  rpc.mockResolvedValue({ counts: { inbox: 2 } });
  const host = document.createElement("div");
  const r = createRoot(host);
  await act(async () => r.render(<Probe />));
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("true");
  expect(rpc).toHaveBeenCalledWith("notifications/unseenCounts");

  rpc.mockClear();
  await act(async () => state.onAppState?.("active"));
  await act(async () => state.onPush?.());
  expect(rpc).toHaveBeenCalledTimes(2);

  rpc.mockImplementation(async (proc: string) =>
    proc === "notifications/markSeen" ? { ok: true } : { counts: {} },
  );
  await act(async () => markSurfaceSeen("inbox"));
  expect(rpc).toHaveBeenCalledWith("notifications/markSeen", { surface: "inbox" });
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("false");
  await act(async () => r.unmount());
});

it("ignores an older refresh that resolves after markSeen, and counts from another space", async () => {
  let release: (v: unknown) => void = () => undefined;
  const host = document.createElement("div");
  const r = createRoot(host);
  rpc.mockResolvedValue({ counts: { inbox: 1 } });
  await act(async () => r.render(<Probe />));
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("true");

  rpc.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
  const stale = refreshUnseenCounts();
  rpc.mockImplementation(async (proc: string) =>
    proc === "notifications/markSeen" ? { ok: true } : { counts: {} },
  );
  await act(async () => markSurfaceSeen("inbox"));
  await act(async () => {
    release({ counts: { inbox: 1 } });
    await stale;
  });
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("false");

  // Counts read for one space do not show in another.
  rpc.mockResolvedValue({ counts: { inbox: 3 } });
  await act(async () => refreshUnseenCounts());
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("true");
  scope.space = "space-b";
  await act(async () => r.render(<Probe />));
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("false");
  await act(async () => r.unmount());
});
