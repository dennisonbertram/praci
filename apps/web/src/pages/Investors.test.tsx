// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
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
  capTableSave: vi.fn(),
  changeSource: vi.fn(),
  undoSource: vi.fn(),
  folders: vi.fn(),
  folderCreate: vi.fn(),
  items: vi.fn(),
  connections: vi.fn(),
  catalog: vi.fn(),
  driveList: vi.fn(),
  importDrive: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: { list: rpcMock.list, save: rpcMock.save, delete: rpcMock.remove },
    mcp: { servers: { list: rpcMock.servers } },
    investors: {
      capTable: rpcMock.capTable,
      refresh: rpcMock.refresh,
      capTableSave: rpcMock.capTableSave,
      changeSource: rpcMock.changeSource,
      undoSource: rpcMock.undoSource,
    },
    connections: { list: rpcMock.connections, catalog: rpcMock.catalog },
    dataRoom: {
      folders: rpcMock.folders,
      folderCreate: rpcMock.folderCreate,
      items: { list: rpcMock.items },
      driveList: rpcMock.driveList,
      importDrive: rpcMock.importDrive,
    },
  },
}));

vi.mock("../components/integrations/useIntegrations", () => ({
  useIntegrations: () => ({
    loaded: true,
    error: null,
    catalog: [],
    connections: [],
    servers: [],
    bots: [],
    mcpAssignments: [],
    access: {},
    sources: [],
    financeSources: [],
    setup: null,
    catalogFailed: false,
    feedEnabled: false,
    refresh: async () => {},
  }),
}));

