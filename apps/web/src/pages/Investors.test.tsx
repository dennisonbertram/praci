// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { AuditRequest, Contact, InvestorUpdate } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetDeletedContacts } from "../lib/use-contact-notices";

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
    async (): Promise<{ portal: boolean; documents: string[]; safes: number }> => ({
      portal: false,
      documents: [],
      safes: 0,
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
  equityOverview: vi.fn(),
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
  updatesAccounts: vi.fn(),
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
    equity: { overview: rpcMock.equityOverview },
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
        accounts: rpcMock.updatesAccounts,
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
async function openReminder(cadence?: "monthly" | "quarterly" | "off") {
  if (!menuItem("Reminder")) {
    await click(
      container.querySelector<HTMLElement>("button[aria-label='Update options']") ?? undefined,
    );
  }
  await click(menuItem("Reminder"));
  if (cadence) {
    await click(
      [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")].find(
        (item) =>
          item.textContent ===
          ({ monthly: "Monthly", quarterly: "Quarterly", off: "Off" } as const)[cadence],
      ),
    );
  }
}
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
      <MemoryRouter key={url} initialEntries={[url]}>
        <I18nProvider i18n={i18n}>
          <InvestorsPage {...props} />
          <NotificationToaster onOpen={() => {}} />
        </I18nProvider>
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
  i18n.loadAndActivate({ locale: "en", messages: {} });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor"), contact("c2", "Bo", "board")]);
  rpcMock.safesList.mockResolvedValue([]);
  rpcMock.updatesList.mockResolvedValue([]);
  rpcMock.updatesAccounts.mockResolvedValue([]);
  rpcMock.auditsList.mockResolvedValue([]);
  rpcMock.reminder.mockResolvedValue({ cadence: "monthly" });
  rpcMock.servers.mockResolvedValue([cartaServer]);
  rpcMock.capTable.mockResolvedValue({ snapshot: null, syncing: false });
  rpcMock.equityOverview.mockResolvedValue({ hasLedger: false });
  rpcMock.folders.mockResolvedValue([]);
  rpcMock.items.mockResolvedValue({ items: [], nextCursor: null });
  rpcMock.connections.mockResolvedValue([]);
  rpcMock.catalog.mockResolvedValue([]);
});
afterEach(() => {
  act(() => notificationToastManager.close());
  resetDeletedContacts();
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
  await show("/app/investors?tab=contacts");
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
  await show("/app/investors?tab=contacts");
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

it("opens the contact page when a contact row is tapped", async () => {
  let path = "";
  const Where = () => {
    path = useLocation().pathname;
    return null;
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/investors?tab=contacts"]}>
        <I18nProvider i18n={i18n}>
          <InvestorsPage />
          <Where />
        </I18nProvider>
      </MemoryRouter>,
    ),
  );
  await flush();
  await click(openRow("c1"));
  expect(path).toBe("/app/contacts/c1");
  expect(document.getElementById("contact-name")).toBeNull();
});

it("edits and deletes a contact from its row menu", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show("/app/investors?tab=contacts");
  await click(rowActions("Ada"));
  await click(menuItem("Edit"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Ada");
  await click(button("Cancel"));
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
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
  await show("/app/investors?tab=contacts");
  expect(portalCell("c1")).toBeUndefined();
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
    await show("/app/investors?tab=contacts");
  };
  await show("/app/investors?tab=contacts");
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
  await show("/app/investors?tab=contacts");
  await click(rowActions("Ada"));
  await click(menuItem("Resend link"));
  expect(rpcMock.portalResend).toHaveBeenCalledWith({ contactId: "c1", copy: false });
  expect(document.body.textContent).toContain("Link sent to Ada");
});

it("shows the link once when it comes back instead of being emailed", async () => {
  rpcMock.portalResend.mockResolvedValue({ link: "https://app.example.test/portal/open#abc" });
  await show("/app/investors?tab=contacts");
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
  await show("/app/investors?tab=contacts");
  await click(rowActions("Ada"));
  await click(menuItem("Revoke"));
  expect(rpcMock.portalRevoke).toHaveBeenCalledWith({ contactId: "c1" });
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  await click(rowActions("Bo"));
  await click(menuItem("Unblock"));
  expect(rpcMock.portalUnblock).toHaveBeenCalledWith({ contactId: "c2" });
});

it("asks before deleting a contact with portal access and gives no Undo for it", async () => {
  rpcMock.linked.mockResolvedValue({ portal: true, documents: ["Deck.pdf"], safes: 0 });
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show("/app/investors?tab=contacts");
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
  await show("/app/investors?q=cyd&tab=contacts");
  expect(container.textContent).toContain("Cyd");
  expect(container.textContent).not.toContain("Ada");
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?q=nobody&tab=contacts");
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
  await show("/app/investors?kind=investor&tab=contacts");
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

it("background refreshes contacts on focus and keeps the current rows when it fails", async () => {
  await show("/app/investors?tab=contacts");
  expect(container.textContent).toContain("Ada");
  const calls = rpcMock.list.mock.calls.length;
  const updateCalls = rpcMock.updatesList.mock.calls.length;
  const auditCalls = rpcMock.auditsList.mock.calls.length;
  rpcMock.list.mockRejectedValueOnce(new Error("offline"));
  rpcMock.updatesList.mockRejectedValueOnce(new Error("offline"));
  rpcMock.auditsList.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await flush();
  });
  expect(rpcMock.list.mock.calls.length).toBe(calls + 1);
  expect(rpcMock.updatesList.mock.calls.length).toBe(updateCalls + 1);
  expect(rpcMock.auditsList.mock.calls.length).toBe(auditCalls + 1);
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).not.toContain("Could not load contacts");
});

