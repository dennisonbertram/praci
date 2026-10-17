// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  servers: vi.fn(),
  capTable: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: { list: rpcMock.list, save: rpcMock.save, delete: rpcMock.remove },
    mcp: { servers: { list: rpcMock.servers } },
    carta: { capTable: rpcMock.capTable, refresh: rpcMock.refresh },
  },
}));

import { CapTablePage } from "./CapTable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact = (id: string, name: string, kind: Contact["kind"]): Contact => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.test`,
  organization: null,
  kind,
  notes: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});
const cartaServer = { id: "s1", enabled: true, endpoint: "https://mcp.app.carta.com/mcp" };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const button = (label: string) =>
  [...document.querySelectorAll("button, [role=tab]")].find((b) => b.textContent === label) as
    | HTMLElement
    | undefined;
const click = (el: HTMLElement | undefined) => act(async () => el?.click());

async function show() {
  await act(async () => root.render(<CapTablePage onConnectCarta={() => {}} />));
  await flush();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "investor"),
    contact("c2", "Bo", "auditor"),
  ]);
  rpcMock.servers.mockResolvedValue([cartaServer]);
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: false });
});
afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("lists contacts and filters by kind", async () => {
  await show();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).toContain("Bo");
  await click(button("Auditors"));
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("Bo");
});

it("adds a contact through the dialog and shows a server error", async () => {
  rpcMock.save.mockRejectedValueOnce(new Error("Email already used"));
  await show();
  await click(button("Add contact"));
  const name = document.getElementById("contact-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "Cy");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Cy", kind: "investor" }),
  );
  expect(document.body.textContent).toContain("Email already used");
  rpcMock.save.mockResolvedValue({});
  await click(button("Save"));
  expect(document.getElementById("contact-name")).toBeNull();
});

it("shows Connect Carta only without a Carta server", async () => {
  await show();
  expect(button("Connect Carta")).toBeUndefined();
  rpcMock.servers.mockResolvedValue([]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show();
  expect(button("Connect Carta")).toBeDefined();
});

it("shows Connect Carta when the Carta sign-in needs attention", async () => {
  rpcMock.servers.mockResolvedValue([{ ...cartaServer, oauthStatus: "reconnect" }]);
  await show();
  expect(button("Connect Carta")).toBeDefined();
});

it("ignores a contacts response that arrives after a newer reload", async () => {
  let resolveFirst: (value: Contact[]) => void = () => {};
  rpcMock.list.mockReset();
  rpcMock.list
    .mockReturnValueOnce(new Promise<Contact[]>((resolve) => (resolveFirst = resolve)))
    .mockResolvedValue([contact("c3", "Newer", "investor")]);
  rpcMock.save.mockResolvedValue({});
  await show();
  await click(button("Add contact"));
  const name = document.getElementById("contact-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "Cy");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Save"));
  expect(container.textContent).toContain("Newer");
  await act(async () => resolveFirst([contact("c1", "Stale", "investor")]));
  expect(container.textContent).toContain("Newer");
  expect(container.textContent).not.toContain("Stale");
});

const snapshot = {
  companyName: "Example Co",
  asOf: "2026-10-01",
  fullyDilutedShares: 10_000_000,
  amountRaisedUsd: null,
  optionPoolAvailable: 500_000,
  latest409a: { pricePerShareUsd: 1.25, date: "2026-09-01" },
  shareClasses: [
    { name: "Common", shares: 7_000_000, percent: 70 },
    { name: "Series Seed Preferred", shares: 3_000_000, percent: 30 },
  ],
  holders: [
    {
      name: "Ada Example",
      email: "ada@example.test",
      organization: "Example Ventures",
      security: "Series Seed Preferred",
      shares: 1_000_000,
      amountUsd: null,
      percent: 10,
    },
    {
      name: "Dee Newcomer",
      email: null,
      organization: "Newcomer Fund",
      security: "SAFE",
      shares: null,
      amountUsd: 250_000,
      percent: null,
    },
  ],
  updatedAt: new Date().toISOString(),
};

