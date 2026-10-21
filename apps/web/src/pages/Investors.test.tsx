// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    carta: { capTable: rpcMock.capTable, refresh: rpcMock.refresh },
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
import { InvestorsPage, rowKind } from "./Investors";

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

it("lists contacts and filters by kind", async () => {
  await show();
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
  expect(container.querySelector('table[data-slot="table"]')).not.toBeNull();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).toContain("Bo");
  await click(button("Auditors"));
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("Bo");
});

it("adds a contact through the dialog and shows a server error", async () => {
  rpcMock.save.mockRejectedValueOnce(new Error("Email already used"));
  await show("/app/investors?kind=other");
  await click(button("Add contact"));
  const name = document.getElementById("contact-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "Cy");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(expect.objectContaining({ name: "Cy", kind: "other" }));
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

it("Ask opens the Investors agent whether or not Carta is connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  const onShowAgent = vi.fn();
  await show("/app/investors", { onShowAgent });
  expect(button("Connect Carta")).toBeDefined();
  const ask = container.querySelector('[aria-label="Ask Investors agent"]') as HTMLElement;
  expect(ask).not.toBeNull();
  expect(container.querySelector('[aria-label="Ask Carta agent"]')).toBeNull();
  await click(ask);
  expect(onShowAgent).toHaveBeenCalledTimes(1);
});

it("shows Reconnect Carta when the Carta sign-in needs attention", async () => {
  rpcMock.servers.mockResolvedValue([{ ...cartaServer, oauthStatus: "reconnect" }]);
  await show();
  expect(container.textContent).toContain("Sign in to Carta again");
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
  // Two saves start two reloads; the first reload is still pending when the second answers.
  for (const name of ["Cy", "Di"]) {
    await click(button("Add investor"));
    await typeInto("contact-name", name);
    await click(button("Save"));
  }
  expect(container.textContent).toContain("Newer");
  await act(async () => resolveStale([contact("c1", "Stale", "investor")]));
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
    { name: "Common", shares: 6_000_000, percent: 60 },
    { name: "Options", shares: 1_000_000, percent: 10 },
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
  // The 409A figure is named for what it is, with the term explained underneath.
  expect(text).toContain("Common share price$1.25From the latest 409A valuation");
  expect(text).toContain("Series Seed Preferred");
  expect(text).toContain("60.00%");
  expect(text).toContain("1,000,000");
  expect(text).toContain("10.00%");
  expect(text).toContain("Example Ventures");
  // amount raised is null; a SAFE has no shares, so its holder is not under All
  expect(text).not.toContain("Dee Newcomer");
  await click(button("Investors"));
  const investors = container.querySelector("table:not(.sr-only)");
  const header = [...(investors?.querySelectorAll("th") ?? [])].map((th) => th.textContent);
  expect(header).toContain("Amount");
  expect(investors?.textContent).toContain("Dee Newcomer");
  expect(investors?.textContent).toContain("$250,000");
  await click(button("All"));
  // Bo is a contact with no holding: not under All, but under their own tab and in a search.
  expect(container.querySelector("table:not(.sr-only)")?.textContent).not.toContain("Bo");
  await click(button("Auditors"));
  expect(container.querySelector("table:not(.sr-only)")?.textContent).toContain("Bo");
});

it("shows a skeleton, not the contacts-only layout, until the cap table has loaded", async () => {
  let resolve: (value: unknown) => void = () => {};
  rpcMock.capTable.mockReturnValue(new Promise((r) => (resolve = r)));
  await show();
  expect(container.querySelector("[role=tablist]")).toBeNull();
  expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
  await act(async () => resolve({ snapshot, syncing: false }));
  expect(container.querySelector("[role=tablist]")).not.toBeNull();
  expect(container.querySelector("[aria-busy=true]")).toBeNull();
});

it("says contacts do not change Carta only for a contact that is on the cap table", async () => {
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "investor"),
    contact("c2", "Bo", "auditor"),
  ]);
  rpcMock.capTable.mockResolvedValue({
    snapshot: { ...snapshot, holders: [{ ...snapshot.holders[0], email: "ada@example.test" }] },
    syncing: false,
  });
  await show();
  const open = (name: string) =>
    click(
      [...container.querySelectorAll<HTMLElement>("tbody button")].find(
        (b) => b.textContent === name,
      ),
    );
  await open("Ada");
  expect(document.body.textContent).toContain("do not change Carta");
  await click(button("Cancel"));
  await click(button("Auditors"));
  await open("Bo");
  expect(document.body.textContent).not.toContain("do not change Carta");
});