it("reloads contacts, updates and requests once when the agent stops answering", async () => {
  await show("/app/investors?tab=contacts", { agentBusy: false });
  await show("/app/investors?tab=contacts", { agentBusy: true });
  const calls = [rpcMock.list, rpcMock.updatesList, rpcMock.auditsList].map(
    (mock) => mock.mock.calls.length,
  );
  await show("/app/investors?tab=contacts", { agentBusy: false });
  expect(
    [rpcMock.list, rpcMock.updatesList, rpcMock.auditsList].map((m) => m.mock.calls.length),
  ).toEqual(calls.map((n) => n + 1));
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

/** A row tap opens the contact page; the edit dialog opens from the row menu. */
const editRow = async (name: string) => {
  await click(rowActions(name));
  await click(menuItem("Edit"));
};

/** Runs `body` with fake timers, so the Undo window can be crossed without waiting. */
const withClock = async (body: () => Promise<void>) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await body();
  } finally {
    vi.useRealTimers();
  }
};
const passUndoWindow = () => act(async () => vi.advanceTimersByTime(5001));

it("holds the delete for the Undo window, hides the row, then deletes once", () =>
  withClock(async () => {
    rpcMock.remove.mockResolvedValue({ ok: true });
    await show("/app/investors?kind=board&tab=contacts");
    await editRow("Bo");
    await click(button("Delete"));
    expect(document.body.textContent).toContain("Deleted Bo");
    expect(container.querySelector('[data-contact-id="c2"]')).toBeNull();
    expect(rpcMock.remove).not.toHaveBeenCalled();
    await passUndoWindow();
    expect(rpcMock.remove).toHaveBeenCalledTimes(1);
    expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c2" });
    expect(button("Undo")).toBeUndefined();
  }));

it("Undo inside the window makes no server call and brings the same row back", () =>
  withClock(async () => {
    rpcMock.remove.mockResolvedValue({ ok: true });
    await show("/app/investors?kind=board&tab=contacts");
    await editRow("Bo");
    await click(button("Delete"));
    await click(button("Undo"));
    expect(document.body.textContent).toContain("Restored Bo");
    expect(rpcMock.save).not.toHaveBeenCalled();
    const row = container.querySelector('[data-contact-id="c2"]');
    expect(row).not.toBeNull();
    expect(document.activeElement).toBe(row?.querySelector("[data-row-open]"));
    await passUndoWindow();
    expect(rpcMock.remove).not.toHaveBeenCalled();
  }));

