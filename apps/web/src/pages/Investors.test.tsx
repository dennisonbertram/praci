// @vitest-environment jsdom

import type { AuditRequest, Contact, InvestorUpdate } from "@rakazo/contracts";
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
  linked: vi.fn(
    async (): Promise<{ portal: boolean; documents: string[] }> => ({
      portal: false,
      documents: [],
    }),
  ),
  portalResend: vi.fn(),
  portalRevoke: vi.fn(),
  portalUnblock: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  servers: vi.fn(),
  capTable: vi.fn(),
  refresh: vi.fn(),
  capTableSave: vi.fn(),
  changeSource: vi.fn(),
  undoSource: vi.fn(),
  useSheet: vi.fn(),
  updatesList: vi.fn(),
  updatesSave: vi.fn(),
  updatesRetry: vi.fn(),
  updatesMarkDelivered: vi.fn(),
  updatesDuplicate: vi.fn(),
  updatesDelete: vi.fn(),
  reminder: vi.fn(),
  auditsList: vi.fn(),
  auditsUpdate: vi.fn(),
  auditsDraft: vi.fn(),
  folders: vi.fn(),
  folderCreate: vi.fn(),
  items: vi.fn(),
  connections: vi.fn(),
  catalog: vi.fn(),
  driveList: vi.fn(),
  importDrive: vi.fn(),
  safesList: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: {
      list: rpcMock.list,
      save: rpcMock.save,
      delete: rpcMock.remove,
      linked: rpcMock.linked,
    },
    mcp: { servers: { list: rpcMock.servers } },
    investors: {
      portalResend: rpcMock.portalResend,
      portalRevoke: rpcMock.portalRevoke,
      portalUnblock: rpcMock.portalUnblock,
      capTable: rpcMock.capTable,
      refresh: rpcMock.refresh,
      capTableSave: rpcMock.capTableSave,
      changeSource: rpcMock.changeSource,
      undoSource: rpcMock.undoSource,
      useSheet: rpcMock.useSheet,
      updates: {
        list: rpcMock.updatesList,
        save: rpcMock.updatesSave,
        retry: rpcMock.updatesRetry,
        markDelivered: rpcMock.updatesMarkDelivered,
        duplicate: rpcMock.updatesDuplicate,
        delete: rpcMock.updatesDelete,
      },
      reminder: rpcMock.reminder,
      audits: {
        list: rpcMock.auditsList,
        update: rpcMock.auditsUpdate,
        draft: rpcMock.auditsDraft,
      },
    },
    fundraising: { safes: { list: rpcMock.safesList } },
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
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor"), contact("c2", "Bo", "board")]);
  rpcMock.safesList.mockResolvedValue([]);
  rpcMock.updatesList.mockResolvedValue([]);
  rpcMock.auditsList.mockResolvedValue([]);
  rpcMock.reminder.mockResolvedValue({ cadence: "monthly" });
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