import { setHideAmounts } from "../lib/hide-amounts-preference";
import { InvestorsPage } from "./Investors";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const contact = (id: string, name: string, kind: Contact["kind"]): Contact => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.test`,
  organization: null,
  kind,
  notes: null,
  addedBy: null,
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
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (item) => item.textContent === label,
  );
/** Opens the page's source menu (its button reads "<Source> · as of <date>"). */
const openSourceMenu = () =>
  click(
    [...container.querySelectorAll<HTMLElement>("button")].find((b) =>
      /as of|Reading Carta/.test(b.textContent ?? ""),
    ),
  );
const openRow = (id: string) =>
  container.querySelector<HTMLElement>(`[data-contact-id="${id}"] [data-row-open]`) ?? undefined;
const rowActions = (name: string) =>
  container.querySelector<HTMLElement>(`button[aria-label="Actions for ${name}"]`) ?? undefined;
const field = (label: string, index = 0) =>
  [...container.querySelectorAll<HTMLInputElement>(`[data-testid=holder-row]`)][
    index
  ]?.querySelector<HTMLInputElement>(`[id$="-${label}"]`) as HTMLInputElement;
async function enter(el: HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const blur = (el: HTMLElement) =>
  act(async () => {
    el.focus();
    el.blur();
  });

async function show(url = "/app/investors", props: Parameters<typeof InvestorsPage>[0] = {}) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <InvestorsPage {...props} />
        <NotificationToaster onOpen={() => {}} />
      </MemoryRouter>,
    ),
  );
  await flush();
}
async function typeInto(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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
  rpcMock.folders.mockResolvedValue([]);
  rpcMock.items.mockResolvedValue({ items: [], nextCursor: null });
  rpcMock.connections.mockResolvedValue([]);
  rpcMock.catalog.mockResolvedValue([]);
});
afterEach(() => {
  act(() => notificationToastManager.close());
  setHideAmounts(false);
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

const carta = {
  companyName: "Example Co",
  asOf: "2026-10-01",
  source: "carta" as const,
  sourceRef: null,
  canUndo: false,
  fullyDilutedShares: 1000,
  amountRaisedUsd: null,
  optionPoolAvailable: 100,
  latest409a: { pricePerShareUsd: 1.25, date: "2026-09-01" },
  shareClasses: [],
  holders: [
    {
      name: "Ada Example",
      email: "ada@example.test",
      organization: "Example Ventures",
      security: "Seed Preferred",
      shares: 300,
      amountUsd: 500_000,
      percent: null,
    },
    {
      name: "Founder Example",
      email: null,
      organization: null,
      security: "Common",
      shares: 600,
      amountUsd: null,
      percent: null,
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
  updatedAt: "2026-10-15T10:00:00.000Z",
};
const typed = {
  ...carta,
  source: "native" as const,
  holders: carta.holders.slice(0, 2).map((h, i) => ({ ...h, id: `r${i}` })),
};
const state = (snapshot: object | null, syncing = false) => ({ snapshot, syncing });

// ---- contacts ----

it("lists investors and auditors in tabs", async () => {
  await show();
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Bo");
  await click(button("Auditors"));
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("Bo");
  // Customers, vendors and the other kinds stay on the Contacts page.
  expect(button("Shareholders")).toBeUndefined();
});

it("keeps contacts of other kinds off this page", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c5", "Vic", "vendor"),
    contact("c1", "Ada", "investor"),
  ]);
  await show();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Vic");
});

it("adds a contact of the open tab's kind and shows a server error", async () => {
  rpcMock.save.mockRejectedValueOnce(new Error("Email already used"));
  await show("/app/investors?kind=auditor");
  await click(button("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("auditor");
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Cy", kind: "auditor" }),
  );
  expect(document.body.textContent).toContain("Email already used");
  rpcMock.save.mockResolvedValue({});
  await click(button("Save"));
  expect(document.getElementById("contact-name")).toBeNull();
});

it("edits and deletes a contact from its row menu", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Edit"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada");
  await click(button("Cancel"));
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  expect(document.body.textContent).toContain("Deleted Ada");
});

it("searches the contacts", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "investor"),
    contact("c3", "Cyd", "investor"),
  ]);
  await show("/app/investors?q=cyd");
  expect(container.textContent).toContain("Cyd");
  expect(container.textContent).not.toContain("Ada");
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?q=nobody");
  expect(container.textContent).toContain("No matches");
});

it("ignores a contacts response that arrives after a newer reload", async () => {
  let resolveStale: (value: Contact[]) => void = () => {};
  rpcMock.list.mockReset();
  rpcMock.list
    .mockResolvedValueOnce([])
    .mockReturnValueOnce(new Promise<Contact[]>((resolve) => (resolveStale = resolve)))
    .mockResolvedValue([contact("c3", "Newer", "investor")]);
  rpcMock.save.mockResolvedValue({});
  await show("/app/investors?kind=investor");
  for (const name of ["Cy", "Di"]) {
    await click(button("Add contact"));
    await typeInto("contact-name", name);
    await click(button("Save"));
  }
  expect(container.textContent).toContain("Newer");
  await act(async () => resolveStale([contact("c1", "Stale", "investor")]));
  expect(container.textContent).toContain("Newer");
  expect(container.textContent).not.toContain("Stale");
});

it("offers to open the contact that already has the email when adding a duplicate", async () => {
  rpcMock.save.mockRejectedValueOnce(new Error("Another contact already has this email."));
  await show();
  await click(button("Add contact"));
  await typeInto("contact-name", "Ada R.");
  await typeInto("contact-email", "ADA@example.test");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Another contact already has this email.");
  await click(button("Open Ada"));
  expect(document.body.textContent).toContain("Edit contact");
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada");
});

it("deletes a contact with an Undo that restores it", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockResolvedValue({});
  await show("/app/investors?kind=auditor");
  await click(openRow("c2"));
  await click(button("Delete"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c2" });
  expect(document.body.textContent).toContain("Deleted Bo");
  await click(button("Undo"));
  expect(rpcMock.save).toHaveBeenCalledWith({
    name: "Bo",
    email: "bo@example.test",
    organization: null,
    kind: "auditor",
    notes: null,
  });
  expect(document.body.textContent).not.toContain("Deleted Bo");
});

it("drops a deleted row and focuses the restored name after Undo, like Contacts", async () => {
  const bo = contact("c2", "Bo", "auditor");
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockResolvedValue({ ...bo, id: "c9" });
  await show("/app/investors?kind=auditor");
  await click(openRow("c2"));
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await click(button("Delete"));
  expect(container.querySelector('[data-contact-id="c2"]')).toBeNull();
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor"), { ...bo, id: "c9" }]);
  await click(button("Undo"));
  const row = container.querySelector('[data-contact-id="c9"]');
  expect(row).not.toBeNull();
  expect(document.activeElement).toBe(row?.querySelector("[data-row-open]"));
});

it("keeps the contact restorable when Undo fails, and restores it on Try again", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
  await show("/app/investors?kind=auditor");
  await click(openRow("c2"));
  await click(button("Delete"));
  await click(button("Undo"));
  expect(document.body.textContent).toContain("Could not restore Bo");
  expect(button("Undo")).toBeUndefined();
  await click(button("Try again"));
  expect(rpcMock.save).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("Restored Bo");
});

it("confirms a save with a toast and highlights the saved row", async () => {
  const saved = contact("c3", "Cy", "investor");
  rpcMock.save.mockResolvedValue(saved);
  Element.prototype.scrollIntoView = () => {};
  await show();
  rpcMock.list.mockResolvedValue([saved]);
  await click(button("Add contact"));
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  await flush();
  const status = document.querySelector("[role=status]") as HTMLElement;
  expect(status.textContent).toContain("Saved Cy");
  expect((container.querySelector('[data-contact-id="c3"]') as HTMLElement).className).toContain(
    "bg-accent",
  );
});

it("reads the tab from the URL and names the kind when it is empty", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await show("/app/investors?kind=auditor");
  expect(button("Auditors")?.getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).toContain("No auditors yet");
  await click(button("Add auditor"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("auditor");
});

// ---- empty view and Carta ----

it("offers Connect Carta and Type it in when nothing is set up, and no table or tabs of holders", async () => {
  rpcMock.servers.mockResolvedValue([]);
  await show();
  expect(button("Connect Carta")).toBeDefined();
  expect(button("Type it in")).toBeDefined();
  expect(container.textContent).not.toContain("See who owns your company");
  expect(container.querySelector("[data-testid=holder-row]")).toBeNull();
});

it("shows Reconnect Carta when the Carta sign-in needs attention", async () => {
  rpcMock.servers.mockResolvedValue([{ ...cartaServer, oauthStatus: "reconnect" }]);
  await show();
  expect(button("Reconnect Carta")).toBeDefined();
});

it("opens the Carta sign-in and tells the shell whether Carta is connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  const status = vi.fn();
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors"]}>
        <InvestorsPage onCartaStatus={status} />
      </MemoryRouter>,
    ),
  );
  await flush();
  expect(status).toHaveBeenLastCalledWith(false);
  await click(button("Connect Carta"));
  expect(button("Sign in with Carta")).toBeDefined();
  rpcMock.servers.mockResolvedValue([cartaServer]);
  await click(button("Cancel"));
  await flush();
  expect(status).toHaveBeenLastCalledWith(true);
});

it("shows an error with Try again when the Carta connection check fails", async () => {
  rpcMock.servers.mockRejectedValueOnce(new Error("offline"));
  await show();
  expect(container.textContent).toContain("Could not check whether Carta is connected.");
  expect(button("Connect Carta")).toBeUndefined();
  await click(button("Try again"));
  await flush();
  expect(container.textContent).not.toContain("Could not check");
});

it("shows a skeleton, not the contacts layout, until the Carta check ends", async () => {
  rpcMock.servers.mockReturnValue(new Promise(() => {}));
  await show();
  expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
  expect(container.querySelector("[role=tablist]")).toBeNull();
});

it("offers to read the cap table when Carta is connected but nothing was read", async () => {
  rpcMock.refresh.mockRejectedValueOnce(new Error("Add a model before refreshing"));
  await show();
  await click(button("Read cap table"));
  await flush();
  expect(rpcMock.refresh).toHaveBeenCalled();
  expect(container.textContent).toContain("Add a model before refreshing");
  expect(button("Type it in")).toBeDefined();
});

it("offers Add a model and opens Models settings when none is set up", async () => {
  const onOpenModelSettings = vi.fn();
  await show("/app/investors", { onOpenModelSettings, needsModel: true });
  expect(button("Read cap table")).toBeUndefined();
  await click(button("Add a model"));
  expect(onOpenModelSettings).toHaveBeenCalled();
});

it("shows Reading Carta while the first snapshot is syncing", async () => {
  rpcMock.capTable.mockResolvedValue(state(null, true));
  await show();
  expect(container.textContent).toContain("Reading Carta…");
});

it("shows no Carta table when Carta is not connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.capTable.mockResolvedValue(state(carta));
  await show();
  expect(container.textContent).not.toContain("Ada Example");
  expect(button("Connect Carta")).toBeDefined();
});

it("reloads contacts when a sync finishes", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValue(state(null, true));
  await show();
  expect(rpcMock.list).toHaveBeenCalledTimes(1);
  rpcMock.capTable.mockResolvedValue(state(null));
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(rpcMock.list).toHaveBeenCalledTimes(2);
});

it("shows a retry when the cap table cannot be read, and stops polling", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValueOnce(state(null, true));
  await show();
  rpcMock.capTable.mockRejectedValue(new Error("down"));
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(container.textContent).toContain("Could not load the cap table");
  const calls = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(rpcMock.capTable.mock.calls.length).toBe(calls);
  rpcMock.capTable.mockResolvedValue(state(null));
  await click(button("Try again"));
  expect(container.textContent).not.toContain("Could not load the cap table");
});

it("picks up a run started elsewhere on focus and on a slow background check", async () => {
  vi.useFakeTimers();
  await show();
  const initial = rpcMock.capTable.mock.calls.length;
  await act(async () => void window.dispatchEvent(new Event("focus")));
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(initial);
  rpcMock.capTable.mockResolvedValue(state(null, true));
  await act(async () => vi.advanceTimersByTimeAsync(30_100));
  expect(container.textContent).toContain("Reading Carta…");
});

it("reloads contacts and the cap table when the agent finishes a chat turn", async () => {
  const render = (agentBusy: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/app/investors"]}>
          <InvestorsPage agentBusy={agentBusy} />
        </MemoryRouter>,
      ),
    );
  await render(true);
  await flush();
  rpcMock.list.mockResolvedValue([contact("c3", "Dana", "investor")]);
  const capReads = rpcMock.capTable.mock.calls.length;
  await render(false);
  await flush();
  expect(container.textContent).toContain("Dana");
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(capReads);
});

// ---- a Carta table ----

it("shows the figures, source line and holdings of a Carta table; SAFEs sit outside the percentages", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  await show();
  const text = container.textContent ?? "";
  expect(text).toContain("Carta · as of Oct 1");
  expect(text).toContain("Fully diluted1,000409A $1.25");
  // Equity raised excludes the SAFE's $250,000.
  expect(text).toContain("Equity raised$500,000");
  const rows = [...container.querySelectorAll("table tbody tr")].map((r) => r.textContent ?? "");
  const ada = rows.find((r) => r.includes("Ada Example")) ?? "";
  const founder = rows.find((r) => r.includes("Founder Example")) ?? "";
  const pool = rows.find((r) => r.includes("Unallocated pool")) ?? "";
  const safe = rows.find((r) => r.includes("Dee Newcomer")) ?? "";
  expect(ada).toContain("30.0%");
  expect(founder).toContain("60.0%");
  expect(pool).toContain("10.0%");
  expect(safe).toContain("$250,000");
  expect(safe).toContain("—");
  expect(safe).not.toContain("%");
});

it("shows a dash for Equity raised when only SAFEs have amounts", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({
      ...carta,
      holders: carta.holders.map((h) => ({ ...h, amountUsd: h.security === "SAFE" ? 1 : null })),
    }),
  );
  await show();
  expect(container.textContent).toContain("Equity raised—");
});

it("shows no percentages when the rows do not add up to the source's total", async () => {
  rpcMock.capTable.mockResolvedValue(state({ ...carta, fullyDilutedShares: 5000 }));
  await show();
  const rows = [...container.querySelectorAll("table tbody tr")].map((r) => r.textContent ?? "");
  expect(rows.some((r) => r.includes("%"))).toBe(false);
  expect(container.textContent).toContain("5,000");
});

it("refreshes from the source menu and polls until syncing stops", async () => {
  vi.useFakeTimers();
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  rpcMock.capTable.mockResolvedValue(state(carta, true));
  await openSourceMenu();
  await click(menuItem("Refresh"));
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Reading Carta…");
  const before = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(3100));
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(before);
  rpcMock.capTable.mockResolvedValue(state(carta));
  await act(async () => vi.advanceTimersByTimeAsync(3100));
  const settled = rpcMock.capTable.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  expect(rpcMock.capTable.mock.calls.length).toBe(settled);
});

it("offers Add a model, not Try again, when a refresh fails for want of a model", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.refresh.mockRejectedValue(new Error("Add a model before refreshing"));
  const onOpenModelSettings = vi.fn();
  await show("/app/investors", { onOpenModelSettings, needsModel: true });
  await openSourceMenu();
  await click(menuItem("Refresh"));
  await flush();
  expect(container.textContent).toContain("Add a model before refreshing");
  await click(button("Add a model"));
  expect(onOpenModelSettings).toHaveBeenCalled();
});

it("opens a holder's contact, or adds the holder as a contact", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  await show();
  await click(rowActions("Ada Example"));
  await click(menuItem("Open contact"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada");
  await click(button("Cancel"));
  await click(rowActions("Founder Example"));
  await click(menuItem("Add as contact"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe(
    "Founder Example",
  );
  // The Carta-only hint shows while the source is Carta.
  await click(button("Cancel"));
});

it("hides dollar amounts but keeps shares and percentages, and flips back live", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  setHideAmounts(true);
  await show();
  const text = container.textContent ?? "";
  expect(text).not.toContain("500,000");
  expect(text).toContain("30.0%");
  expect(text).toContain("$•••");
  await act(async () => setHideAmounts(false));
  expect(container.textContent).toContain("500,000");
});

// ---- the typed-in table ----

it("Type it in creates the typed-in table from the empty view", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.changeSource.mockResolvedValue(state({ ...typed, holders: [] }));
  await show();
  await click(button("Type it in"));
  expect(rpcMock.changeSource).toHaveBeenCalledWith({ source: "native", sourceRef: null });
  expect(container.querySelectorAll("[data-testid=holder-row]")).toHaveLength(1);
  expect(container.textContent).toContain("Typed in · as of Oct 1");
});

it("edits a holder, saves on blur with the version it was loaded from, and shows Saved", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.capTableSave.mockImplementation(async ({ table }) =>
    state({ ...typed, ...table, source: "native", updatedAt: "2026-10-15T10:05:00.000Z" }),
  );
  await show();
  expect(field("shares", 0).value).toBe("300");
  await enter(field("shares", 0), "400");
  await blur(field("shares", 0));
  expect(rpcMock.capTableSave).toHaveBeenCalledTimes(1);
  const [{ table, updatedAt }] = rpcMock.capTableSave.mock.calls[0] as [
    { table: Record<string, unknown> & { holders: { shares: number }[] }; updatedAt: string },
  ];
  expect(updatedAt).toBe("2026-10-15T10:00:00.000Z");
  expect(table.holders[0]?.shares).toBe(400);
  expect(table.fullyDilutedShares).toBe(400 + 600 + 100);
  expect(container.textContent).toContain("Saved");
  // A blur with nothing changed does not save again.
  await blur(field("shares", 0));
  expect(rpcMock.capTableSave).toHaveBeenCalledTimes(1);
});

it("adds a holder in the blank row and keeps one blank row at the bottom", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.capTableSave.mockImplementation(async ({ table }) =>
    state({ ...typed, ...table, source: "native", updatedAt: "2026-10-15T10:05:00.000Z" }),
  );
  await show();
  expect(container.querySelectorAll("[data-testid=holder-row]")).toHaveLength(3);
  const last = field("name", 2);
  await enter(last, "New Holder");
  await blur(last);
  expect(container.querySelectorAll("[data-testid=holder-row]")).toHaveLength(4);
  const sent = rpcMock.capTableSave.mock.calls[0]?.[0].table.holders;
  expect(sent).toHaveLength(3);
  expect(sent[2]).toMatchObject({ name: "New Holder", security: "Common", shares: null });
});

it("outlines a negative number and does not save it", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  await show();
  await enter(field("shares", 0), "-5");
  await blur(field("shares", 0));
  expect(rpcMock.capTableSave).not.toHaveBeenCalled();
  expect(field("shares", 0).getAttribute("aria-invalid")).toBe("true");
  expect(container.textContent).toContain("Not saved");
  await enter(field("invested", 0), "-1");
  await blur(field("invested", 0));
  expect(field("invested", 0).getAttribute("aria-invalid")).toBe("true");
});

it("keeps the typed rows on a failed save, and Retry saves them", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.capTableSave.mockRejectedValueOnce(new Error("offline"));
  rpcMock.capTableSave.mockImplementation(async ({ table }) =>
    state({ ...typed, ...table, source: "native", updatedAt: "2026-10-15T10:05:00.000Z" }),
  );
  await show();
  await enter(field("shares", 0), "450");
  await blur(field("shares", 0));
  expect(container.textContent).toContain("Not saved");
  expect(field("shares", 0).value).toBe("450");
  await click(button("Retry"));
  expect(rpcMock.capTableSave).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Saved");
  expect(container.textContent).not.toContain("Not saved");
  expect(field("shares", 0).value).toBe("450");
});

it("reloads a table that changed elsewhere and says so", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  await show();
  const newer = {
    ...typed,
    updatedAt: "2026-10-15T10:09:00.000Z",
    holders: [{ ...typed.holders[0], shares: 777 }, typed.holders[1]],
  };
  rpcMock.capTableSave.mockRejectedValue(
    Object.assign(new Error("conflict"), { code: "CONFLICT" }),
  );
  rpcMock.capTable.mockResolvedValue(state(newer));
  await enter(field("shares", 0), "400");
  await blur(field("shares", 0));
  expect(container.textContent).toContain("Changed elsewhere");
  expect(field("shares", 0).value).toBe("777");
});

it("deletes a holder from the row menu and saves the rest", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.capTableSave.mockImplementation(async ({ table }) =>
    state({ ...typed, ...table, source: "native", updatedAt: "2026-10-15T10:05:00.000Z" }),
  );
  await show();
  await click(rowActions("Ada Example"));
  await click(menuItem("Delete holder"));
  await flush();
  expect(
    rpcMock.capTableSave.mock.calls[0]?.[0].table.holders.map((h: { name: string }) => h.name),
  ).toEqual(["Founder Example"]);
  expect(container.textContent).not.toContain("Ada Example");
  // The pool is not a holder: it has no menu.
  expect(rowActions("Unallocated pool")).toBeUndefined();
});

it("sums the typed-in percentages to 100.0 with the pool, and SAFE rows stay outside", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({
      ...typed,
      holders: [...typed.holders, { ...carta.holders[2], id: "r2" }],
    }),
  );
  await show();
  const percents = [...container.querySelectorAll("[data-testid=holder-row] span.tabular-nums")]
    .map((el) => el.textContent)
    .filter((text) => text && /%|—/.test(text));
  expect(percents).toEqual(["30.0%", "60.0%", "—"]);
  expect(container.textContent).toContain("10.0%");
});

// ---- source line ----

it("changes the source at once and keeps one Undo", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.changeSource.mockImplementation(async () => {
    rpcMock.capTable.mockResolvedValue(state({ ...carta, canUndo: true }));
    return state({ ...carta, canUndo: true });
  });
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  await openSourceMenu();
  expect(menuItem("Undo")).toBeUndefined();
  expect(menuItem("Refresh")).toBeUndefined();
  await click(document.querySelector<HTMLElement>("[role=menuitem][aria-haspopup]") ?? undefined);
  await click(menuItem("Carta"));
  await flush();
  expect(rpcMock.changeSource).toHaveBeenCalledWith({ source: "carta", sourceRef: null });
  // Back on Carta the table is read again.
  expect(rpcMock.refresh).toHaveBeenCalled();
  rpcMock.undoSource.mockImplementation(async () => {
    rpcMock.capTable.mockResolvedValue(state(typed));
    return state(typed);
  });
  await openSourceMenu();
  await click(menuItem("Undo"));
  expect(rpcMock.undoSource).toHaveBeenCalled();
  await openSourceMenu();
  expect(menuItem("Undo")).toBeUndefined();
});

// ---- documents ----

const folder = (id: string, name: string, parentId: string | null) => ({
  id,
  name,
  parentId,
  createdAt: "2026-10-01T00:00:00.000Z",
});
const capFolders = [folder("fin", "Finance", null), folder("cap", "Cap Table", "fin")];
const doc = (id: string, name: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 1000,
  folderId: "cap",
  source: "upload",
  sourceUrl: null,
  status: "ready",
  error: null,
  facets: {
    docType: "contract",
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-10T00:00:00.000Z",
});

it("lists the Finance / Cap Table documents and opens one in the Data room preview", async () => {
  rpcMock.folders.mockResolvedValue(capFolders);
  rpcMock.items.mockResolvedValue({ items: [doc("d1", "Option plan.pdf")], nextCursor: null });
  await show();
  expect(rpcMock.items).toHaveBeenCalledWith(expect.objectContaining({ folderId: "cap" }));
  const link = [...document.querySelectorAll("a")].find((a) => a.textContent === "Option plan.pdf");
  expect(link?.getAttribute("href")).toBe("/app/data-room?item=d1");
});

it("shows no Documents section when the folder is missing or empty", async () => {
  await show();
  expect(container.textContent).not.toContain("Documents");
});