it("lists the unallocated option pool as a row so the Ownership column adds up", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const row = [...container.querySelectorAll("tr")].find((tr) =>
    tr.textContent?.includes("Unallocated pool"),
  );
  expect(row?.textContent).toContain("500,000");
  expect(row?.textContent).toContain("5.00%");
});

it("puts the unallocated pool right after the granted options", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      holders: [
        {
          name: "Granted options",
          email: null,
          organization: null,
          security: "Options",
          shares: 900_000,
          amountUsd: null,
          percent: 9,
        },
        { ...snapshot.holders[0] },
      ],
    },
    syncing: false,
  });
  await show();
  const names = [...container.querySelectorAll("table:not(.sr-only) tbody tr")].map(
    (tr) => tr.querySelector("td")?.textContent ?? "",
  );
  const at = (name: string) => names.findIndex((n) => n.startsWith(name));
  expect(at("Unallocated pool")).toBe(at("Granted options") + 1);
});

it("shows Ownership in the same font as the other figures", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const cells = [...container.querySelectorAll("table:not(.sr-only) tbody td")].filter((td) =>
    td.textContent?.includes("10.00%"),
  );
  expect(cells).toHaveLength(1);
  expect(cells[0]?.className).not.toContain("font-mono");
});

it("offers Add email for a holder without a contact and prefills the dialog", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show("/app/investors?kind=investor");
  const add = [
    ...container.querySelectorAll<HTMLButtonElement>("[data-testid=cap-table-email-cell] button"),
  ].filter((b) => b.textContent === "Add email");
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

it("offers to open the contact that already has the email when adding a duplicate", async () => {
  rpcMock.save.mockRejectedValueOnce(new Error("Another contact already has this email."));
  await show("/app/investors?kind=other");
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
  await show();
  await click(button("Bo"));
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
  await show();
  await click(button("Bo"));
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await click(button("Delete"));
  expect(container.querySelector('[data-contact-id="c2"]')).toBeNull();
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor"), { ...bo, id: "c9" }]);
  await click(button("Undo"));
  const row = container.querySelector('[data-contact-id="c9"]');
  expect(row).not.toBeNull();
  expect(document.activeElement).toBe(row?.querySelector("[data-row-open]"));
});

it("keeps the Deleted toast with Undo until it is dismissed", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show();
  await click(button("Bo"));
  await click(button("Delete"));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(document.body.textContent).toContain("Deleted Bo");
  expect(button("Undo")).toBeDefined();
  await click(document.querySelector<HTMLElement>('button[aria-label="Dismiss"]') ?? undefined);
  expect(document.body.textContent).not.toContain("Deleted Bo");
});

it("keeps the contact restorable when Undo fails, and restores it on Try again", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
  await show();
  await click(button("Bo"));
  await click(button("Delete"));
  await click(button("Undo"));
  // The failure names the contact and offers to try again.
  expect(document.body.textContent).toContain("Could not restore Bo");
  expect(button("Undo")).toBeUndefined();
  await click(button("Try again"));
  expect(rpcMock.save).toHaveBeenCalledTimes(2);
  expect(rpcMock.save).toHaveBeenLastCalledWith({
    name: "Bo",
    email: "bo@example.test",
    organization: null,
    kind: "auditor",
    notes: null,
  });
  expect(document.body.textContent).not.toContain("Could not restore Bo");
  expect(document.body.textContent).toContain("Restored Bo");
});

