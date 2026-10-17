// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
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
  me: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: { list: rpcMock.list, save: rpcMock.save, delete: rpcMock.remove },
    mcp: { servers: { list: rpcMock.servers } },
    carta: { capTable: rpcMock.capTable, refresh: rpcMock.refresh },
    me: rpcMock.me,
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
import { CapTablePage, rowKind } from "./CapTable";

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

async function show(url = "/app/cap-table", props: Parameters<typeof CapTablePage>[0] = {}) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <CapTablePage {...props} />
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
  rpcMock.me.mockResolvedValue({ needsModel: false });
});
afterEach(() => {
  setHideAmounts(false);
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

it("shows Reconnect Carta when the Carta sign-in needs attention", async () => {
  rpcMock.servers.mockResolvedValue([{ ...cartaServer, oauthStatus: "reconnect" }]);
  await show();
  expect(container.textContent).toContain("Sign in to Carta again");
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

it("lists the unallocated option pool as a row so the Ownership column adds up", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const row = [...container.querySelectorAll("tr")].find((tr) =>
    tr.textContent?.includes("Unallocated pool"),
  );
  expect(row?.textContent).toContain("500,000");
  expect(row?.textContent).toContain("5.00%");
});

it("puts the unallocated pool right after the granted options, before the SAFEs", async () => {
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
        { ...snapshot.holders[1] },
      ],
    },
    syncing: false,
  });
  await show();
  const names = [...container.querySelectorAll("tbody tr")].map(
    (tr) => tr.querySelector("td")?.textContent ?? "",
  );
  const at = (name: string) => names.findIndex((n) => n.startsWith(name));
  expect(at("Unallocated pool")).toBe(at("Granted options") + 1);
  expect(at("Unallocated pool")).toBeLessThan(at("Dee Newcomer"));
});

it("shows Ownership in the same font as the other figures", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const cells = [...container.querySelectorAll("tbody td")].filter((td) =>
    td.textContent?.includes("10.00%"),
  );
  expect(cells).toHaveLength(1);
  expect(cells[0]?.className).not.toContain("font-mono");
});

