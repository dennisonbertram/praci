// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  msg: (parts: TemplateStringsArray) => parts[0],
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return {
    useLingui: () => ({ t, i18n: { locale: "en", _: (message: unknown) => String(message) } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("../lib/auth", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u1" } } }) },
}));
vi.mock("../lib/hex/useHexSync", () => ({ useHexSync: () => {} }));
vi.mock("../components/SidebarPages", () => ({ SidebarPages: () => null }));
vi.mock("./shell/bot-pins", () => ({
  PinsList: () => null,
  PinsStrip: () => null,
  useBotPins: () => [null, () => {}],
}));

// Every page body is replaced by a marker so the test pins which page a route renders.
const marker = vi.hoisted(() => (name: string) => ({
  [name]: () => <div data-testid={`page-${name}`} />,
}));
vi.mock("./Artifacts", () => marker("ArtifactsPage"));
vi.mock("./Board", () => marker("BoardPage"));
vi.mock("../components/brex/BrexPage", () => marker("BrexPage"));
vi.mock("./BotPageView", () => marker("BotPageView"));
vi.mock("./Calendar", () => marker("CalendarPage"));
vi.mock("./cap-table/CapTablePage", () => marker("CapTablePage"));
vi.mock("./Company", () => marker("CompanyPage"));
vi.mock("./CompanyImport", () => marker("CompanyImportPage"));
vi.mock("./ContactDetail", () => marker("ContactDetailPage"));
vi.mock("./Contacts", () => marker("ContactsPage"));
vi.mock("./DataRoom", () => marker("DataRoomPage"));
vi.mock("./Devin", () => marker("DevinPage"));
vi.mock("./Finance", () => marker("FinancePage"));
vi.mock("./Fundraising", () => marker("FundraisingPage"));
vi.mock("./Gtm", () => marker("GtmPage"));
vi.mock("./Integrations", () => marker("IntegrationsPage"));
vi.mock("./Inbox", () => marker("InboxPage"));
vi.mock("./Investors", () => marker("InvestorsPage"));
vi.mock("./investors/UpdateEditor", () => marker("UpdateEditor"));
vi.mock("./Legal", () => marker("LegalPage"));
vi.mock("./MeetingDetail", () => marker("MeetingDetailPage"));
vi.mock("./Meetings", () => marker("MeetingsPage"));
vi.mock("./Scanner", () => marker("ScannerPage"));

const setup = vi.hoisted(() => ({
  hiddenPages: [] as string[],
  ticketBoardEnabled: false,
  glance: {} as Record<string, unknown>,
}));

vi.mock("../lib/rpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rpc")>();
  const bot = {
    id: "b1",
    name: "Bot",
    spawnKey: null,
    description: "",
    preview: "",
    title: "",
    color: "#000",
    status: "idle",
  };
  const rpcOverrides = {
    ...actual.rpc,
    bootstrap: async () => ({
      me: {
        ticketBoardEnabled: setup.ticketBoardEnabled,
        userId: "u1",
        hideAmounts: false,
        hiddenPages: setup.hiddenPages,
      },
      bots: [bot],
      botSections: [],
      archivedBots: [],
      archivedGroups: [],
      groups: [],
      spaces: [],
      routines: [],
    }),
    bots: { ...actual.rpc.bots, list: async () => [bot] },
    taughtSkills: { list: async () => [] },
    spaces: {
      ...actual.rpc.spaces,
      list: async () => ({
        current: { bots: [bot], botSections: [], groups: [] },
        spaces: [],
      }),
    },
    inbox: { unreadCount: async () => ({ count: 0 }) },
    notifications: {
      unseenCounts: async () => ({ counts: {} }),
      glance: async () => ({
        financeRunwayMonths: null,
        legalDueSoon: 0,
        devinNeedsYou: 0,
        devinConnected: false,
        brexConnected: false,
        gtmNeedsYou: 0,
        dataRoomWaiting: 0,
        hasTickets: false,
        botKinds: {},
        ...setup.glance,
      }),
    },
  };
  const methodFallback = (key: PropertyKey) => async () =>
    ["list", "listArchived", "messages"].includes(String(key)) ? [] : {};
  const defaults = new Proxy({}, { get: () => async () => ({}) });
  return {
    ...actual,
    rpc: new Proxy(rpcOverrides, {
      get: (target, key: string) => {
        const value = Reflect.get(target, key);
        if (value === undefined) return defaults;
        if (typeof value !== "object" || value === null) return value;
        return new Proxy(value, {
          get: (namespace, method: PropertyKey) =>
            Reflect.get(namespace, method) ?? methodFallback(method),
        });
      },
    }),
  };
});