it("confirms a save and closes the dialog with Cancel", async () => {
  rpcMock.save.mockResolvedValue(contact("c3", "Cy", "investor"));
  await show("/app/investors?kind=other");
  await click(button("Add contact"));
  await click(button("Cancel"));
  expect(document.getElementById("contact-name")).toBeNull();
  expect(rpcMock.save).not.toHaveBeenCalled();
  await click(button("Add contact"));
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  // The toast names the contact and floats over the page, so showing it never moves the rows.
  const status = document.querySelector("[role=status]") as HTMLElement;
  expect(status.textContent).toContain("Saved Cy");
  expect(status.closest(".fixed")).not.toBeNull();
});

it("scrolls the saved contact into view and marks its row", async () => {
  const saved = contact("c3", "Cy", "investor");
  rpcMock.save.mockResolvedValue(saved);
  const scrolled: Element[] = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  rpcMock.list.mockResolvedValue([]);
  await show("/app/investors?kind=investor");
  rpcMock.list.mockResolvedValue([saved]);
  await click(button("Add investor"));
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  await flush();
  const row = container.querySelector('[data-contact-id="c3"]') as HTMLElement;
  expect(scrolled).toContain(row);
  expect(row.className).toContain("bg-accent");
});

it("reads the kind filter from the URL and names the kind when it is empty", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await show("/app/investors?kind=auditor");
  expect(button("Auditors")?.getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("No auditors yet");
  await click(button("Add auditor"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("auditor");
});

it("explains where ownership comes from when Carta is not connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  await show();
  expect(container.textContent).toContain("See who owns your company");
  // A founder new to Carta learns what it is, and that the page works without it.
  expect(container.textContent).toContain("Carta is the service many startups use");
  // Nothing else competes with the prompt: no tabs, search, table or Add contact.
  expect(container.querySelector("[role=tablist]")).toBeNull();
  expect(container.querySelector("input[type=search]")).toBeNull();
  expect(container.textContent).not.toContain("Add contact");
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.servers.mockResolvedValue([{ ...cartaServer, oauthStatus: "reconnect" }]);
  await show();
  expect(container.textContent).toContain("Sign in to Carta again");
});

const holder = (name: string, security: string, shares: number | null, percent: number | null) => ({
  name,
  email: null,
  organization: null,
  security,
  shares,
  amountUsd: shares == null ? 50_000 : null,
  percent,
});

it("files founders and option grants apart from investors", () => {
  expect(rowKind({ contact: null, holder: holder("Founder", "Common", 4, 40) })).toBe(
    "shareholder",
  );
  expect(rowKind({ contact: null, holder: holder("Granted", "Options", 9, 9) })).toBe("options");
  expect(rowKind({ contact: null, holder: holder("Angel", "SAFE", null, null) })).toBe("investor");
  expect(rowKind({ contact: contact("c9", "Bo", "auditor"), holder: null })).toBe("auditor");
});

it("lists only investors on the Investors tab and offers Add email only to investors", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      holders: [
        holder("Founder Person", "Common", 4_000_000, 40),
        holder("Granted options", "Options", 900_000, 9),
        holder("Angel Person", "SAFE", null, null),
      ],
    },
    syncing: false,
  });
  await show("/app/investors?kind=investor");
  const text = container.textContent ?? "";
  expect(text).toContain("Angel Person");
  expect(text).toContain("Ada");
  expect(text).not.toContain("Founder Person");
  expect(text).not.toContain("Granted options");
  const adds = [
    ...container.querySelectorAll<HTMLButtonElement>("[data-testid=cap-table-email-cell] button"),
  ].filter((b) => b.textContent === "Add email");
  expect(adds).toHaveLength(1);
  await click(button("All"));
  expect(container.textContent).toContain("Founder Person");
  // A contact with no holding shows the table's dash in Ownership, hidden on phones where cards stay blank.
  await click(button("Auditors"));
  const rows = [...container.querySelectorAll("table:not(.sr-only) tbody tr")];
  const bo = rows.find((row) => row.textContent?.includes("Bo"));
  const cell = bo?.querySelectorAll("td")[4];
  expect(cell?.textContent).toBe("—");
  expect(cell?.querySelector("span")?.className).toContain("hidden");
});