it("puts the row back and shows the error when the held delete fails", () =>
  withClock(async () => {
    rpcMock.remove.mockRejectedValue(new Error("Contact is busy"));
    await show("/app/investors?kind=board&tab=contacts");
    await editRow("Bo");
    await click(button("Delete"));
    await passUndoWindow();
    expect(container.querySelector('[data-contact-id="c2"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Contact is busy");
  }));

it("keeps the row gone and shows no error when the held delete finds the contact already deleted", () =>
  withClock(async () => {
    rpcMock.remove.mockRejectedValue(
      Object.assign(new Error("Contact not found"), { code: "NOT_FOUND" }),
    );
    await show("/app/investors?kind=board&tab=contacts");
    await editRow("Bo");
    await click(button("Delete"));
    const calls = rpcMock.list.mock.calls.length;
    await passUndoWindow();
    expect(container.querySelector('[data-contact-id="c2"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Contact not found");
    expect(rpcMock.list.mock.calls.length).toBeGreaterThan(calls);
  }));

it("still deletes when the page unmounts inside the window", () =>
  withClock(async () => {
    rpcMock.remove.mockResolvedValue({ ok: true });
    await show("/app/investors?kind=board&tab=contacts");
    await editRow("Bo");
    await click(button("Delete"));
    await act(async () => root.unmount());
    root = createRoot(container);
    await passUndoWindow();
    expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c2" });
  }));

it("asks first, with no Undo, for a contact whose portal access was revoked", async () => {
  rpcMock.linked.mockResolvedValue({ portal: true, documents: [], safes: 0 });
  await show("/app/investors?tab=contacts");
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
    "This also removes their portal access.",
  );
  expect(rpcMock.remove).not.toHaveBeenCalled();
});

it("asks before deleting a contact linked to a SAFE and gives no Undo for it", async () => {
  rpcMock.linked.mockResolvedValue({ portal: false, documents: [], safes: 1 });
  rpcMock.remove.mockResolvedValue({ ok: true });
  await show("/app/investors?tab=contacts");
  await click(rowActions("Ada"));
  await click(menuItem("Delete"));
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("This also removes the link to 1 SAFE.");
  await click(
    [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Delete") as
      | HTMLElement
      | undefined,
  );
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  expect(button("Undo")).toBeUndefined();
});

it("confirms a save with a toast and highlights the saved row", async () => {
  const saved = contact("c3", "Cy", "investor");
  rpcMock.save.mockResolvedValue(saved);
  Element.prototype.scrollIntoView = () => {};
  await show("/app/investors?tab=contacts");
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
  await show("/app/investors?kind=board&tab=contacts");
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
        <I18nProvider i18n={i18n}>
          <InvestorsPage onCartaStatus={status} />
        </I18nProvider>
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

it("shows the empty Updates and Contacts as quiet lines", async () => {
  rpcMock.servers.mockResolvedValue([]);
  rpcMock.list.mockResolvedValue([]);
  await show("/app/investors?tab=updates");
  expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  expect(container.querySelector('section[aria-label="Updates"]')?.textContent).toContain(
    "No updates yet",
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?tab=contacts");
  expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  expect(container.querySelector('section[aria-label="Contacts"]')?.textContent).toContain(
    "No contacts yet",
  );
});

it("renders Updates and Contacts at once, without waiting on the Carta check", async () => {
  rpcMock.servers.mockReturnValue(new Promise(() => {}));
  rpcMock.updatesList.mockResolvedValue([update()]);
  await show("/app/investors?tab=updates");
  expect(container.querySelector('section[aria-label="Updates"]')?.textContent).toContain(
    "Example Co · 2026-09 update",
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?tab=contacts");
  expect(container.querySelector('section[aria-label="Contacts"]')?.textContent).toContain("Ada");
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

it("recovers a failed cap-table background refresh on focus", async () => {
  rpcMock.capTable.mockRejectedValueOnce(new Error("offline"));
  await show();
  expect(container.textContent).toContain("Could not load the cap table");
  rpcMock.capTable.mockResolvedValue(state(carta));
  const calls = rpcMock.capTable.mock.calls.length;
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await flush();
  });
  expect(rpcMock.capTable.mock.calls.length).toBe(calls + 1);
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
        <MemoryRouter initialEntries={["/app/investors?tab=contacts"]}>
          <I18nProvider i18n={i18n}>
            <InvestorsPage agentBusy={agentBusy} />
          </I18nProvider>
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
  await show("/app/investors?kind=auditor&tab=contacts");
  const tabs = [...container.querySelectorAll('[role=tablist][aria-label="Kind"] [role=tab]')].map(
    (tab) => tab.textContent,
  );
  expect(tabs).toEqual(["SAFEs and funds", "Board"]);
  expect(button("SAFEs and funds")?.getAttribute("aria-selected")).toBe("true");
  await act(async () => root.unmount());
  root = createRoot(container);
  await show();
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

it("ignores the Carta company total in Equity raised and counts Funded SAFEs only", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({
      ...carta,
      amountRaisedUsd: 350_000,
      holders: carta.holders.map((h) => ({ ...h, amountUsd: null })),
    }),
  );
  rpcMock.safesList.mockResolvedValue([
    safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 }),
  ]);
  await show();
  expect(container.textContent).toContain("Equity raised$25,000");
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

it("shows a loading state, not a dash, until the SAFE list answers", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  let answer: (rows: ReturnType<typeof safeRow>[]) => void = () => {};
  rpcMock.safesList.mockReturnValue(
    new Promise<ReturnType<typeof safeRow>[]>((resolve) => (answer = resolve)),
  );
  await show();
  expect(container.textContent).not.toContain("Equity raised—");
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  answer([safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 })]);
  await flush();
  expect(container.textContent).toContain("Equity raised$525,000");
});

it("keeps the loading state, not a dash, while a sync is still filling in the figures", async () => {
  rpcMock.capTable.mockResolvedValue(
    state({ ...carta, holders: carta.holders.map((h) => ({ ...h, amountUsd: null })) }, true),
  );
  rpcMock.safesList.mockResolvedValue([]);
  await show();
  expect(container.textContent).not.toContain("Equity raised—");
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
});

it("offers Try again when the SAFE list cannot load", async () => {
  rpcMock.capTable.mockResolvedValue(state(carta));
  rpcMock.safesList.mockRejectedValue(new Error("down"));
  await show();
  rpcMock.safesList.mockResolvedValue([
    safeRow("s2", "Funded Fund", "funded", { amountCents: 2_500_000 }),
  ]);
  const retry = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => retry?.click());
  await flush();
  expect(container.textContent).toContain("Equity raised$525,000");
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

it("shows the table read-only once the cap table ledger is the record", async () => {
  rpcMock.capTable.mockResolvedValue(state({ ...typed, amountRaisedUsd: 1_234_567 }));
  rpcMock.equityOverview.mockResolvedValue({ hasLedger: true });
  await show();
  expect(container.querySelectorAll("[data-testid=holder-row]")).toHaveLength(0);
  expect(container.textContent).toContain("Open cap table");
  // The header names the ledger, and the raised figure is the ledger's own total.
  expect(container.textContent).toContain("Cap table · as of");
  expect(container.textContent).not.toContain("Typed in");
  expect(container.textContent).toContain("$1,234,567");
});

it("does not offer the editable table when the ledger check fails, and retries", async () => {
  rpcMock.capTable.mockResolvedValue(state(typed));
  rpcMock.equityOverview.mockRejectedValueOnce(new Error("offline"));
  await show();
  expect(container.querySelectorAll("[data-testid=holder-row]")).toHaveLength(0);
  rpcMock.equityOverview.mockResolvedValue({ hasLedger: false });
  await act(async () => {
    button("Retry")?.click();
  });
  await flush();
  expect(container.querySelectorAll("[data-testid=holder-row]").length).toBeGreaterThan(0);
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
  expect(container.querySelector("button[aria-haspopup=menu]")).toBeNull();
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

it("pauses update polling while the tab is hidden and resumes on the next tick", async () => {
  vi.useFakeTimers();
  const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    rpcMock.updatesList.mockResolvedValue([update({ status: "sending" })]);
    await show("/app/investors?tab=updates");
    const calls = rpcMock.updatesList.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => void (await vi.advanceTimersByTimeAsync(2_500)));
    expect(rpcMock.updatesList).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => void (await vi.advanceTimersByTimeAsync(2_000)));
    expect(rpcMock.updatesList.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    if (visibility) Object.defineProperty(document, "visibilityState", visibility);
    else Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  }
});

it("keeps a draft in Action items and in Updates until it is sent or deleted", async () => {
  rpcMock.updatesList.mockResolvedValue([update()]);
  await show("/app/investors?tab=updates");
  const items = container.querySelector("[aria-label='Action items']");
  expect(items?.textContent).toContain("Example Co · 2026-09 update");
  expect(items?.textContent).toContain("Drafted");
  expect(container.querySelector("[aria-label='Updates']")?.textContent).toContain("Draft");
  rpcMock.updatesList.mockResolvedValue([
    update({ status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }),
  ]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?tab=updates");
  expect(container.querySelector("[aria-label='Action items']")).toBeNull();
  expect(container.querySelector("[aria-label='Updates']")?.textContent).toContain("Sent");
});

it("filters Updates by status and sorts them by date from the URL", async () => {
  rpcMock.updatesList.mockResolvedValue([
    update({
      id: "a",
      subject: "Alpha note",
      status: "sent",
      sentAt: "2026-07-02T09:00:00.000Z",
    }),
    update({
      id: "b",
      subject: "Beta note",
      status: "posted",
      sentAt: "2026-10-02T09:00:00.000Z",
    }),
    update({ id: "c", subject: "Gamma note", status: "sent", sentAt: "2026-09-02T09:00:00.000Z" }),
  ]);
  const subjects = () =>
    [
      ...(container.querySelector("[aria-label='Updates']")?.textContent ?? "").matchAll(
        /(Alpha|Beta|Gamma) note/g,
      ),
    ].map((m) => m[1]);
  await show("/app/investors?tab=updates");
  expect(subjects()).toEqual(["Beta", "Gamma", "Alpha"]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?tab=updates&updates-sort=date&updates-dir=asc");
  expect(subjects()).toEqual(["Alpha", "Gamma", "Beta"]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?tab=updates&updates-status=sent");
  expect(subjects()).toEqual(["Gamma", "Alpha"]);
});

it("starts an investors update with New update", async () => {
  rpcMock.updatesSave.mockResolvedValue(update({ id: "new1" }));
  await show("/app/investors?tab=updates");
  await click(button("New update"));
  expect(rpcMock.updatesSave).toHaveBeenCalledWith({ audience: "investors" });
});

it("creates one draft however many times New update is clicked", async () => {
  let finish: (value: unknown) => void = () => {};
  rpcMock.updatesSave.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  await show("/app/investors?tab=updates");
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
  await show("/app/investors?kind=board&tab=contacts");
  expect(button("Message the board")).toBeUndefined();
  rpcMock.list.mockResolvedValue([contact("c9", "Bea", "board")]);
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/investors?kind=board&tab=contacts");
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
  await show("/app/investors?tab=updates");
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
  await show("/app/investors?tab=updates");
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

it("tells the founder a sent investors update leaves the portal, but not for drafts or board updates", async () => {
  const note = "Investors will no longer see it on the portal.";
  rpcMock.updatesList.mockResolvedValue([
    update({ id: "a", subject: "Sent inv", status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }),
    update({ id: "b", subject: "Draft inv" }),
    update({ id: "c", subject: "Sent board", audience: "board", status: "sent" }),
  ]);
  await show("/app/investors?tab=updates");
  for (const [subject, expected] of [
    ["Sent inv", true],
    ["Draft inv", false],
    ["Sent board", false],
  ] as const) {
    await click(
      container.querySelector<HTMLElement>(`button[aria-label='Actions for ${subject}']`) ??
        undefined,
    );
    await click(menuItem("Delete"));
    expect(document.body.textContent?.includes(note)).toBe(expected);
    await click(button("Cancel"));
  }
});

it("shows a Sending row with its menu disabled, and Duplicate and Delete on a sent one", async () => {
  rpcMock.updatesList.mockResolvedValue([
    update({ id: "s1", subject: "Running", status: "sending" }),
    update({ id: "s2", subject: "Done", status: "sent", sentAt: "2026-10-02T09:00:00.000Z" }),
  ]);
  rpcMock.updatesDuplicate.mockResolvedValue(update({ id: "s3" }));
  rpcMock.updatesDelete.mockResolvedValue({ ok: true });
  await show("/app/investors?tab=updates");
  const running = container.querySelector<HTMLButtonElement>(
    "button[aria-label='Actions for Running']",
  );
  expect(running?.disabled).toBe(true);
  await click(
    container.querySelector<HTMLElement>("button[aria-label='Actions for Done']") ?? undefined,
  );
  expect(menuItem("Duplicate")).toBeDefined();
  await click(menuItem("Delete"));
  await click(button("Delete"));
  expect(rpcMock.updatesDelete).toHaveBeenCalledWith({ id: "s2" });
  await click(
    container.querySelector<HTMLElement>("button[aria-label='Actions for Done']") ?? undefined,
  );
  // Duplicate opens the copy, which leaves this page.
  await click(menuItem("Duplicate"));
  expect(rpcMock.updatesDuplicate).toHaveBeenCalledWith({ id: "s2" });
});

it("labels board updates, dates a partly sent one, and drops the period from a sending one", async () => {
  rpcMock.updatesList.mockResolvedValue([
    update({ id: "b1", audience: "board", subject: "Example Co · 2026-Q3 board note" }),
    update({ id: "i1" }),
    partly([{ contactId: "c1", name: "Ada", state: "failed" }]),
    update({ id: "s1", subject: "Running", status: "sending" }),
  ]);
  await show("/app/investors?tab=updates");
  const section = container.querySelector("[aria-label='Updates']") as HTMLElement;
  const row = (subject: string) =>
    [...section.querySelectorAll("li")].find((li) => li.textContent?.includes(subject));
  expect(row("board note")?.textContent).toContain("Board · Drafted");
  expect(row("2026-09 update")?.textContent).not.toContain("Investors ·");
  expect(row("2026-08 update")?.textContent).toContain("Ada failed · Sent Sep 2");
  expect(row("Running")?.textContent).not.toContain("2026-");
});

it("names every update status in its row badge", async () => {
  vi.useFakeTimers();
  rpcMock.updatesList.mockResolvedValue([
    update({ id: "d", subject: "One draft" }),
    update({ id: "g", subject: "Two going", status: "sending" }),
    update({ id: "s", subject: "Three sent", status: "sent", sentAt: "2026-09-02T09:00:00.000Z" }),
    update({
      id: "p",
      subject: "Four part",
      status: "partly_sent",
      sentAt: "2026-09-02T09:00:00.000Z",
      deliveries: [{ contactId: "c1", name: "Ada", state: "failed" }],
    }),
    update({
      id: "o",
      subject: "Five posted",
      status: "posted",
      sentAt: "2026-09-02T09:00:00.000Z",
    }),
  ]);
  await show("/app/investors?tab=updates");
  const section = container.querySelector("[aria-label='Updates']") as HTMLElement;
  const badge = (subject: string) =>
    [...section.querySelectorAll("li")]
      .find((li) => li.textContent?.includes(subject))
      ?.querySelector('[data-slot="badge"]')?.textContent;
  expect(badge("One draft")).toBe("Draft");
  expect(badge("Two going")).toBe("Sending");
  expect(badge("Three sent")).toBe("Sent");
  expect(badge("Four part")).toBe("Partly sent");
  expect(badge("Five posted")).toBe("Posted");
});

it("changes the Reminder from the Updates menu, with the current one ticked", async () => {
  rpcMock.reminder.mockImplementation(async (input: { cadence?: string }) => ({
    cadence: input.cadence ?? "monthly",
  }));
  await show("/app/investors?tab=updates");
  await openReminder();
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

it("keeps the latest Reminder choice when an older save fails", async () => {
  let rejectFirst!: (cause: Error) => void;
  let resolveSecond!: (result: { cadence: string }) => void;
  rpcMock.reminder
    .mockResolvedValueOnce({ cadence: "monthly" })
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
  await show("/app/investors?tab=updates");

  await openReminder("quarterly");
  await openReminder("off");
  expect(rpcMock.reminder).toHaveBeenCalledTimes(3);
  await act(async () => resolveSecond({ cadence: "off" }));
  await flush();
  await act(async () => rejectFirst(new Error("offline")));
  await flush();
  expect(document.body.textContent).not.toContain("offline");

  await openReminder();
  expect(
    [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
      .find((item) => item.textContent === "Off")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
});

it("restores the confirmed Reminder cadence and shows an error when the latest save fails", async () => {
  rpcMock.reminder
    .mockResolvedValueOnce({ cadence: "monthly" })
    .mockRejectedValueOnce(new Error("offline"));
  await show("/app/investors?tab=updates");
  await openReminder("quarterly");
  await flush();
  expect(document.body.textContent).toContain("offline");
  await openReminder();
  expect(
    [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
      .find((item) => item.textContent === "Monthly")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
});

it("restores the confirmed cadence when Off fails after Quarterly is pending", async () => {
  let rejectOff!: (cause: Error) => void;
  rpcMock.reminder
    .mockResolvedValueOnce({ cadence: "monthly" })
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOff = reject;
        }),
    );
  await show("/app/investors?tab=updates");
  await openReminder("quarterly");
  await openReminder("off");
  await act(async () => rejectOff(new Error("offline")));
  await flush();
  await openReminder();
  expect(
    [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
      .find((item) => item.textContent === "Monthly")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
});

it("ignores an older Reminder save that succeeds after a newer choice", async () => {
  let resolveFirst!: (result: { cadence: string }) => void;
  let resolveSecond!: (result: { cadence: string }) => void;
  rpcMock.reminder
    .mockResolvedValueOnce({ cadence: "monthly" })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
  await show("/app/investors?tab=updates");
  await openReminder("quarterly");
  await openReminder("off");
  await act(async () => resolveSecond({ cadence: "off" }));
  await flush();
  await act(async () => resolveFirst({ cadence: "quarterly" }));
  await flush();
  await openReminder();
  expect(
    [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
      .find((item) => item.textContent === "Off")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
});

it("ignores a slow initial Reminder read after the user picks a cadence", async () => {
  let resolveRead!: (result: { cadence: string }) => void;
  rpcMock.reminder
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    )
    .mockResolvedValueOnce({ cadence: "quarterly" });
  await show("/app/investors?tab=updates");
  await openReminder("quarterly");
  await act(async () => resolveRead({ cadence: "monthly" }));
  await flush();
  await openReminder();
  expect(
    [...document.querySelectorAll<HTMLElement>("[role=menuitemradio]")]
      .find((item) => item.textContent === "Quarterly")
      ?.getAttribute("aria-checked"),
  ).toBe("true");
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

it("shows a retry when updates fail before loading data", async () => {
  rpcMock.updatesList.mockRejectedValueOnce(new Error("offline"));
  await show("/app/investors?tab=updates");
  expect(container.querySelector('[role="alert"] span')?.textContent).toBe(
    "Could not load updates",
  );
  await click(button("Try again"));
  expect(rpcMock.updatesList).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("shows a retry when audit requests fail before loading data", async () => {
  rpcMock.auditsList.mockRejectedValueOnce(new Error("offline"));
  await show();
  expect(container.querySelector('[role="alert"] span')?.textContent).toBe(
    "Could not load investor requests",
  );
  await click(button("Try again"));
  expect(rpcMock.auditsList).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("lists audit requests as the server ordered them, with their chips and warnings, before an update draft", async () => {
  rpcMock.updatesList.mockResolvedValue([update()]);
  rpcMock.updatesAccounts.mockResolvedValue([
    { connectionId: "k1", label: "Me", address: "me@example.test" },
  ]);
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
  expect(rows[1]).toContain("Open draft");
  expect(rpcMock.updatesAccounts).toHaveBeenCalledTimes(1);
  expect(rows[2]).toContain("Undated Fund");
  expect(rows[3]).toContain("Example Co · 2026-09 update");
});

it("Draft reply starts the draft; Mark done closes at once and Dismiss waits out the Undo window", () =>
  withClock(async () => {
    rpcMock.auditsList.mockResolvedValue([audit()]);
    rpcMock.auditsDraft.mockResolvedValue(audit({ drafting: true }));
    rpcMock.auditsUpdate.mockResolvedValue(audit({ status: "done" }));
    await show();
    expect(rpcMock.updatesAccounts).not.toHaveBeenCalled();
    await click(button("Draft reply"));
    expect(rpcMock.auditsDraft).toHaveBeenCalledWith({ id: "a1" });
    await click(rowActions("Example Audit LLP"));
    await click(menuItem("Mark done"));
    expect(rpcMock.auditsUpdate).toHaveBeenCalledWith({ id: "a1", status: "done" });
    await click(rowActions("Example Audit LLP"));
    await click(menuItem("Dismiss"));
    expect(document.body.textContent).toContain("Dismissed Example Audit LLP.");
    expect(rpcMock.auditsUpdate).not.toHaveBeenCalledWith({ id: "a1", status: "dismissed" });
    expect(container.querySelector('[data-audit-id="a1"]')).toBeNull();
    await passUndoWindow();
    expect(rpcMock.auditsUpdate).toHaveBeenLastCalledWith({ id: "a1", status: "dismissed" });
  }));

it("Undo inside the window makes no dismiss call and brings the row back", () =>
  withClock(async () => {
    rpcMock.auditsList.mockResolvedValue([audit()]);
    await show();
    await click(rowActions("Example Audit LLP"));
    await click(menuItem("Dismiss"));
    await click(button("Undo"));
    expect(container.querySelector('[data-audit-id="a1"]')).not.toBeNull();
    await passUndoWindow();
    expect(rpcMock.auditsUpdate).not.toHaveBeenCalledWith({ id: "a1", status: "dismissed" });
  }));

it("still dismisses when the page unmounts inside the Undo window", () =>
  withClock(async () => {
    rpcMock.auditsList.mockResolvedValue([audit()]);
    rpcMock.auditsUpdate.mockResolvedValue(audit({ status: "dismissed" }));
    await show();
    await click(rowActions("Example Audit LLP"));
    await click(menuItem("Dismiss"));
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(rpcMock.auditsUpdate).toHaveBeenCalledTimes(1);
    expect(rpcMock.auditsUpdate).toHaveBeenCalledWith({ id: "a1", status: "dismissed" });
  }));

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

it("pauses draft polling while the tab is hidden and resumes on the next tick", async () => {
  vi.useFakeTimers();
  const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
  try {
    rpcMock.auditsList.mockResolvedValue([audit({ drafting: true })]);
    await show("/app/investors");
    const calls = rpcMock.auditsList.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => void (await vi.advanceTimersByTimeAsync(3_500)));
    expect(rpcMock.auditsList).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => void (await vi.advanceTimersByTimeAsync(3_000)));
    expect(rpcMock.auditsList.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    if (visibility) Object.defineProperty(document, "visibilityState", visibility);
    else Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  }
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
  await show("/app/investors?tab=updates");
  expect(items()).toBeNull();
  await click(button("Show done"));
  expect(items()?.textContent).toContain("Audit request · Example Audit LLP");
  expect(items()?.textContent).toContain("Done");
  expect(items()?.textContent).not.toContain("Draft reply");
  await click(button("Hide done"));
  expect(items()).toBeNull();
});

it("keeps done requests off the other tabs while Show done is on", async () => {
  rpcMock.auditsList.mockResolvedValue([audit({ status: "done" })]);
  await show("/app/investors?tab=updates");
  await click(button("Show done"));
  expect(container.querySelector('[data-audit-id="a1"]')).not.toBeNull();
  await click(button("Cap table"));
  expect(container.querySelector('[data-audit-id="a1"]')).toBeNull();
  await click(button("Updates"));
  expect(container.querySelector('[data-audit-id="a1"]')).not.toBeNull();
});

it("shows no Show done button before any request is done", async () => {
  rpcMock.auditsList.mockResolvedValue([audit()]);
  await show();
  expect(button("Show done")).toBeUndefined();
});

it("shows one section per tab, keeps the tab in the URL, and falls back to Cap table", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await show("/app/investors?tab=nonsense");
  const tab = (name: string) =>
    [...container.querySelectorAll('[role=tablist][aria-label="Sections"] [role=tab]')].find(
      (el) => el.textContent === name,
    ) as HTMLElement;
  expect(tab("Cap table").getAttribute("aria-selected")).toBe("true");
  expect(container.querySelector('section[aria-label="Cap table"]')).not.toBeNull();
  expect(container.querySelector('section[aria-label="Contacts"]')).toBeNull();
  expect(container.querySelector('section[aria-label="Updates"]')).toBeNull();

  await click(tab("Contacts"));
  expect(tab("Contacts").getAttribute("aria-selected")).toBe("true");
  expect(container.querySelector('section[aria-label="Contacts"]')).not.toBeNull();
  expect(container.querySelector('section[aria-label="Cap table"]')).toBeNull();

  await click(tab("Updates"));
  expect(container.querySelector('section[aria-label="Updates"]')).not.toBeNull();
  expect(container.querySelector('section[aria-label="Contacts"]')).toBeNull();
});

it("sorts the Contacts tab by organization and has no Stage filter or sort", async () => {
  rpcMock.list.mockResolvedValue([
    {
      ...contact("c1", "Ada", "investor"),
      organization: "Zed Fund",
      stage: "meeting",
      checkSizeCents: 5_000_000,
    },
    {
      ...contact("c2", "Bo", "investor"),
      organization: "Alpha Fund",
      stage: "target",
      checkSizeCents: 1_000_000,
    },
    {
      ...contact("c3", "Cy", "investor"),
      organization: null,
      stage: "meeting",
      checkSizeCents: null,
    },
  ]);
  const names = () =>
    [...container.querySelectorAll("[data-contact-id] [data-row-open]")].map(
      (b) => b.querySelector("span")?.textContent,
    );
  await show("/app/investors?tab=contacts");
  expect(names()).toEqual(["Ada", "Bo", "Cy"]);
  await show("/app/investors?tab=contacts&sort=organization");
  expect(names()).toEqual(["Bo", "Ada", "Cy"]);
  await show("/app/investors?tab=contacts&sort=check&dir=desc");
  expect(names()).toEqual(["Ada", "Bo", "Cy"]);
  // An old link's stage filter no longer narrows the list.
  await show("/app/investors?tab=contacts&stage=meeting");
  expect(names()).toEqual(["Ada", "Bo", "Cy"]);
  expect(button("Stage")).toBeUndefined();
  expect(button("Sort: Name")).toBeDefined();
});
