// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import type { IntegrationsData } from "./useIntegrations";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("../../lib/omi/useOmiSync", () => ({
  useOmiSync: () => ({ state: { kind: "idle" }, sync: () => undefined }),
}));
const rpc = vi.hoisted(() => ({
  omiCloud: { status: vi.fn(async (..._args: unknown[]): Promise<unknown> => null) },
  omi: {
    status: vi.fn(),
    deleteRecordings: vi.fn(),
    disconnect: vi.fn(),
    retryTranscription: vi.fn(),
    segments: { list: vi.fn(), move: vi.fn() },
  },
  dataRoom: { items: { list: vi.fn() } },
  connections: { access: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({ rpc }));

import { OmiPage } from "./OmiPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
afterEach(() => {
  vi.useRealTimers();
  container?.remove();
  vi.clearAllMocks();
});

const connected = {
  connectionId: "c1",
  pendingUploads: 0,
  recordings: 1,
  notTranscribed: 0,
  agentBotId: null,
};
const today = new Date().toISOString();
const segment = {
  id: "s1",
  audioItemId: "a1",
  kind: "note",
  title: "Idea for onboarding email",
  startedAt: today,
  endedAt: today,
  sortedBy: "agent",
  meetingId: null,
  noteItemId: null,
};

async function render() {
  container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    createRoot(container as HTMLDivElement).render(
      <MemoryRouter>
        <OmiPage data={{ bots: [] } as unknown as IntegrationsData} />
      </MemoryRouter>,
    );
  });
  return container;
}

it("asks for a transcription key when a ready Omi item has that error", async () => {
  rpc.omi.status.mockResolvedValue(connected);
  rpc.omi.segments.list.mockResolvedValue([]);
  rpc.dataRoom.items.list.mockResolvedValue({
    items: [{ source: "omi", status: "ready", error: "no_transcription_provider" }],
    nextCursor: null,
  });
  const view = await render();
  expect(rpc.dataRoom.items.list).toHaveBeenCalledWith(expect.objectContaining({ source: "omi" }));
  expect(view.textContent).toContain("Add a transcription key");
});

it("clears Today after Delete all recordings without a reload", async () => {
  rpc.omi.status.mockResolvedValue(connected);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  rpc.omi.segments.list.mockResolvedValue([segment]);
  rpc.omi.deleteRecordings.mockImplementation(async () => {
    rpc.omi.segments.list.mockResolvedValue([]);
    return { ok: true };
  });
  const view = await render();
  expect(view.textContent).toContain("Idea for onboarding email");
  const more = view.querySelector<HTMLElement>('button[aria-label="More"]');
  await act(async () => {
    more?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    more?.click();
  });
  const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((el) =>
    el.textContent?.includes("Delete all recordings"),
  );
  await act(async () => item?.click());
  const confirm = Array.from(document.querySelectorAll<HTMLElement>("button")).find(
    (el) => el.textContent === "Delete",
  );
  await act(async () => confirm?.click());
  expect(rpc.omi.deleteRecordings).toHaveBeenCalled();
  expect(view.textContent).not.toContain("Idea for onboarding email");
});

it("asks again every 10 seconds while the key card says Syncing, and stops once it has synced", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const cloud = {
    connectionId: "cc1",
    status: "connected",
    syncedThrough: null,
    lastSyncedAt: null,
    syncedCount: 0,
    agentBotId: null,
  };
  rpc.omi.status.mockResolvedValue(null);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  rpc.omiCloud.status.mockResolvedValue(cloud);
  const view = await render();
  expect(view.textContent).toContain("Syncing");
  const calls = rpc.omiCloud.status.mock.calls.length;
  rpc.omiCloud.status.mockResolvedValue({
    ...cloud,
    syncedThrough: "2026-11-06T10:00:00Z",
    syncedCount: 2,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(rpc.omiCloud.status.mock.calls.length).toBe(calls + 1);
  expect(view.textContent).toContain("Synced 2 meetings");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(rpc.omiCloud.status.mock.calls.length).toBe(calls + 1);
});

it("keeps one status request in flight and aborts it when the page goes away", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  rpc.omi.status.mockResolvedValue(null);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  const syncing = {
    connectionId: "cc1",
    status: "connected",
    syncedThrough: null,
    lastSyncedAt: null,
    syncedCount: 0,
    agentBotId: null,
  };
  // The mount load answers; every poll after it hangs.
  rpc.omiCloud.status
    .mockResolvedValueOnce(syncing)
    .mockImplementation(() => new Promise(() => {}));
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <OmiPage data={{ bots: [] } as unknown as IntegrationsData} />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(40_000);
  });
  // The mount load plus one poll; the hanging poll blocks the next ticks.
  expect(rpc.omiCloud.status).toHaveBeenCalledTimes(2);
  const options = rpc.omiCloud.status.mock.calls[1]?.[1] as { signal: AbortSignal } | undefined;
  const signal = options?.signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
});