it("lists investors and board members in tabs", async () => {
  await show();
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("bo@example.test");
  await click(button("Board"));
  expect(container.textContent).not.toContain("Ada");
  expect(container.textContent).toContain("bo@example.test");
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
  await show("/app/investors?kind=board");
  await click(button("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("board");
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledWith(expect.objectContaining({ name: "Cy", kind: "board" }));
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

const portalCell = (id: string) =>
  container.querySelector(`[data-contact-id="${id}"] [data-portal-state]`)?.textContent;

it("shows each investor's portal state: none, invited, opened, revoked, unblocked", async () => {
  const dated = (id: string, name: string, portal: Partial<Contact>) => ({
    ...contact(id, name, "investor"),
    ...portal,
  });
  rpcMock.list.mockResolvedValue([
    dated("c1", "Ada", {}),
    dated("c2", "Bo", { portalLinkSentAt: "2026-10-12T10:00:00.000Z" }),
    dated("c3", "Cy", {
      portalLinkSentAt: "2026-10-12T10:00:00.000Z",
      portalLastSeenAt: "2026-10-13T10:00:00.000Z",
    }),
    dated("c4", "Di", {
      portalLinkSentAt: "2026-10-12T10:00:00.000Z",
      portalBlockedAt: "2026-10-14T10:00:00.000Z",
    }),
    dated("c5", "Ed", { portalLastSeenAt: "2026-10-13T10:00:00.000Z" }),
    // A link sent after the last open reads Invited again.
    dated("c6", "Flo", {
      portalLinkSentAt: "2026-10-15T10:00:00.000Z",
      portalLastSeenAt: "2026-10-13T10:00:00.000Z",
    }),
  ]);
  await show();
  expect(portalCell("c1")).toBe("—");
  expect(portalCell("c2")).toBe("Invited Oct 12");
  expect(portalCell("c3")).toBe("Opened Oct 13");
  expect(portalCell("c4")).toBe("Revoked");
  expect(portalCell("c5")).toBe("Unblocked · send a link");
  expect(portalCell("c6")).toBe("Invited Oct 15");
});

it("has no Portal column for the board", async () => {
  await show("/app/investors?kind=board");
  expect(container.querySelector("[data-portal-state]")).toBeNull();
  await click(rowActions("Bo"));
  expect(menuItem("Resend link")).toBeUndefined();
  expect(menuItem("Copy link")).toBeUndefined();
});

it("offers Resend, Copy link and Revoke on an investor with access, and Unblock when revoked", async () => {
  rpcMock.list.mockResolvedValue([
    { ...contact("c1", "Ada", "investor"), portalLinkSentAt: "2026-10-12T10:00:00.000Z" },
    { ...contact("c2", "Bo", "investor"), portalBlockedAt: "2026-10-14T10:00:00.000Z" },
    { ...contact("c3", "Cy", "investor"), email: null },
  ]);
  const again = async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await show();
  };
  await show();
  await click(rowActions("Ada"));
  for (const label of ["Resend link", "Copy link", "Revoke", "Edit", "Delete"])
    expect(menuItem(label)).toBeDefined();
  expect(menuItem("Unblock")).toBeUndefined();
  await again();
  await click(rowActions("Bo"));
  expect(menuItem("Unblock")).toBeDefined();
  for (const label of ["Resend link", "Copy link", "Revoke"])
    expect(menuItem(label)).toBeUndefined();
  await again();
  // No email: a link can still be copied, not sent; a contact never given a link has nothing to revoke.
  await click(rowActions("Cy"));
  expect(menuItem("Resend link")).toBeUndefined();
  expect(menuItem("Copy link")).toBeDefined();
  expect(menuItem("Revoke")).toBeUndefined();
});

it("Resend link emails a fresh link and says so", async () => {
  rpcMock.portalResend.mockResolvedValue({ link: null });
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Resend link"));
  expect(rpcMock.portalResend).toHaveBeenCalledWith({ contactId: "c1", copy: false });
  expect(document.body.textContent).toContain("Link sent to Ada");
});

it("shows the link once when it comes back instead of being emailed", async () => {
  rpcMock.portalResend.mockResolvedValue({ link: "https://app.example.test/portal/open#abc" });
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Copy link"));
  expect(rpcMock.portalResend).toHaveBeenCalledWith({ contactId: "c1", copy: true });
  const input = document.querySelector<HTMLInputElement>("input[readonly]");
  expect(input?.value).toBe("https://app.example.test/portal/open#abc");
});

it("Revoke and Unblock call the portal and reload with no confirmation", async () => {
  rpcMock.list.mockResolvedValue([
    { ...contact("c1", "Ada", "investor"), portalLinkSentAt: "2026-10-12T10:00:00.000Z" },
    { ...contact("c2", "Bo", "investor"), portalBlockedAt: "2026-10-14T10:00:00.000Z" },
  ]);
  rpcMock.portalRevoke.mockResolvedValue({});
  rpcMock.portalUnblock.mockResolvedValue({});
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Revoke"));
  expect(rpcMock.portalRevoke).toHaveBeenCalledWith({ contactId: "c1" });
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  await click(rowActions("Bo"));
  await click(menuItem("Unblock"));
  expect(rpcMock.portalUnblock).toHaveBeenCalledWith({ contactId: "c2" });
});

it("asks before deleting a contact with portal access and gives no Undo for it", async () => {
  rpcMock.linked.mockResolvedValue({ portal: true, documents: ["Deck.pdf"] });
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show();
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
  expect(rpcMock.remove).not.toHaveBeenCalled();
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("Delete Ada?");
  expect(dialog?.textContent).toContain(
    "This also removes their portal access and access to 1 shared document.",
  );
  await click(
    [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Delete") as
      | HTMLElement
      | undefined,
  );
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  expect(document.body.textContent).toContain("Deleted Ada");
  expect(button("Undo")).toBeUndefined();
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
  await show("/app/investors?kind=board");
  await click(openRow("c2"));
  await click(button("Delete"));
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c2" });
  expect(document.body.textContent).toContain("Deleted Bo");
  await click(button("Undo"));
  expect(rpcMock.save).toHaveBeenCalledWith({
    name: "Bo",
    email: "bo@example.test",
    organization: null,
    kind: "board",
    notes: null,
  });
  expect(document.body.textContent).not.toContain("Deleted Bo");
});

it("drops a deleted row and focuses the restored name after Undo, like Contacts", async () => {
  const bo = contact("c2", "Bo", "board");
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockResolvedValue({ ...bo, id: "c9" });
  await show("/app/investors?kind=board");
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
  await show("/app/investors?kind=board");
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
  await show("/app/investors?kind=board");
  expect(button("Board")?.getAttribute("aria-selected")).toBe("true");
  expect(container.querySelector('section[aria-label="Contacts"]')?.textContent).toContain(
    "No contacts yet",
  );
  expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  await click(button("Add contact"));
  expect((document.getElementById("contact-kind") as HTMLSelectElement).value).toBe("board");
});

// ---- empty view and Carta ----

it("shows the empty Cap table, Updates and Contacts as quiet lines, never skeleton bars", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.list.mockResolvedValue([]);
  await show();
  expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  expect(container.querySelector('section[aria-label="Updates"]')?.textContent).toContain(
    "No updates yet",
  );
  expect(container.querySelector('section[aria-label="Contacts"]')?.textContent).toContain(
    "No contacts yet",
  );
  // The Cap table card holds the three source choices.
  const card = container.querySelector('section[aria-label="Cap table"]');
  expect([...(card?.querySelectorAll("button") ?? [])].map((b) => b.textContent)).toEqual([
    "Connect Carta",
    "Use a Google Sheet",
    "Type it in",
  ]);
});

it("has exactly one Add contact entry, in the header", async () => {
  rpcMock.list.mockResolvedValue([]);
  await show();
  const adds = [...container.querySelectorAll("button")].filter(
    (b) => b.textContent === "Add contact",
  );
  expect(adds).toHaveLength(1);
  expect(adds[0]?.closest("[data-page-header]")).not.toBeNull();
});

it("shows the typed-in table with an Add holder row and a labelled pool cell", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({ ...typed, holders: [], fullyDilutedShares: 0, optionPoolAvailable: null }),
  );
  await show();
  const rows = container.querySelectorAll("[data-testid=holder-row]");
  expect(rows).toHaveLength(1);
  expect(rows[0]?.querySelector("textarea")?.getAttribute("placeholder")).toBe("Add holder");
  const pool = container.querySelector<HTMLInputElement>("#pool-shares");
  expect(pool?.placeholder).toBe("—");
  expect(pool?.closest("li")?.textContent).toContain("Unallocated pool");
  expect(pool?.closest("li")?.textContent).toContain("Pool");
  expect(
    container.querySelector('section[aria-label="Cap table"] [data-slot=skeleton]'),
  ).toBeNull();
});

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
  expect(ada).toContain("30.0%");
  expect(founder).toContain("60.0%");
  expect(pool).toContain("10.0%");
  // A SAFE in the snapshot is not a table row; the SAFE list is the one record.
  expect(rows.some((r) => r.includes("Dee Newcomer"))).toBe(false);
  // The total row shows the percentages adding up to 100%.
  expect(rows.find((r) => r.startsWith("Total")) ?? "").toContain("100.0%");
});