it("keeps the Kind column with or without Carta", async () => {
  await show();
  const headers = () =>
    [...container.querySelectorAll("table:not(.sr-only) th")].map((th) => th.textContent);
  expect(headers()).toEqual(["Name", "Email", "Kind"]);
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  expect(headers()).toEqual(["Name", "Email", "Kind", "Shares", "Ownership"]);
});

it("adds a contact of the open tab's kind from an empty tab, and has no Add button in the header", async () => {
  rpcMock.list.mockResolvedValue([]);
  await show("/app/investors?kind=other");
  expect(container.querySelector("[data-page-header]")?.textContent).not.toContain("Add");
  await click(button("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("other");
  await click(button("Cancel"));
  await click(button("Auditors"));
  await click(button("Add auditor"));
  expect(document.body.textContent).toContain("Add auditor");
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("auditor");
});

it("opens the Carta sign-in on Cap Table and tells the shell whether Carta is connected", async () => {
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

it("hides dollar amounts but keeps shares and ownership in place while amounts are hidden, and flips back live", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  setHideAmounts(true);
  await show();
  const text = container.textContent ?? "";
  expect(text).not.toContain("1.25");
  // Share counts and ownership are not money: the rows stay readable for a screen share.
  for (const shown of ["10,000,000", "1,000,000", "10.00%", "60.00%"])
    expect(text).toContain(shown);
  expect(text).toContain("Example Ventures");
  await click(button("Investors"));
  expect(container.textContent).toContain("$•••");
  expect(container.textContent).not.toContain("250,000");
  await act(async () => setHideAmounts(false));
  expect(container.textContent).toContain("250,000");
});

it("repeats each email under the name, for phones where the Email column is hidden", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show("/app/investors?kind=investor");
  const under = [...container.querySelectorAll("[data-testid=cap-table-row-email]")].map(
    (cell) => cell.textContent,
  );
  expect(under).toContain("ada@example.test");
  // A holder with no contact gets Add email there too, so phones can still add one.
  expect(under).toContain("Add email");
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
  expect(container.textContent).not.toContain("Dana");
  rpcMock.list.mockResolvedValue([contact("c3", "Dana", "investor")]);
  const capReads = rpcMock.capTable.mock.calls.length;
  await render(false);
  await flush();
  expect(container.textContent).toContain("Dana");
  expect(rpcMock.capTable.mock.calls.length).toBeGreaterThan(capReads);
});

it("shows an error with Try again when the Carta connection check fails", async () => {
  rpcMock.servers.mockRejectedValueOnce(new Error("offline"));
  await show();
  const text = container.textContent ?? "";
  expect(text).toContain("Could not check whether Carta is connected.");
  // Not assumed connected, and not offered a new connection either.
  expect(container.querySelector('[aria-label="Refresh from Carta"]')).toBeNull();
  expect(text).not.toContain("Connect Carta");
  await click(button("Try again"));
  await flush();
  expect(container.textContent).not.toContain("Could not check");
  expect(container.querySelector('[aria-label="Refresh from Carta"]')).not.toBeNull();
});

it("offers to read the cap table when Carta is connected but nothing was read", async () => {
  rpcMock.refresh.mockRejectedValueOnce(new Error("Add a model before refreshing"));
  await show();
  expect(container.textContent).toContain("has not read your cap table yet");
  await click(button("Read cap table"));
  await flush();
  expect(rpcMock.refresh).toHaveBeenCalled();
  expect(container.textContent).toContain("Add a model before refreshing");
});

it("says a model is needed and opens Models settings when none is set up", async () => {
  const onOpenModelSettings = vi.fn();
  await show("/app/investors", { onOpenModelSettings, needsModel: true });
  await flush();
  expect(container.textContent).toContain("needs a model before it can read your cap table");
  expect(button("Read cap table")).toBeUndefined();
  // Refresh cannot start without a model, so the header does not offer it.
  expect(container.querySelector('[aria-label="Refresh from Carta"]')).toBeNull();
  await click(button("Add a model"));
  expect(onOpenModelSettings).toHaveBeenCalled();
});

it("offers Add a model, not Try again, when a refresh fails for want of a model", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  rpcMock.refresh.mockRejectedValue(new Error("Add a model before refreshing"));
  const onOpenModelSettings = vi.fn();
  await show("/app/investors", { onOpenModelSettings, needsModel: true });
  await click(container.querySelector('[aria-label="Refresh from Carta"]') as HTMLElement);
  await flush();
  expect(container.textContent).toContain("Add a model before refreshing");
  expect(button("Try again")).toBeUndefined();
  await click(button("Add a model"));
  expect(onOpenModelSettings).toHaveBeenCalled();
});

it("says Reading Carta instead of an update time while a refresh runs", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: true });
  await show();
  expect(container.textContent).toContain("Example Co· Reading Carta…");
  expect(container.textContent).not.toContain("Updated");
});

