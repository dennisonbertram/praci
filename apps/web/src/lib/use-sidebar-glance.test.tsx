// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  notifications: { unseenCounts: vi.fn(), glance: vi.fn(), markSeen: vi.fn() },
}));
vi.mock("./rpc", () => ({ rpc }));

import { NOTIFICATIONS_CHANGED_EVENT, surfaceOfPath, useSidebarGlance } from "./use-sidebar-glance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const quiet = { financeRunwayMonths: null, legalDueSoon: 0, dataRoomWaiting: 0, urgentBotIds: [] };
let seen: ReturnType<typeof useSidebarGlance>;
function Probe({ pathname }: { pathname: string }) {
  seen = useSidebarGlance(pathname);
  return null;
}
const flush = () => act(async () => {});
const container = document.createElement("div");
const root = createRoot(container);

beforeEach(() => {
  rpc.notifications.unseenCounts.mockReset().mockResolvedValue({ counts: {} });
  rpc.notifications.glance.mockReset().mockResolvedValue(quiet);
  rpc.notifications.markSeen.mockReset().mockResolvedValue({ count: 1 });
});
afterEach(() => act(() => root.render(null)));

it("maps app paths to notification surfaces", () => {
  expect(surfaceOfPath("/app/data-room")).toBe("data-room");
  expect(surfaceOfPath("/app/finance/runway")).toBe("finance");
  expect(surfaceOfPath("/app/inboxes")).toBeNull();
  expect(surfaceOfPath("/app")).toBeNull();
});

it("loads on mount, again on a notifications-changed event, and on page change", async () => {
  act(() => root.render(<Probe pathname="/app" />));
  await flush();
  expect(rpc.notifications.glance).toHaveBeenCalledTimes(1);

  rpc.notifications.glance.mockResolvedValue({ ...quiet, legalDueSoon: 4 });
  act(() => {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  });
  await flush();
  expect(rpc.notifications.glance).toHaveBeenCalledTimes(2);
  expect(seen.glance.legalDueSoon).toBe(4);

  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.glance).toHaveBeenCalledTimes(3);
});

it("marks the open page's surface seen and refreshes, but not other surfaces", async () => {
  rpc.notifications.unseenCounts.mockResolvedValue({ counts: { legal: 2, finance: 1 } });
  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.markSeen).toHaveBeenCalledTimes(1);
  expect(rpc.notifications.markSeen).toHaveBeenCalledWith({ surface: "legal" });
  // Refreshed after marking, so the dot clears.
  expect(rpc.notifications.unseenCounts.mock.calls.length).toBeGreaterThanOrEqual(2);
});

it("does not mark anything seen on a page with no unseen notifications", async () => {
  rpc.notifications.unseenCounts.mockResolvedValue({ counts: { finance: 1 } });
  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.markSeen).not.toHaveBeenCalled();
  expect(seen.counts).toEqual({ finance: 1 });
});