it("has only the SAFEs and funds and Board tabs, and opens a holder's contact from its name", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.list.mockResolvedValue([
    { ...contact("c1", "Ada", "investor"), name: "Ada Example", email: "ada@example.test" },
  ]);
  await show("/app/investors?kind=auditor");
  const tabs = [...container.querySelectorAll("[role=tab]")].map((tab) => tab.textContent);
  expect(tabs).toEqual(["SAFEs and funds", "Board"]);
  expect(button("SAFEs and funds")?.getAttribute("aria-selected")).toBe("true");
  // A holder that is not a contact is plain text: clicking never opens a form.
  const founder = [...container.querySelectorAll("table tbody td span")].find(
    (el) => el.textContent === "Founder Example",
  ) as HTMLElement;
  await click(founder);
  expect(document.getElementById("contact-name")).toBeNull();
  await click(container.querySelector("table tbody button[title='Ada Example']") as HTMLElement);
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada Example");
});

it("counts only Funded SAFEs in Equity raised and shows Sent and Signed ones as committed", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({ ...carta, holders: carta.holders.map((h) => ({ ...h, amountUsd: null })) }),
  );
  rpcMock.safesList.mockResolvedValue([
    safeRow("s1", "Sent Fund", "sent"),
    safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 }),
    safeRow("s3", "Draft Fund", "draft"),
  ]);
  await show();
  expect(container.textContent).toContain("Equity raised$25,000");
  expect(container.textContent).toContain("$50,000 committed");
  expect(container.textContent).not.toContain("Dee Newcomer");
});