it("filters Carta's shareholders and option grants on their own tabs", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      holders: [
        holder("Founder Person", "Common", 4_000_000, 40),
        holder("Granted options", "Options", 900_000, 9),
        holder("Angel Person", "SAFE", null, null),
      ],
    },
    syncing: false,
  });
  await show("/app/investors?kind=shareholder");
  expect(container.textContent).toContain("Founder Person");
  expect(container.textContent).not.toContain("Granted options");
  expect(container.textContent).not.toContain("Angel Person");
  await click(button("Options"));
  expect(container.textContent).toContain("Granted options");
  expect(container.textContent).not.toContain("Founder Person");
});

it("lists only investors, auditors and other contacts, plus holders joined from Carta", async () => {
  const joined = { ...holder("Joined Holder", "Common", 100, 1), email: "carol@example.test" };
  rpcMock.list.mockResolvedValue([
    contact("c1", "Ada", "investor"),
    contact("c2", "Bo", "vendor"),
    contact("c3", "Cy", "legal"),
    contact("c4", "Carol", "customer"),
  ]);
  rpcMock.capTable.mockResolvedValue({
    snapshot: { ...snapshot, holders: [joined] },
    syncing: false,
  });
  await show("/app/investors?kind=investor");
  const rows = container.querySelector("table:not(.sr-only) tbody")?.textContent ?? "";
  expect(rows).toContain("Ada");
  expect(rows).not.toContain("Bo");
  expect(rows).not.toContain("Cy");
  await click(button("All"));
  expect(container.querySelector("table:not(.sr-only) tbody")?.textContent).toContain("Carol");
});

it("keeps an option grant on Options when a contact with the holder's email is Other", async () => {
  const granted = { ...holder("Granted options", "Options", 900_000, 9), email: "bo@example.test" };
  rpcMock.list.mockResolvedValue([contact("c2", "Bo", "other")]);
  rpcMock.capTable.mockResolvedValue({
    snapshot: { ...snapshot, holders: [granted] },
    syncing: false,
  });
  await show("/app/investors?kind=options");
  expect(container.textContent).not.toContain("No option grants in Carta");
  expect(container.querySelector("table:not(.sr-only) tbody")?.textContent).toContain("Bo");
});

it("shows All and drops ?kind when its tab is missing without a cap table", async () => {
  let search = "";
  const Where = () => {
    search = useLocation().search;
    return null;
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors?kind=options"]}>
        <InvestorsPage />
        <Where />
      </MemoryRouter>,
    ),
  );
  await flush();
  expect(search).toBe("");
  expect(container.textContent).not.toContain("No option grants in Carta");
  expect(container.textContent).toContain("Ada");
});

