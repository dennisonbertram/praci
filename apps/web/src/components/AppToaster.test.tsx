// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, ""),
}));

const rpcMock = vi.hoisted(() => ({
  notifications: {
    pendingApprovals: vi.fn(async () => ({ notifications: [] })),
    preferences: vi.fn(async () => ({ channels: {} })),
    list: vi.fn(async () => ({ notifications: [] })),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

vi.mock("../lib/auth", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u1" } } }) },
}));
vi.mock("../lib/notification-stream", () => ({ followNotifications: vi.fn(async () => {}) }));
vi.mock("../lib/i18n", () => ({ i18n: { _: ({ message }: { message: string }) => message } }));
vi.mock("@rakazo/ui-web", () => ({ NotificationToaster: () => null }));
vi.mock("./integrations/AgentAvatar", () => ({ AgentAvatar: () => null }));
const syncSpy = vi.hoisted(() => vi.fn());
vi.mock("../lib/notification-delivery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/notification-delivery")>()),
  syncApprovalToasts: syncSpy,
}));

import { AppToaster } from "./AppToaster";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  rpcMock.notifications.pendingApprovals.mockClear();
  syncSpy.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  delete (document as unknown as Record<string, unknown>).visibilityState;
});

const setVisibility = (state: "hidden" | "visible") =>
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });

it("rebuilds approval toasts when a hidden tab becomes visible", async () => {
  setVisibility("hidden");
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AppToaster />
      </MemoryRouter>,
    );
  });
  // Nothing is fetched while the tab is hidden, where toasts would not be seen.
  expect(rpcMock.notifications.pendingApprovals).not.toHaveBeenCalled();

  setVisibility("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(rpcMock.notifications.pendingApprovals).toHaveBeenCalled();
});

it("applies a slow answer when no newer one has been applied, and never an older one after", async () => {
  const answers: Array<(value: { notifications: { id: string }[] }) => void> = [];
  rpcMock.notifications.pendingApprovals.mockImplementation(
    () => new Promise((resolve) => answers.push(resolve as (typeof answers)[number])),
  );
  setVisibility("visible");
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AppToaster />
      </MemoryRouter>,
    );
  });
  // A second rebuild starts before the first answers, as the 2 s poll does on a slow network.
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(answers).toHaveLength(2);
  await act(async () => answers[0]?.({ notifications: [{ id: "first" }] }));
  expect(syncSpy).toHaveBeenCalledTimes(1);
  await act(async () => answers[1]?.({ notifications: [{ id: "second" }] }));
  expect(syncSpy).toHaveBeenCalledTimes(2);
  expect(syncSpy.mock.calls[1]?.[0]).toEqual([{ id: "second" }]);
});

it("drops an answer that arrives after the newer one was applied", async () => {
  const answers: Array<(value: { notifications: { id: string }[] }) => void> = [];
  rpcMock.notifications.pendingApprovals.mockImplementation(
    () => new Promise((resolve) => answers.push(resolve as (typeof answers)[number])),
  );
  setVisibility("visible");
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AppToaster />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await act(async () => answers[1]?.({ notifications: [{ id: "newer" }] }));
  await act(async () => answers[0]?.({ notifications: [{ id: "older" }] }));
  expect(syncSpy).toHaveBeenCalledTimes(1);
  expect(syncSpy.mock.calls[0]?.[0]).toEqual([{ id: "newer" }]);
});