it("shows Equity raised from SAFEs when the cap table is empty", async () => {
  rpcMock.capTable.mockResolvedValue(state({ ...carta, fullyDilutedShares: 0, holders: [] }));
  rpcMock.safesList.mockResolvedValue([
    safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 }),
  ]);
  await show();
  expect(container.textContent).toContain("Equity raised$25,000");
});

it("shows a dash for Equity raised when the SAFE list fails to load", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.safesList.mockRejectedValue(new Error("down"));
  await show();
  expect(container.textContent).toContain("Equity raised—");
});

it("retries the SAFE list once before showing a dash", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.safesList
    .mockRejectedValueOnce(new Error("blip"))
    .mockResolvedValue([safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 })]);
  await show();
  expect(container.textContent).toContain("Equity raised$525,000");
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

it("saves a typed-in table whose saved numbers were formatted for another language", async () => {
  const { i18n } = await import("@lingui/core");
  i18n.loadAndActivate({ locale: "de", messages: {} });
  try {
    rpcMock.capTable.mockResolvedValue(
      state({ ...typed, holders: [{ ...typed.holders[0], shares: 6000000, amountUsd: 1234.5 }] }),
    );
    rpcMock.capTableSave.mockImplementation(async ({ table }) =>
      state({ ...typed, ...table, source: "native", updatedAt: "2026-10-15T10:05:00.000Z" }),
    );
    await show();
    await enter(field("name", 0), "Renamed");
    await blur(field("name", 0));
    expect(field("shares", 0).getAttribute("aria-invalid")).not.toBe("true");
    expect(rpcMock.capTableSave).toHaveBeenCalledTimes(1);
    expect(rpcMock.capTableSave.mock.calls[0]?.[0].table.holders[0]).toMatchObject({
      shares: 6000000,
      amountUsd: 1234.5,
    });
  } finally {
    i18n.loadAndActivate({ locale: "en", messages: {} });
  }
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

// ---- Google Sheet source ----

const sheetRef = { driveFileId: "file-1", name: "Cap table sheet" };
const sheet = { ...carta, source: "sheet" as const, sourceRef: sheetRef };
/** The empty table a switch to a sheet creates before the first read lands. */
const emptySheet = { ...sheet, fullyDilutedShares: 0, holders: [], optionPoolAvailable: null };
const sheetState = (
  snapshot: object | null,
  flags: { reading?: boolean; failed?: boolean } = {},
) => ({
  snapshot,
  syncing: false,
  reading: flags.reading ?? false,
  lastReadFailed: flags.failed ?? false,
});
const driveConnected = [{ connectorId: "google", provider: "googledrive", status: "connected" }];

it("offers Use a Google Sheet in the empty view, and Connect Google Drive when Drive is not connected", async () => {
  rpcMock.servers.mockResolvedValue([]);
  await show();
  expect(button("Use a Google Sheet")).toBeDefined();
  await click(button("Use a Google Sheet"));
  expect(button("Connect Google Drive")).toBeDefined();
  expect(rpcMock.useSheet).not.toHaveBeenCalled();
  expect(rpcMock.driveList).not.toHaveBeenCalled();
  // The table is unchanged: still the empty view.
  expect(button("Type it in")).toBeDefined();
});

it("picks a sheet with the Drive picker and starts reading it", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.connections.mockResolvedValue(driveConnected);
  rpcMock.driveList.mockResolvedValue({
    files: [
      {
        id: "file-1",
        name: "Cap table sheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
        isFolder: false,
      },
    ],
  });
  rpcMock.useSheet.mockImplementation(async () => {
    rpcMock.capTable.mockResolvedValue(sheetState(emptySheet, { reading: true }));
    return sheetState(emptySheet, { reading: true });
  });
  await show();
  await click(button("Use a Google Sheet"));
  await click(
    document.querySelector<HTMLElement>('[role="checkbox"][aria-label="Select Cap table sheet"]') ??
      undefined,
  );
  await click(button("Use this sheet"));
  expect(rpcMock.useSheet).toHaveBeenCalledWith(sheetRef);
  expect(rpcMock.importDrive).not.toHaveBeenCalled();
  // The first read: one line, no buttons.
  expect(container.textContent).toContain("Reading Cap table sheet…");
  expect(button("Type it in")).toBeUndefined();
  expect(button("Connect Carta")).toBeUndefined();
});

it("shows Reading sheet while a read runs and keeps the old table", async () => {
  rpcMock.capTable.mockResolvedValue(sheetState(sheet, { reading: true }));
  await show();
  expect(container.textContent).toContain("Reading sheet…");
  expect(container.textContent).toContain("Ada Example");
});

it("reads a sheet from the source menu, which has Refresh without Carta", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.capTable.mockResolvedValue(sheetState(sheet));
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  expect(container.textContent).toContain("Sheet · as of");
  await openSourceMenu();
  await click(menuItem("Refresh"));
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
});