it("has no Shareholders or Options tab without a cap table", async () => {
  await show();
  expect(button("Shareholders")).toBeUndefined();
  expect(button("Options")).toBeUndefined();
});

it("shows a holder's Carta email and offers Save as contact instead of Add email", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      holders: [{ ...holder("Priya Holder", "SAFE", null, null), email: "priya@fund.test" }],
    },
    syncing: false,
  });
  await show("/app/investors?kind=investor");
  const row = [...container.querySelectorAll("table:not(.sr-only) tbody tr")].find((r) =>
    r.textContent?.includes("Priya Holder"),
  );
  expect(row?.textContent).toContain("priya@fund.test");
  expect(row?.textContent).toContain("Save as contact");
  expect(row?.textContent).not.toContain("Add email");
  await click(button("Save as contact"));
  expect(document.body.textContent).toContain("Save Priya Holder as a contact");
});

it("has one ownership chart: no stacked bar, true split while amounts are hidden", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  setHideAmounts(true);
  await show();
  expect(container.querySelector("[data-testid=ownership-bar]")).toBeNull();
});

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
  rpcMock.folders.mockResolvedValue(capFolders);
  await show();
  expect(container.textContent).not.toContain("Documents");
});

it("leaves importing files to the Data room: the header has no Import or Add files", async () => {
  await show();
  const labels = [...container.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels).not.toContain("Import");
  expect(labels).not.toContain("Add files");
});

it("shows a skeleton, not the contacts layout, until the Carta check ends", async () => {
  rpcMock.servers.mockReturnValue(new Promise(() => {}));
  await show();
  expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
  expect(container.querySelector("[role=tablist]")).toBeNull();
  expect(container.querySelector("table")).toBeNull();
});