it("offers Add email for a holder without a contact and prefills the dialog", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  // The Email column; on a phone the same action also shows under the name.
  const add = [...container.querySelectorAll("tbody td:nth-child(2) button")].filter(
    (b) => b.textContent === "Add email",
  ) as HTMLElement[];
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

it("keeps the contact restorable when Undo fails, and restores it on Try again", async () => {
  rpcMock.remove.mockResolvedValue({ ok: true });
  rpcMock.save.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
  await show();
  await click(button("Bo"));
  await click(button("Delete"));
  await click(button("Undo"));
  expect(document.body.textContent).toContain("offline");
  // The failure names the contact and says that dismissing loses it.
  expect(document.body.textContent).toContain("Could not restore Bo");
  expect(document.body.textContent).toContain("Bo stays deleted");
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
  expect(document.body.textContent).not.toContain("offline");
  expect(document.body.textContent).toContain("Restored Bo");
});

it("confirms a save and closes the dialog with Cancel", async () => {
  rpcMock.save.mockResolvedValue({});
  await show();
  await click(button("Add contact"));
  await click(button("Cancel"));
  expect(document.getElementById("contact-name")).toBeNull();
  expect(rpcMock.save).not.toHaveBeenCalled();
  await click(button("Add contact"));
  await typeInto("contact-name", "Cy");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Contact saved");
  // The notice sits above the table in the page flow, so it never covers a row.
  const status = container.querySelector("[role=status]") as HTMLElement;
  expect(status.textContent).toContain("Contact saved");
  expect(status.closest(".fixed")).toBeNull();
  const table = container.querySelector("table") as HTMLElement;
  expect(status.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("reads the kind filter from the URL and names the kind when it is empty", async () => {
  rpcMock.list.mockResolvedValue([contact("c1", "Ada", "investor")]);
  await show("/app/cap-table?kind=auditor");
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
  expect(container.textContent).toContain("Not on Carta?");
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
  await show("/app/cap-table?kind=investor");
  const text = container.textContent ?? "";
  expect(text).toContain("Angel Person");
  expect(text).toContain("Ada");
  expect(text).not.toContain("Founder Person");
  expect(text).not.toContain("Granted options");
  await click(button("All"));
  expect(container.textContent).toContain("Founder Person");
  const adds = [...container.querySelectorAll("tbody td:nth-child(2) button")].filter(
    (b) => b.textContent === "Add email",
  );
  expect(adds).toHaveLength(1);
  // A contact with no holding shows a dash, the same as a holder with no shares.
  const rows = [...container.querySelectorAll("tbody tr")];
  const bo = rows.find((row) => row.textContent?.includes("Bo"));
  expect(bo?.querySelectorAll("td")[4]?.textContent).toBe("—");
});

it("keeps the Kind column with or without Carta", async () => {
  await show();
  const headers = () => [...container.querySelectorAll("th")].map((th) => th.textContent);
  expect(headers()).toEqual(["Name", "Email", "Kind"]);
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  expect(headers()).toEqual(["Name", "Email", "Kind", "Shares", "Ownership"]);
});

it("adds a contact of the open tab's kind from the header", async () => {
  await show("/app/cap-table?kind=other");
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
      <MemoryRouter initialEntries={["/app/cap-table"]}>
        <CapTablePage onCartaStatus={status} />
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

it("hides shares, ownership, 409A and amounts while amounts are hidden, and flips back live", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  setHideAmounts(true);
  await show();
  const text = container.textContent ?? "";
  for (const real of [
    "10,000,000",
    "500,000",
    "1.25",
    "70.00",
    "30.00",
    "1,000,000",
    "10.00",
    "250,000",
  ])
    expect(text).not.toContain(real);
  expect(text).toContain("Example Co");
  expect(text).toContain("Example Ventures");
  await click(
    button("Show amounts") ??
      (document.querySelector("[data-testid=hide-amounts-toggle]") as HTMLElement),
  );
  expect(container.textContent).toContain("10,000,000");
});

it("reloads contacts and the cap table when the agent finishes a chat turn", async () => {
  const render = (agentBusy: boolean) =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/app/cap-table"]}>
          <CapTablePage agentBusy={agentBusy} />
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
  rpcMock.me.mockResolvedValue({ needsModel: true });
  const onOpenModelSettings = vi.fn();
  await show("/app/cap-table", { onOpenModelSettings });
  await flush();
  expect(container.textContent).toContain("needs a model before it can read your cap table");
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
  await show("/app/cap-table?kind=shareholder");
  expect(container.textContent).toContain("Founder Person");
  expect(container.textContent).not.toContain("Granted options");
  expect(container.textContent).not.toContain("Angel Person");
  await click(button("Options"));
  expect(container.textContent).toContain("Granted options");
  expect(container.textContent).not.toContain("Founder Person");
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
  await show();
  const row = [...container.querySelectorAll("tbody tr")].find((r) =>
    r.textContent?.includes("Priya Holder"),
  );
  expect(row?.textContent).toContain("priya@fund.test");
  expect(row?.textContent).toContain("Save as contact");
  expect(row?.textContent).not.toContain("Add email");
  await click(button("Save as contact"));
  expect(document.body.textContent).toContain("Save Priya Holder as a contact");
});

it("draws the ownership bar with equal segments while amounts are hidden", async () => {
  rpcMock.capTable.mockResolvedValue({ snapshot, syncing: false });
  await show();
  const widths = () =>
    [...(container.querySelector("[data-testid=ownership-bar]")?.children ?? [])].map(
      (el) => (el as HTMLElement).style.width,
    );
  expect(widths()).toEqual(["70%", "30%"]);
  await act(async () => setHideAmounts(true));
  expect(widths()).toEqual(["50%", "50%"]);
});