it("keeps the old table after a failed read and offers Try again in the menu", async () => {
  rpcMock.capTable.mockResolvedValue(sheetState(sheet, { failed: true }));
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  expect(container.textContent).toContain("Ada Example");
  const line = [...container.querySelectorAll<HTMLElement>("button")].find((b) =>
    /Sheet · as of/.test(b.textContent ?? ""),
  );
  expect(line?.className).toContain("text-warning");
  await openSourceMenu();
  await click(menuItem("Last read failed · Try again"));
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
});

it("says the sheet could not be read when the first read fails", async () => {
  rpcMock.capTable.mockResolvedValue(sheetState(emptySheet, { failed: true }));
  rpcMock.refresh.mockResolvedValue({ ok: true });
  await show();
  expect(container.textContent).toContain("The sheet could not be read.");
  expect(button("Type it in")).toBeDefined();
  expect(container.querySelector("button[aria-haspopup=menu]")?.textContent).not.toContain("as of");
  await click(button("Try again"));
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
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

// ---- updates and board ----

const update = (over: Partial<InvestorUpdate> = {}): InvestorUpdate => ({
  id: "u1",
  audience: "investors",
  subject: "Example Co · 2026-09 update",
  period: "2026-09",
  body: "Body",
  status: "draft",
  recipientContactIds: ["c1"],
  fromConnectionId: null,
  deliveries: [],
  sentAt: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  ...over,
});
const partly = (deliveries: InvestorUpdate["deliveries"]) =>
  update({
    id: "u2",
    subject: "Example Co · 2026-08 update",
    status: "partly_sent",
    sentAt: "2026-09-02T09:00:00.000Z",
    deliveries,
  });

it("keeps a draft in Action items and in Updates until it is sent or deleted", async () => {
  rpcMock.updatesList.mockResolvedValue([update()]);
  await show();
  const items = container.querySelector("[aria-label='Action items']");
  expect(items?.textContent).toContain("Example Co · 2026-09 update");
  expect(items?.textContent).toContain("Drafted");
  expect(container.querySelector("[aria-label='Updates']")?.textContent).toContain("Draft");
  rpcMock.updatesList.mockResolvedValue([
    update({ status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }),
  ]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show();
  expect(container.querySelector("[aria-label='Action items']")).toBeNull();
  expect(container.querySelector("[aria-label='Updates']")?.textContent).toContain("Sent");
});

it("starts an investors update with New update", async () => {
  rpcMock.updatesSave.mockResolvedValue(update({ id: "new1" }));
  await show();
  await click(button("New update"));
  expect(rpcMock.updatesSave).toHaveBeenCalledWith({ audience: "investors" });
});

it("creates one draft however many times New update is clicked", async () => {
  let finish: (value: unknown) => void = () => {};
  rpcMock.updatesSave.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await show();
  const add = button("New update");
  await click(add);
  await click(add);
  await click(add);
  expect(rpcMock.updatesSave).toHaveBeenCalledTimes(1);
  await act(async () => finish(update({ id: "new1" })));
});

it("starts a board update from the Board tab once a board contact exists", async () => {
  rpcMock.updatesSave.mockResolvedValue(update({ id: "b1", audience: "board" }));
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await show("/app/investors?kind=board");
  expect(button("Message the board")).toBeUndefined();
  rpcMock.list.mockResolvedValue([contact("c9", "Bea", "board")]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?kind=board");
  await click(button("Message the board"));
  expect(rpcMock.updatesSave).toHaveBeenCalledWith({ audience: "board" });
});

it("names the problem recipient on a Partly sent row and retries failed ones directly", async () => {
  rpcMock.updatesList.mockResolvedValue([
    partly([
      { contactId: "c1", name: "Ada", state: "sent" },
      { contactId: "c3", name: "Cyd", state: "failed" },
    ]),
  ]);
  rpcMock.updatesRetry.mockResolvedValue(update());
  await show();
  const section = container.querySelector("[aria-label='Updates']");
  expect(section?.textContent).toContain("Partly sent");
  expect(section?.textContent).toContain("Cyd failed");
  await click(button("Retry"));
  expect(rpcMock.updatesRetry).toHaveBeenCalledWith({ id: "u2" });
});

it("asks before resending a delivery with an unknown result, and Mark delivered records it", async () => {
  rpcMock.updatesList.mockResolvedValue([
    partly([
      { contactId: "c1", name: "Ada", state: "unknown" },
      { contactId: "c3", name: "Cyd", state: "failed" },
    ]),
  ]);
  rpcMock.updatesRetry.mockResolvedValue(update());
  rpcMock.updatesMarkDelivered.mockResolvedValue(update());
  await show();
  expect(container.textContent).toContain("Ada: delivery unknown");
  await click(button("Retry"));
  expect(rpcMock.updatesRetry).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("May already be delivered. Send again?");
  await click(button("Mark delivered"));
  expect(rpcMock.updatesMarkDelivered).toHaveBeenCalledWith({ id: "u2" });
  await click(button("Retry"));
  await click(button("Send again"));
  expect(rpcMock.updatesRetry).toHaveBeenCalledWith({ id: "u2", resendUnknown: true });
});

it("shows a Sending row with its menu disabled, and Duplicate and Delete on a sent one", async () => {
  rpcMock.updatesList.mockResolvedValue([
    update({ id: "s1", subject: "Running", status: "sending" }),
    update({ id: "s2", subject: "Done", status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }),
  ]);
  rpcMock.updatesDuplicate.mockResolvedValue(update({ id: "s3" }));
  rpcMock.updatesDelete.mockResolvedValue({ ok: true });
  await show();
  const running = container.querySelector<HTMLButtonElement>(
    "button[aria-label='Actions for Running']",
  );
  expect(running?.disabled).toBe(true);
  await click(
    container.querySelector<HTMLElement>("button[aria-label='Actions for Done']") ?? undefined,
  );
  expect(menuItem("Duplicate")).toBeDefined();
  await click(menuItem("Duplicate"));
  expect(rpcMock.updatesDuplicate).toHaveBeenCalledWith({ id: "s2" });
  await click(
    container.querySelector<HTMLElement>("button[aria-label='Actions for Done']") ?? undefined,
  );
  await click(menuItem("Delete"));
  await click(button("Delete"));
  expect(rpcMock.updatesDelete).toHaveBeenCalledWith({ id: "s2" });
});

it("changes the Reminder from the Updates menu, with the current one ticked", async () => {
  rpcMock.reminder.mockImplementation(async (input: { cadence?: string }) => ({
    cadence: input.cadence ?? "monthly",
  }));
  await show();
  await click(
    container.querySelector<HTMLElement>("button[aria-label='Update options']") ?? undefined,
  );
  await click(
    [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
      (i) => i.textContent === "Reminder",
    ),
  );
  const quarterly = [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")].find(
    (i) => i.textContent === "Quarterly",
  );
  expect(
    [...document.querySelectorAll("[role=menuitemradio]")]
      .find((i) => i.textContent === "Monthly")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
  await click(quarterly);
  expect(rpcMock.reminder).toHaveBeenCalledWith({ cadence: "quarterly" });
});

const safeRow = (
  id: string,
  name: string,
  status: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  source: "native",
  contactId: null,
  roundId: null,
  investorName: name,
  investorEmail: null,
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: 100_000_000,
  discountPercent: null,
  mfn: false,
  proRata: false,
  governingState: null,
  investmentDate: null,
  expiresAt: null,
  canceledAt: null,
  sentAt: null,
  signedByOwnerAt: null,
  signedByInvestorAt: null,
  paidAt: null,
  documentUrl: null,
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

it("lists sent SAFEs under one group row at cap, outside the table, and hides Drafts", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.safesList.mockResolvedValue([
    safeRow("s1", "Sent Fund", "sent"),
    safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 }),
    safeRow("s3", "Draft Fund", "draft"),
    safeRow("s4", "Discount Fund", "sent", { source: "mercury", capCents: null }),
    safeRow("s5", "Canceled Fund", "canceled"),
  ]);
  await show();
  const group = container.querySelector("[aria-label='SAFEs, if converted at cap']");
  expect(group).not.toBeNull();
  // 5.0% + 2.5% at cap; the discount-only SAFE shows a dash and adds nothing.
  expect(group?.querySelector("[data-testid=safe-sum]")?.textContent).toBe("7.5%");
  const names = [...group!.querySelectorAll("li")].map((li) => li.textContent);
  expect(names).toEqual([
    expect.stringContaining("Sent Fund"),
    expect.stringContaining("Funded Fund"),
    expect.stringMatching(/Discount Fund.*—/),
  ]);
  expect(group?.textContent).not.toContain("Draft Fund");
  expect(group?.textContent).not.toContain("Canceled Fund");
  expect(group?.querySelector("a")?.getAttribute("href")).toBe("/app/fundraising");
});

it("shows no SAFE group when there are none to convert", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.safesList.mockResolvedValue([safeRow("s3", "Draft Fund", "draft")]);
  await show();
  expect(container.querySelector("[aria-label='SAFEs, if converted at cap']")).toBeNull();
});

const audit = (over: Partial<AuditRequest> = {}): AuditRequest => ({
  id: "a1",
  fund: "Example Audit LLP",
  asOf: "2026-09-30",
  asOfMatched: true,
  dueDate: "2026-11-15",
  status: "open",
  mailThreadId: "t1",
  connectionId: "k1",
  draftRef: null,
  senderKnown: true,
  notes: "",
  dataRoomItemId: null,
  drafting: false,
  newMail: false,
  createdAt: "2026-10-20T10:00:00.000Z",
  ...over,
});
const items = () => container.querySelector("[aria-label='Action items']");

it("lists audit requests as the server ordered them, with their chips and warnings, before an update draft", async () => {
  rpcMock.updatesList.mockResolvedValue([update()]);
  rpcMock.auditsList.mockResolvedValue([
    audit({ id: "a1", fund: "Soon Fund", dueDate: "2026-11-01" }),
    audit({
      id: "a2",
      fund: "Drafted Fund",
      dueDate: "2026-11-20",
      status: "drafted",
      newMail: true,
      senderKnown: false,
      asOfMatched: false,
    }),
    audit({ id: "a3", fund: "Undated Fund", dueDate: null }),
  ]);
  await show();
  const rows = [...(items()?.querySelectorAll("li") ?? [])].map((li) => li.textContent ?? "");
  expect(rows).toHaveLength(4);
  expect(rows[0]).toContain("Audit request · Soon Fund");
  expect(rows[0]).toContain("due Nov 1");
  expect(rows[0]).toContain("New");
  expect(rows[0]).toContain("Draft reply");
  expect(rows[1]).toContain("Draft ready");
  expect(rows[1]).toContain("New mail");
  expect(rows[1]).toContain("Sender not in Auditors");
  expect(rows[1]).toContain("Holdings as of today, not Sep 30");
  expect(rows[1]).not.toContain("Draft reply");
  expect(rows[2]).toContain("Undated Fund");
  expect(rows[3]).toContain("Example Co · 2026-09 update");
});

it("Draft reply starts the draft; Mark done and Dismiss close the request", async () => {
  rpcMock.auditsList.mockResolvedValue([audit()]);
  rpcMock.auditsDraft.mockResolvedValue(audit({ drafting: true }));
  rpcMock.auditsUpdate.mockResolvedValue(audit({ status: "done" }));
  await show();
  await click(button("Draft reply"));
  expect(rpcMock.auditsDraft).toHaveBeenCalledWith({ id: "a1" });
  await click(rowActions("Example Audit LLP"));
  await click(menuItem("Mark done"));
  expect(rpcMock.auditsUpdate).toHaveBeenCalledWith({ id: "a1", status: "done" });
  await click(rowActions("Example Audit LLP"));
  await click(menuItem("Dismiss"));
  expect(rpcMock.auditsUpdate).toHaveBeenLastCalledWith({ id: "a1", status: "dismissed" });
});

it("Draft reply opens the agent panel so the outcome is on screen; a second click is ignored", async () => {
  rpcMock.auditsList.mockImplementation(async () => [
    audit({ drafting: rpcMock.auditsDraft.mock.calls.length > 0 }),
  ]);
  rpcMock.auditsDraft.mockResolvedValue(audit({ drafting: true }));
  const onShowAgent = vi.fn();
  await show("/app/investors", { onShowAgent });
  await click(button("Draft reply"));
  expect(button("Draft reply")).toBeUndefined();
  expect(rpcMock.auditsDraft).toHaveBeenCalledTimes(1);
  expect(onShowAgent).toHaveBeenCalled();
});

it("shows Drafting at once, opens the panel on a repeat click, and says when the run made no draft", async () => {
  vi.useFakeTimers();
  let drafting = false;
  rpcMock.auditsList.mockImplementation(async () => [audit({ drafting })]);
  let finish: (value: AuditRequest) => void = () => {};
  rpcMock.auditsDraft.mockImplementation(
    () =>
      new Promise<AuditRequest>((resolve) => {
        finish = resolve;
      }),
  );
  const onShowAgent = vi.fn();
  await show("/app/investors", { onShowAgent });
  await click(button("Draft reply"));
  // The server has not answered yet: the row already shows Drafting.
  expect(button("Drafting…")).toBeDefined();
  await click(button("Drafting…"));
  expect(rpcMock.auditsDraft).toHaveBeenCalledTimes(1);
  expect(onShowAgent).toHaveBeenCalledTimes(1);
  drafting = true;
  await act(async () => finish(audit({ drafting: true })));
  drafting = false;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3500);
  });
  expect(items()?.textContent).toContain("No draft made, see Ask");
  expect(button("Draft reply")).toBeDefined();
});