describe("search, filter and sort", () => {
  const holder = (
    name: string,
    security: string,
    shares: number | null,
    percent: number | null,
    amountUsd: number | null,
    extra: { email?: string | null; organization?: string | null } = {},
  ) => ({
    name,
    email: extra.email ?? null,
    organization: extra.organization ?? null,
    security,
    shares,
    amountUsd,
    percent,
  });
  // Numbers chosen so a text sort gets them wrong: "9" sorts after "10" as text.
  const sortable = {
    ...snapshot,
    optionPoolAvailable: null,
    holders: [
      holder("Nine", "Common", 900, 9, null, { email: "nine@zeta.test", organization: "Acme Co" }),
      holder("Ten", "Common", 1_000_000, 10, null),
      holder("Two", "Series Seed Preferred", 20_000, 2, null, { organization: "Birch Fund" }),
      holder("Safe Nine", "SAFE", null, null, 9_000),
      holder("Safe Hundred", "SAFE", null, null, 100_000),
    ],
  };
  const rowNames = () =>
    [...container.querySelectorAll("table:not(.sr-only) tbody tr")].map(
      (tr) => tr.querySelector("td")?.firstElementChild?.textContent ?? "",
    );
  const search = () => document.querySelector<HTMLInputElement>("input[name=cap-table-search]");
  const type = async (value: string) => {
    const input = search() as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  let search$ = "";
  function Spy() {
    search$ = useLocation().search;
    return null;
  }
  const showAt = async (url: string) => {
    rpcMock.list.mockResolvedValue([]);
    rpcMock.capTable.mockResolvedValue({ snapshot: sortable, syncing: false });
    await act(async () =>
      root.render(
        <MemoryRouter key={url} initialEntries={[url]}>
          <Spy />
          <InvestorsPage />
        </MemoryRouter>,
      ),
    );
    await flush();
  };

  it("says the SAFEs are left out of the donut and links to them on the Investors tab", async () => {
    await showAt("/app/investors");
    const note = [...container.querySelectorAll("a")].find((a) =>
      a.textContent?.startsWith("SAFEs "),
    );
    expect(note?.textContent).toBe("SAFEs are not in the share counts");
    expect(note?.getAttribute("href")).toBe("/app/investors?kind=investor&security=SAFE");
    // On another tab the overview, and so the note, is gone.
    await showAt("/app/investors?kind=investor");
    expect(
      [...container.querySelectorAll("a")].some((a) => a.textContent?.startsWith("SAFEs ")),
    ).toBe(false);
  });

  it("sorts by ownership, largest first, until another sort is chosen", async () => {
    await showAt("/app/investors");
    expect(rowNames().slice(0, 3)).toEqual(["Ten", "Nine", "Two"]);
  });

  it.each([
    ["percent", "desc", ["Ten", "Nine", "Two"]],
    ["percent", "asc", ["Two", "Nine", "Ten"]],
    ["shares", "desc", ["Ten", "Two", "Nine"]],
    ["shares", "asc", ["Nine", "Two", "Ten"]],
    ["name", "asc", ["Nine", "Ten", "Two"]],
    ["name", "desc", ["Two", "Ten", "Nine"]],
  ])("sorts by %s %s as numbers", async (field, dir, expected) => {
    await showAt(`/app/investors?sort=${field}&dir=${dir}`);
    expect(rowNames()).toEqual(expected);
  });

  // SAFEs have no shares, so they sit on the Investors tab, which shows their Amount.
  it.each([
    ["desc", ["Safe Hundred", "Safe Nine", "Two"]],
    ["asc", ["Safe Nine", "Safe Hundred", "Two"]],
  ])("sorts investors by amount %s, with missing values last", async (dir, expected) => {
    await showAt(`/app/investors?kind=investor&sort=amountUsd&dir=${dir}`);
    expect(rowNames()).toEqual(expected);
  });

  it("sorts by kind", async () => {
    await showAt("/app/investors?sort=kind&dir=asc");
    // Investors (the preferred holder) before Shareholders.
    expect(rowNames()[0]).toBe("Two");
    await showAt("/app/investors?sort=kind&dir=desc");
    expect(rowNames().slice(0, 2).sort()).toEqual(["Nine", "Ten"]);
  });

  it("searches name, company and email", async () => {
    await showAt("/app/investors");
    await type("two");
    expect(rowNames()).toEqual(["Two"]);
    await type("ACME");
    expect(rowNames()).toEqual(["Nine"]);
    await type("zeta.test");
    expect(rowNames()).toEqual(["Nine"]);
    await type("birch");
    expect(rowNames()).toEqual(["Two"]);
  });

  it("filters by security, and shows the filter only with a choice", async () => {
    await showAt("/app/investors?kind=investor&security=SAFE");
    expect(rowNames().sort()).toEqual(["Safe Hundred", "Safe Nine"]);
    expect(button("Security: SAFE")).toBeDefined();
    // A security the rows do not have is ignored.
    await showAt("/app/investors?security=Missing");
    expect(rowNames()).toHaveLength(3);
    // One security means nothing to filter.
    rpcMock.capTable.mockResolvedValue({
      snapshot: { ...sortable, holders: sortable.holders.slice(0, 2) },
      syncing: false,
    });
    await act(async () =>
      root.render(
        <MemoryRouter key="one-security" initialEntries={["/app/investors"]}>
          <InvestorsPage />
        </MemoryRouter>,
      ),
    );
    await flush();
    expect(container.textContent).not.toContain("Security");
  });

  it("titles the card a holder opens for the whole card, not for one field", async () => {
    rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
    await showAt("/app/investors?kind=investor");
    const safe = [...container.querySelectorAll<HTMLElement>("[data-row-open]")].find(
      (b) => b.textContent === "Safe Nine",
    );
    await click(safe);
    expect(document.body.textContent).toContain("Save Safe Nine as a contact");
    expect(document.body.textContent).not.toContain("Add email for");
  });

  it("opens the holder breakdown from the ownership donut", async () => {
    await showAt("/app/investors");
    expect(container.querySelector("[data-testid=ownership-donut]")).not.toBeNull();
    const legend = [...container.querySelectorAll("ul button")].find((b) =>
      b.textContent?.startsWith("Series Seed Preferred"),
    );
    await click(legend as HTMLElement);
    expect(container.querySelector("[data-testid=breakdown]")?.getAttribute("data-open")).toBe(
      "true",
    );
  });

  it("keeps search in the URL and clears it from the empty state", async () => {
    await showAt("/app/investors");
    await type("nobody");
    expect(search$).toContain("q=nobody");
    expect(container.textContent).toContain("No matches");
    await click(button("Clear filters"));
    expect(search$).not.toContain("q=");
    expect(rowNames()).toHaveLength(3);
  });

  it("restores search and sort from a link", async () => {
    await showAt("/app/investors?q=Ten&sort=name&dir=desc");
    expect(search()?.value).toBe("Ten");
    expect(rowNames()).toEqual(["Ten"]);
    expect(button("Sort: Name")).toBeDefined();
  });

  it("flips direction and writes the sort to the URL", async () => {
    await showAt("/app/investors");
    await click(
      document.querySelector<HTMLElement>("button[aria-label='Sort ascending']") ?? undefined,
    );
    expect(search$).toContain("dir=asc");
    expect(search$).toContain("sort=percent");
    expect(rowNames().slice(0, 3)).toEqual(["Two", "Nine", "Ten"]);
  });

  it("sorts by amount while amounts are hidden, without showing them", async () => {
    setHideAmounts(true);
    await showAt("/app/investors?kind=investor&sort=amountUsd&dir=desc");
    expect(rowNames().slice(0, 2)).toEqual(["Safe Hundred", "Safe Nine"]);
    const text = container.textContent ?? "";
    expect(text).not.toContain("100,000");
    expect(text).not.toContain("9,000");
  });
});

it("leaves the donut out when there are only two slices, and keeps the summary in one row", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      shareClasses: [
        { name: "Common", shares: 7_000_000, percent: 70 },
        { name: "Series Seed Preferred", shares: 3_000_000, percent: 30 },
      ],
    },
    syncing: false,
  });
  await show();
  expect(container.querySelector("[data-testid=ownership-donut]")).toBeNull();
  expect(button("Ownership by share class")).toBeUndefined();
  expect(container.textContent).toContain("Fully diluted shares");
});

