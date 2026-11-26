// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  meetings: { localStatus: vi.fn(), importLocal: vi.fn() },
}));
vi.mock("../rpc", () => ({ rpc }));

import { useHexSync } from "./useHexSync";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useHexSync();
  return null;
}

const list = vi.fn();
function setBridge(platform: string, withHex = true) {
  (window as unknown as { rakazoDesktop: unknown }).rakazoDesktop = {
    platform,
    ...(withHex ? { hex: { available: vi.fn(), list, show: vi.fn() } } : {}),
  };
}

let root: ReturnType<typeof createRoot> | undefined;
async function mount() {
  const el = document.createElement("div");
  root = createRoot(el);
  await act(async () => root?.render(<Probe />));
}

beforeEach(() => {
  vi.useFakeTimers();
  list.mockReset().mockResolvedValue({
    state: "ok",
    value: { version: 1, meetings: [], truncated: false },
  });
  rpc.meetings.localStatus.mockReset().mockResolvedValue({
    connectionId: "c1",
    status: "connected",
    syncedThrough: null,
    lastSyncedAt: null,
    count: 0,
  });
  rpc.meetings.importLocal.mockReset().mockResolvedValue({ created: 0, updated: 0, skipped: 0 });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  delete (window as unknown as { rakazoDesktop?: unknown }).rakazoDesktop;
  vi.useRealTimers();
});

it("syncs on start, on focus and every five minutes", async () => {
  setBridge("darwin");
  await mount();
  expect(list).toHaveBeenCalledTimes(1);

  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(list).toHaveBeenCalledTimes(2);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60_000);
  });
  expect(list).toHaveBeenCalledTimes(3);
});

it("does nothing in a browser, on other desktops, or without the Hex bridge", async () => {
  await mount();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
  });
  await act(async () => root?.unmount());
  setBridge("win32");
  await mount();
  await act(async () => root?.unmount());
  setBridge("darwin", false);
  await mount();
  expect(list).not.toHaveBeenCalled();
  expect(rpc.meetings.localStatus).not.toHaveBeenCalled();
});

it("reads nothing from Hex until the user connected it", async () => {
  rpc.meetings.localStatus.mockResolvedValue(null);
  setBridge("darwin");
  await mount();
  expect(rpc.meetings.localStatus).toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
});
