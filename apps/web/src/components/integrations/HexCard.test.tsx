// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
const rpc = vi.hoisted(() => ({
  meetings: { localStatus: vi.fn(), connectLocal: vi.fn(), disconnectLocal: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({ rpc }));
const sync = vi.hoisted(() => ({ hexSyncNow: vi.fn() }));
vi.mock("../../lib/hex/useHexSync", () => ({
  hexBridge: () => undefined,
  hexSyncNow: sync.hexSyncNow,
  useHexOutcome: () => "idle",
}));

import { HexCard } from "./HexCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const connected = {
  connectionId: "conn_1",
  status: "connected" as const,
  syncedThrough: "2026-10-31T14:00:00Z",
  lastSyncedAt: new Date(Date.now() - 120_000).toISOString(),
  count: 12,
};

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;
async function render(props: Parameters<typeof HexCard>[0]) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<HexCard {...props} />));
}
const text = () => container?.textContent ?? "";
const button = (name: string) =>
  [...document.querySelectorAll("button")].find((el) => el.textContent === name) as
    | HTMLButtonElement
    | undefined;

beforeEach(() => {
  rpc.meetings.localStatus.mockReset().mockResolvedValue(null);
  rpc.meetings.connectLocal.mockReset().mockResolvedValue({ connectionId: "conn_1" });
  rpc.meetings.disconnectLocal.mockReset().mockResolvedValue({ ok: true });
  sync.hexSyncNow.mockReset().mockResolvedValue("ok");
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
});

it("is not shown on the web without a Hex connection", async () => {
  await render({ available: false, outcome: "idle" });
  expect(text()).toBe("");
});

it("offers Connect on a Mac and starts a pass after connecting", async () => {
  await render({ available: true, outcome: "idle" });
  expect(text()).toContain("Meetings recorded on this Mac");
  await act(async () => button("Connect")?.click());
  expect(rpc.meetings.connectLocal).toHaveBeenCalledWith({ source: "hex" });
  expect(sync.hexSyncNow).toHaveBeenCalled();
});

it("shows the count and age when synced", async () => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: true, outcome: "ok" });
  expect(text()).toContain("Synced");
  expect(text()).toContain("12 meetings");
  expect(text()).toContain("2m ago");
});

it.each([
  ["not_found", "Install Hex"],
  ["update", "Update Hex"],
  ["failed", "Couldn't read Hex"],
] as const)("says %s as %s", async (outcome, words) => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: true, outcome });
  expect(text()).toContain(words);
});

it("retries a failed read", async () => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: true, outcome: "failed" });
  await act(async () => button("Retry")?.click());
  expect(sync.hexSyncNow).toHaveBeenCalled();
});

it("on the web shows a read-only line and only Disconnect", async () => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: false });
  expect(text()).toContain("Desktop app");
  expect(text()).toContain("Last sync 2m ago");
  expect(button("Connect")).toBeUndefined();
  expect(button("Retry")).toBeUndefined();
  expect(button("Disconnect")).toBeDefined();
});

it("disconnects after a confirm, keeping the meetings unless asked to delete them", async () => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: true, outcome: "ok" });
  await act(async () => button("Disconnect")?.click());
  expect(document.body.textContent).toContain("Delete imported meetings too");
  const confirm = [...document.querySelectorAll("button")].filter(
    (el) => el.textContent === "Disconnect",
  );
  await act(async () => confirm.at(-1)?.click());
  expect(rpc.meetings.disconnectLocal).toHaveBeenCalledWith({
    connectionId: "conn_1",
    deleteMeetings: false,
  });
});

it("deletes imported meetings too when the switch is on", async () => {
  rpc.meetings.localStatus.mockResolvedValue(connected);
  await render({ available: true, outcome: "ok" });
  await act(async () => button("Disconnect")?.click());
  await act(async () => document.getElementById("hex-delete-meetings")?.click());
  const confirm = [...document.querySelectorAll("button")].filter(
    (el) => el.textContent === "Disconnect",
  );
  await act(async () => confirm.at(-1)?.click());
  expect(rpc.meetings.disconnectLocal).toHaveBeenCalledWith({
    connectionId: "conn_1",
    deleteMeetings: true,
  });
});