it("shows the summary, ownership legend and joined investors", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const text = container.textContent ?? "";
  expect(text).toContain("Example Co");
  expect(text).toContain("10,000,000");
  expect(text).toContain("500,000");
  expect(text).toContain("$1.25");
  expect(text).toContain("Series Seed Preferred 30.00%");
  expect(text).toContain("Common 70.00%");
  expect(text).toContain("1,000,000");
  expect(text).toContain("10.00%");
  expect(text).toContain("Example Ventures");
  expect(text).toContain("SAFE, $250,000");
  // amount raised is null; the SAFE holder has no shares or percent
  expect(text).toContain("—");
  // Bo is a contact with no holding and is still listed
  expect(text).toContain("Bo");
});

it("offers Add email for a holder without a contact and prefills the dialog", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const add = [...container.querySelectorAll("button")].filter(
    (b) => b.textContent === "Add email",
  );
  expect(add).toHaveLength(1);
  await click(add[0]);
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Dee Newcomer");
  expect((document.getElementById("contact-organization") as HTMLInputElement).value).toBe(
    "Newcomer Fund",
  );
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("investor");
});

it("refreshes and polls until syncing stops", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: true });
  await click(container.querySelector("[aria-label='Refresh from Carta']") as HTMLElement);
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
  const before = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(3100));
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(before);
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await act(async () => vi.advanceTimersByTimeAsync(3100));
  const settled = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(rpcMock.capTable.mock.calls.length).toBe(settled);
});

it("shows Reading Carta while the first snapshot is syncing", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: true });
  await show();
  expect(container.textContent).toContain("Reading Carta…");
});

it("shows no snapshot UI when Carta is not connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  await show();
  expect(rpcMock.capTable).not.toHaveBeenCalled();
  expect(container.querySelector("[aria-label='Refresh from Carta']")).toBeNull();
  expect(button("Connect Carta")).toBeDefined();
});

it("reloads contacts when a sync finishes", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: true });
  await show();
  expect(rpcMock.list).toHaveBeenCalledTimes(1);
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: false });
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(rpcMock.list).toHaveBeenCalledTimes(2);
});

it("shows a retry when the cap table cannot be read, and stops polling", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValueOnce({ snapshot: null, syncing: true });
  await show();
  rpcMock.capTable.mockRejectedValue(new Error("down"));
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(container.textContent).toContain("Could not load the cap table");
  expect(container.textContent).not.toContain("Reading Carta");
  const calls = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(rpcMock.capTable.mock.calls.length).toBe(calls);
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: false });
  await click(button("Try again"));
  expect(container.textContent).not.toContain("Could not load the cap table");
});

it("picks up a run started elsewhere on focus and on a slow background check", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: false });
  await show();
  const initial = rpcMock.capTable.mock.calls.length;
  await act(async () => void window.dispatchEvent(new Event("focus")));
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(initial);
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: true });
  await act(async () => vi.advanceTimersByTimeAsync(30_100));
  expect(container.textContent).toContain("Reading Carta…");
  const polling = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(3100));
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(polling);
});

it("retries the refresh, not the contacts load, after a failed refresh", async () => {
  rpcMock.refresh.mockRejectedValueOnce(new Error("boom"));
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  await click(container.querySelector("[aria-label='Refresh from Carta']") as HTMLElement);
  expect(container.textContent).toContain("boom");
  const lists = rpcMock.list.mock.calls.length;
  await click(button("Try again"));
  expect(rpcMock.refresh).toHaveBeenCalledTimes(2);
  expect(rpcMock.list.mock.calls.length).toBe(lists);
  expect(container.textContent).not.toContain("boom");
});

it("explains an empty cap table and offers Connect Carta and Add contact once", async () => {
  rpcMock.list.mockResolvedValue([]);
  rpcMock.servers.mockResolvedValue([]);
  await show();
  expect(container.textContent).toContain("No cap table yet");
  const labels = [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels.filter((label) => label === "Connect Carta")).toHaveLength(1);
  expect(labels.filter((label) => label?.includes("Add contact"))).toHaveLength(1);
  expect(button("Investors")).toBeUndefined();
});