it("keeps polling after the draft starts when the list reads fail, so Draft reply is not stuck", async () => {
  vi.useFakeTimers();
  let started = false;
  let recovered = false;
  rpcMock.auditsList.mockImplementation(async () => {
    if (started && !recovered) throw new Error("offline");
    return [audit()];
  });
  rpcMock.auditsDraft.mockImplementation(async () => {
    started = true;
    return audit({ drafting: true });
  });
  await show("/app/investors", { onShowAgent: vi.fn() });
  await click(button("Draft reply"));
  recovered = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(items()?.textContent).toContain("No draft made, see Ask");
});

it("shows a spinner and Drafting… instead of Draft reply while a drafting run is going", async () => {
  rpcMock.auditsList.mockResolvedValue([audit({ drafting: true })]);
  await show();
  expect(button("Draft reply")).toBeUndefined();
  const drafting = button("Drafting…") as HTMLButtonElement;
  expect(drafting.getAttribute("aria-disabled")).toBe("true");
  expect(drafting.querySelector("svg")).not.toBeNull();
});

it("keeps Show done reachable after the last open request closes", async () => {
  rpcMock.auditsList.mockResolvedValue([audit({ status: "done" })]);
  await show();
  expect(items()).toBeNull();
  await click(button("Show done"));
  expect(items()?.textContent).toContain("Audit request · Example Audit LLP");
  expect(items()?.textContent).toContain("Done");
  expect(items()?.textContent).not.toContain("Draft reply");
  await click(button("Hide done"));
  expect(items()).toBeNull();
});

it("shows no Show done button before any request is done", async () => {
  rpcMock.auditsList.mockResolvedValue([audit()]);
  await show();
  expect(button("Show done")).toBeUndefined();
});