it("shows the Omi agent for a key-only user without a pendant", async () => {
  rpc.connections.access.mockResolvedValue({ allAgents: false, botIds: [], agentShared: false });
  rpc.omi.status.mockResolvedValue(null);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  rpc.omiCloud.status.mockResolvedValue({
    connectionId: "cc1",
    status: "connected",
    syncedThrough: "2026-11-06T10:00:00Z",
    lastSyncedAt: null,
    syncedCount: 2,
    agentBotId: "bot_1",
  });
  const view = await render();
  expect(view.textContent).toContain("Omi agent");
});

it("hides the Omi agent once the key is removed or needs reconnecting", async () => {
  rpc.connections.access.mockResolvedValue({ allAgents: false, botIds: [], agentShared: false });
  rpc.omi.status.mockResolvedValue(null);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  for (const status of ["disconnected", "needs_reconnect"]) {
    rpc.omiCloud.status.mockResolvedValue({
      connectionId: "cc1",
      status,
      syncedThrough: "2026-11-06T10:00:00Z",
      lastSyncedAt: null,
      syncedCount: 2,
      agentBotId: "bot_1",
    });
    const view = await render();
    expect(view.textContent).not.toContain("Omi agent");
  }
});

const tryAgain = (view: HTMLElement) =>
  Array.from(view.querySelectorAll("button")).find((el) => el.textContent === "Try again");

it("shows no not-transcribed line when none failed", async () => {
  rpc.omi.status.mockResolvedValue(connected);
  rpc.omi.segments.list.mockResolvedValue([]);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  const view = await render();
  expect(view.textContent).not.toContain("not transcribed");
  expect(tryAgain(view)).toBeUndefined();
});

it("offers Try again for failed recordings and the line goes once they recover", async () => {
  rpc.omi.status.mockResolvedValue({ ...connected, notTranscribed: 2 });
  rpc.omi.segments.list.mockResolvedValue([]);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  rpc.omi.retryTranscription.mockImplementation(async () => {
    rpc.omi.status.mockResolvedValue(connected);
    return { ok: true };
  });
  const view = await render();
  expect(view.textContent).toContain("2 not transcribed");
  await act(async () => tryAgain(view)?.click());
  expect(rpc.omi.retryTranscription).toHaveBeenCalledTimes(1);
  expect(view.textContent).not.toContain("not transcribed");
});

it("shows the error and keeps the line when Try again fails", async () => {
  rpc.omi.status.mockResolvedValue({ ...connected, notTranscribed: 1 });
  rpc.omi.segments.list.mockResolvedValue([]);
  rpc.dataRoom.items.list.mockResolvedValue({ items: [], nextCursor: null });
  rpc.omi.retryTranscription.mockRejectedValue(new Error("Network down"));
  const view = await render();
  expect(view.textContent).toContain("1 not transcribed");
  await act(async () => tryAgain(view)?.click());
  expect(view.querySelector('[role="alert"]')?.textContent).toContain("Network down");
  expect(view.textContent).toContain("1 not transcribed");
});
