// @vitest-environment jsdom

import type { OmiCloudStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

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
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
const omiCloud = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { omiCloud } }));

import { OmiCloudKeyCard } from "./OmiCloudKeyCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const connected: NonNullable<OmiCloudStatus> = {
  connectionId: "conn_1",
  status: "connected",
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 2,
  agentBotId: null,
};

let container: HTMLDivElement;
const onChanged = vi.fn();

async function show(status: OmiCloudStatus) {
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <OmiCloudKeyCard status={status} onChanged={onChanged} />
      </MemoryRouter>,
    ),
  );
}
const text = () => container.textContent ?? "";
const field = () => container.querySelector("input") as HTMLInputElement;
const button = (label: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === label,
  ) as HTMLButtonElement;
async function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field(), value);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.append(container);
});

it("shows only a link until it is opened, then a password field", async () => {
  await show(null);
  expect(container.querySelector("input")).toBeNull();
  await act(async () => button("Use an Omi key").click());
  expect(field().type).toBe("password");
  expect(text()).toContain("Omi developer key");
  expect(button("Connect").disabled).toBe(true);
});

it("connects with the typed key, shows Connecting and refreshes", async () => {
  let finish = () => {};
  omiCloud.connect.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  await show(null);
  await act(async () => button("Use an Omi key").click());
  await type("omi_dev_key");
  await act(async () => button("Connect").click());
  expect(omiCloud.connect).toHaveBeenCalledWith({ apiKey: "omi_dev_key" });
  expect(text()).toContain("Connecting…");
  await act(async () => finish());
  expect(onChanged).toHaveBeenCalled();
});

it.each([
  "Omi rejected this key",
  "This is an MCP key. Create a Developer key in the Omi app.",
  "Could not reach Omi",
])("shows the API error %s and clears it on edit", async (message) => {
  omiCloud.connect.mockRejectedValue(new Error(message));
  await show(null);
  await act(async () => button("Use an Omi key").click());
  await type("bad");
  await act(async () => button("Connect").click());
  expect(text()).toContain(message);
  expect(field().value).toBe("bad");
  await type("bad2");
  expect(text()).not.toContain(message);
});

it("shows the synced count and Remove when connected, with no field", async () => {
  await show(connected);
  expect(text()).toContain("Synced 2 meetings");
  expect(container.querySelector("input")).toBeNull();
  await act(async () => button("Remove").click());
  expect(omiCloud.disconnect).toHaveBeenCalled();
  expect(onChanged).toHaveBeenCalled();
});

it("asks to reconnect with a field when the key was rejected", async () => {
  await show({ ...connected, status: "needs_reconnect" });
  expect(text()).toContain("Reconnect needed");
  expect(field()).not.toBeNull();
});

it("shows the running count and the duration during the first import", async () => {
  await show({ ...connected, syncedThrough: null, syncedCount: 12 });
  expect(text()).toContain("Syncing");
  expect(text()).toContain("12 meetings so far");
  expect(container.querySelector('a[href="/app/meetings?source=omi_cloud"]')).not.toBeNull();
  expect(text()).toContain("This can take several hours");
});

it("hides the import notes once synced", async () => {
  await show(connected);
  expect(text()).not.toContain("several hours");
  expect(text()).not.toContain("so far");
});

it("shows no count before the first meeting arrives", async () => {
  await show({ ...connected, syncedThrough: null, syncedCount: 0 });
  expect(text()).toContain("several hours");
  expect(text()).not.toContain("so far");
});

it("keeps the meetings link and message after Remove, with the form", async () => {
  await show({ ...connected, status: "disconnected" });
  expect(text()).toContain("Praci keeps your meetings and to-dos.");
  expect(text()).toContain("Synced 2 meetings");
  expect(field()).not.toBeNull();
});

it("shows where to create a key until the user types", async () => {
  await show(null);
  await act(async () => button("Use an Omi key").click());
  expect(text()).toContain("Settings → Developer → Create Key.");
  await type("x");
  expect(text()).not.toContain("Create Key");
});