it("drops the Email column when no row has an address", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: {
      ...snapshot,
      holders: snapshot.holders.map((holder) => ({ ...holder, email: null })),
    },
    syncing: false,
  });
  rpcMock.list.mockResolvedValue([]);
  await show();
  expect(container.querySelector("[data-testid=cap-table-email-cell]")).toBeNull();
  expect(container.textContent).not.toContain("Email");
});

it("keeps the donut behind one row on a phone and says the SAFEs are not in the share counts", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const toggle = button("Ownership by share class") as HTMLElement;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.nextElementSibling?.className).toContain("hidden");
  await click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(toggle.nextElementSibling?.className).not.toContain("hidden");
});

it("opens a contact from its row, and a Carta-only holder opens the card that saves it", async () => {
  rpcMock.capTable.mockResolvedValue({
    snapshot: { ...snapshot, holders: [holder("Carta Only", "Common", 100, 10)] },
    syncing: false,
  });
  await show();
  const carta = [...container.querySelectorAll("table:not(.sr-only) tbody tr")].find((row) =>
    row.textContent?.includes("Carta Only"),
  ) as HTMLElement;
  expect(carta.className).toContain("cursor-pointer");
  await click(carta.querySelector("td") as HTMLElement);
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Carta Only");
  await click(button("Cancel"));
  await click(button("Auditors"));
  const bo = [...container.querySelectorAll("table:not(.sr-only) tbody tr")].find((row) =>
    row.textContent?.includes("Bo"),
  ) as HTMLElement;
  expect(bo.className).toContain("cursor-pointer");
  await click(bo.querySelector("td:nth-child(3)") as HTMLElement);
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Bo");
});
