// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  notifications: { unseenCounts: vi.fn(), glance: vi.fn(), markSeen: vi.fn() },
}));
vi.mock("./rpc", () => ({ rpc }));

import { followNotifications } from "./notification-stream";
import { NOTIFICATIONS_CHANGED_EVENT, surfaceOfPath, useSidebarGlance } from "./use-sidebar-glance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const quiet = {
  financeRunwayMonths: null,
  legalDueSoon: 0,
  devinNeedsYou: 0,
  devinConnected: false,
  dataRoomWaiting: 0,
  hasTickets: false,
  botKinds: {},
};
let seen: ReturnType<typeof useSidebarGlance>;
function Probe({
  pathname,
  thread,
}: {
  pathname: string;
  thread?: { botId: string | null; threadId: string };
}) {
  seen = useSidebarGlance(pathname, thread);
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
  expect(surfaceOfPath("/app/devin")).toBe("devin");
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

let attended = true;
const setAttended = (value: boolean) => {
  attended = value;
  act(() => {
    window.dispatchEvent(new Event(value ? "focus" : "blur"));
  });
};
beforeEach(() => {
  attended = true;
  vi.spyOn(document, "hasFocus").mockImplementation(() => attended);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

it("marks the open page's surface seen, refreshes, and shows the cleared state", async () => {
  rpc.notifications.unseenCounts
    .mockResolvedValueOnce({ counts: { legal: 2, finance: 1 } })
    .mockResolvedValue({ counts: { finance: 1 } });
  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.markSeen).toHaveBeenCalledTimes(1);
  expect(rpc.notifications.markSeen).toHaveBeenCalledWith({ surface: "legal" });
  // The dot for the open page is gone; other surfaces keep theirs.
  expect(seen.counts).toEqual({ finance: 1 });
});

it("does not mark anything seen on a page with no unseen notifications", async () => {
  rpc.notifications.unseenCounts.mockResolvedValue({ counts: { finance: 1 } });
  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.markSeen).not.toHaveBeenCalled();
  expect(seen.counts).toEqual({ finance: 1 });
});

it("waits to mark a page seen until the tab is focused", async () => {
  attended = false;
  rpc.notifications.unseenCounts.mockResolvedValue({ counts: { legal: 1 } });
  act(() => root.render(<Probe pathname="/app/legal" />));
  await flush();
  expect(rpc.notifications.markSeen).not.toHaveBeenCalled();
  setAttended(true);
  await flush();
  expect(rpc.notifications.markSeen).toHaveBeenCalledWith({ surface: "legal" });
});

it("clears every unseen notification of the viewed agent, only while attended", async () => {
  attended = false;
  rpc.notifications.glance.mockResolvedValue({ ...quiet, botKinds: { "bot-1": "done" } });
  const thread = { botId: "bot-1", threadId: "thread-1" };
  act(() => root.render(<Probe pathname="/app" thread={thread} />));
  await flush();
  expect(rpc.notifications.markSeen).not.toHaveBeenCalled();
  setAttended(true);
  await flush();
  expect(rpc.notifications.markSeen).toHaveBeenCalledWith({ botId: "bot-1" });
});

it("leaves an agent's thread alone when that agent has nothing unseen", async () => {
  rpc.notifications.glance.mockResolvedValue({ ...quiet, botKinds: { "bot-2": "urgent" } });
  act(() =>
    root.render(<Probe pathname="/app" thread={{ botId: "bot-1", threadId: "thread-1" }} />),
  );
  await flush();
  expect(rpc.notifications.markSeen).not.toHaveBeenCalled();
});

it("refreshes when the notification stream delivers a frame", async () => {
  // The stream announces each catch-up the way AppToaster does: with the window event.
  const frames: Array<() => void> = [];
  const controller = new AbortController();
  let release: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  const followed = followNotifications(
    {
      subscribe: async () =>
        (async function* () {
          await new Promise<void>((resolve) => frames.push(resolve));
          yield { id: "n1", surface: "legal", importance: "info" as const };
          await done;
        })(),
      list: async () => ({ notifications: [], nextCursor: null }),
      deliver: async () => "skipped",
      sleep: () => new Promise(() => {}),
      changed: () => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT)),
    },
    controller.signal,
  );
  act(() => root.render(<Probe pathname="/app" />));
  await flush();
  const before = rpc.notifications.glance.mock.calls.length;
  rpc.notifications.unseenCounts.mockResolvedValue({ counts: { finance: 1 } });
  await act(async () => {
    frames[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(rpc.notifications.glance.mock.calls.length).toBeGreaterThan(before);
  expect(seen.counts).toEqual({ finance: 1 });
  controller.abort();
  release();
  await followed.catch(() => undefined);
});