import { ShellPage } from "./Shell";
import { APP_PAGES, matchPage } from "./shell/pages";

let container: HTMLDivElement = document.createElement("div");
let root: Root | undefined;

async function mount(path: string) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia ??= (query: string) =>
    ({
      matches: !query.includes("pointer") && !query.includes("max-width"),
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    root = createRoot(container);
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/*" element={<ShellPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

const sidebarIds = () =>
  [...container.querySelectorAll('[data-testid^="sidebar-"]')]
    .map((node) => node.getAttribute("data-testid") ?? "")
    .filter((id) =>
      [
        "inbox",
        "finance",
        "brex",
        "legal",
        "gtm",
        "devin",
        "investors",
        "cap-table",
        "fundraising",
        "company",
        "calendar",
        "meetings",
        "contacts",
        "data-room",
        "scanner",
        "artifacts",
      ].includes(id.slice("sidebar-".length)),
    );

async function paletteEntries() {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return [...document.querySelectorAll('[data-value^="page:"]')].map((node) => [
    node.getAttribute("data-value"),
    node.textContent,
  ]);
}

beforeEach(() => {
  setup.hiddenPages = [];
  setup.ticketBoardEnabled = false;
  setup.glance = {};
  window.localStorage.clear();
});
afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("shell pages", () => {
  it("registers cap table separately from Investors, including nested routes", () => {
    expect(APP_PAGES.find((page) => page.key === "cap-table")).toMatchObject({
      key: "cap-table",
      paths: ["/app/cap-table/*"],
      sidebar: true,
    });
    expect(matchPage("/app/cap-table/stakeholders")?.key).toBe("cap-table");
    expect(matchPage("/app/investors/updates/u1")?.key).toBe("investors");
  });

  it("lists the sidebar pages in order with the optional ones absent", async () => {
    await mount("/app/inbox");
    expect(sidebarIds()).toEqual(
      [
        "inbox",
        "finance",
        "legal",
        "gtm",
        "investors",
        "cap-table",
        "fundraising",
        "company",
        "calendar",
        "meetings",
        "contacts",
        "data-room",
        "scanner",
        "artifacts",
      ].map((key) => `sidebar-${key}`),
    );
    const labels = [...container.querySelectorAll('[data-testid^="sidebar-"]')]
      .filter((n) => sidebarIds().includes(n.getAttribute("data-testid") ?? ""))
      .map((n) => n.textContent?.replace(/\d+$/, "").trim());
    expect(labels).toEqual([
      "Inbox",
      "Finance",
      "Legal",
      "GTM",
      "Investors",
      "Cap table",
      "Fundraising",
      "Company",
      "Calendar",
      "Meetings",
      "Contacts",
      "Data room",
      "Scanner",
      "Artifacts",
    ]);
  });

  it("adds Brex after Finance and Devin after GTM when connected", async () => {
    setup.glance = { brexConnected: true, devinConnected: true };
    await mount("/app/inbox");
    expect(sidebarIds().map((id) => id.slice(8))).toEqual([
      "inbox",
      "finance",
      "brex",
      "legal",
      "gtm",
      "devin",
      "investors",
      "cap-table",
      "fundraising",
      "company",
      "calendar",
      "meetings",
      "contacts",
      "data-room",
      "scanner",
      "artifacts",
    ]);
  });

  it("leaves out a page the user hid, from the sidebar and the palette", async () => {
    setup.hiddenPages = ["finance", "scanner", "contacts"];
    await mount("/app/inbox");
    expect(sidebarIds()).not.toContain("sidebar-finance");
    expect(sidebarIds()).not.toContain("sidebar-scanner");
    expect(sidebarIds()).not.toContain("sidebar-contacts");
    expect(sidebarIds()).toContain("sidebar-inbox");
    const entries = (await paletteEntries()).map(([value]) => value);
    expect(entries).not.toContain("page:finance");
    expect(entries).not.toContain("page:scanner");
    expect(entries).toContain("page:inbox");
  });

  it("offers the same pages in the palette, in order, with Settings last", async () => {
    setup.glance = { brexConnected: true, devinConnected: true, hasTickets: true };
    setup.ticketBoardEnabled = true;
    await mount("/app/inbox");
    expect(await paletteEntries()).toEqual([
      ["page:inbox", "Inbox"],
      ["page:finance", "Finance"],
      ["page:brex", "Brex"],
      ["page:legal", "Legal"],
      ["page:gtm", "GTM"],
      ["page:devin", "Devin"],
      ["page:investors", "Investors"],
      ["page:cap-table", "Cap table"],
      ["page:fundraising", "Fundraising"],
      ["page:company", "Company"],
      ["page:calendar", "Calendar"],
      ["page:meetings", "Meetings"],
      ["page:contacts", "Contacts"],
      ["page:data-room", "Data room"],
      ["page:scanner", "Scanner"],
      ["page:artifacts", "Artifacts"],
      ["page:board", "Task board"],
      ["page:integrations", "Integrations"],
      ["page:settings", "Settings"],
    ]);
  });

  it("hides Brex, Devin and the board from the palette until they apply", async () => {
    await mount("/app/inbox");
    const values = (await paletteEntries()).map(([value]) => value);
    for (const key of ["brex", "devin", "board"]) expect(values).not.toContain(`page:${key}`);
  });

  it.each([
    ["/app/inbox", "InboxPage", "inbox"],
    ["/app/integrations", "IntegrationsPage", "integrations"],
    ["/app/integrations/gmail", "IntegrationsPage", "integrations"],
    ["/app/finance", "FinancePage", "finance"],
    ["/app/finance/invoices", "FinancePage", "finance"],
    ["/app/brex", "BrexPage", "brex"],
    ["/app/legal", "LegalPage", "legal"],
    ["/app/gtm", "GtmPage", "gtm"],
    ["/app/devin", "DevinPage", "devin"],
    ["/app/company", "CompanyPage", "company"],
    ["/app/company/import", "CompanyImportPage", "company"],
    ["/app/data-room", "DataRoomPage", "data-room"],
    ["/app/scanner", "ScannerPage", "scanner"],
    ["/app/investors", "InvestorsPage", "investors"],
    ["/app/investors/updates/u1", "UpdateEditor", "investors"],
    ["/app/cap-table/overview", "CapTablePage", "cap-table"],
    ["/app/cap-table/stakeholders", "CapTablePage", "cap-table"],
    ["/app/fundraising", "FundraisingPage", "fundraising"],
    ["/app/calendar", "CalendarPage", "calendar"],
    ["/app/contacts", "ContactsPage", "contacts"],
    ["/app/contacts/c1", "ContactDetailPage", "contacts"],
    ["/app/meetings", "MeetingsPage", "meetings"],
    ["/app/meetings/m1", "MeetingDetailPage", "meetings"],
    ["/app/artifacts", "ArtifactsPage", "artifacts"],
    ["/app/artifacts/a1", "ArtifactsPage", "artifacts"],
    ["/app/board", "BoardPage", null],
    ["/app/pages/b1/p1", "BotPageView", null],
  ])("renders %s as %s and marks %s current", async (path, page, current) => {
    setup.glance = { brexConnected: true, devinConnected: true };
    await mount(path);
    expect(container.querySelector(`[data-testid="page-${page}"]`)).not.toBeNull();
    const marked = [...container.querySelectorAll('[data-testid^="sidebar-"][aria-current]')].map(
      (node) => node.getAttribute("data-testid"),
    );
    expect(marked).toEqual(current ? [`sidebar-${current}`] : []);
  });
});
