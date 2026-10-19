// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  onAppState: undefined as undefined | ((s: string) => void),
  onPush: undefined as undefined | (() => void),
}));
vi.mock("./api", () => ({ rpc }));
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

import { markSurfaceSeen, useUnseenCount, useUnseenCountsRefresh } from "./unseen-notifications";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useUnseenCountsRefresh(true);
  return <span data-dot={useUnseenCount("inbox") > 0} />;
}

beforeEach(() => rpc.mockReset());

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

  rpc.mockResolvedValue({ ok: true });
  await act(async () => markSurfaceSeen("inbox"));
  expect(rpc).toHaveBeenCalledWith("notifications/markSeen", { surface: "inbox" });
  expect(host.querySelector("span")?.getAttribute("data-dot")).toBe("false");
  await act(async () => r.unmount());
});
