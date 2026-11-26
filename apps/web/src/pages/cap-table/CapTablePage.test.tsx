// @vitest-environment jsdom

import type { EquityOverview } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

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

const rpcMock = vi.hoisted(() => {
  const emptyPage = () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 });
  return {
    overview: vi.fn(),
    importSnapshot: vi.fn(),
    // The stakeholders tab: an empty directory.
    stakeholders: {
      list: vi.fn(emptyPage),
      get: vi.fn(() => Promise.reject(new Error("Stakeholder not found"))),
    },
    customProperties: { list: vi.fn(() => Promise.resolve([])) },
    savedViews: { list: vi.fn(emptyPage) },
    stakeholderChanges: {
      counts: vi.fn(() =>
        Promise.resolve({ match: 0, termination: 0, profile: 0, lastProposedAt: null }),
      ),
    },
  };
});
vi.mock("../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { CapTablePage } from "./CapTablePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMPTY: EquityOverview = {
  hasLedger: false,
  canImport: false,
  importedAt: null,
  asOf: "2026-10-15",
  totals: {
    outstandingShares: "0",
    fullyDilutedShares: "0",
    commonShares: "0",
    preferredShares: "0",
    availablePlanShares: "0",
    amountRaisedCents: "0",
  },
  classes: [],
  plans: [],
  convertibles: [],
  counts: {
    stakeholders: 0,
    shareClasses: 0,
    plans: 0,
    certificates: 0,
    convertibles: 0,
    optionGrants: 0,
    fundingRounds: 0,
  },
};

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
  vi.clearAllMocks();
});

function At() {
  const location = useLocation();
  return <span data-at={location.pathname} />;
}

async function renderPage(path: string) {
  rpcMock.overview.mockResolvedValue(EMPTY);
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <CapTablePage />
        <At />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

it("redirects /app/cap-table to the overview tab", async () => {
  const container = await renderPage("/app/cap-table");
  expect(container.querySelector("[data-at]")?.getAttribute("data-at")).toBe(
    "/app/cap-table/overview",
  );
});

it("redirects an unknown tab to the overview tab", async () => {
  const container = await renderPage("/app/cap-table/not-a-tab");
  expect(container.querySelector("[data-at]")?.getAttribute("data-at")).toBe(
    "/app/cap-table/overview",
  );
});

it("shows the tabs and the stakeholders empty state", async () => {
  const container = await renderPage("/app/cap-table/stakeholders");
  expect(container.textContent).toContain("Cap table");
  expect(container.textContent).toContain("Share classes");
  expect(container.textContent).toContain("No stakeholders");
});

it("offers a way back from a stakeholder that does not exist", async () => {
  const container = await renderPage("/app/cap-table/stakeholders/missing");
  expect(container.textContent).toContain("Stakeholder not found");
  const back = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "All stakeholders",
  );
  await act(async () => {
    back?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector("[data-at]")?.getAttribute("data-at")).toBe(
    "/app/cap-table/stakeholders",
  );
});

it("starts an empty ledger from the overview by adding stakeholders", async () => {
  const container = await renderPage("/app/cap-table/overview");
  expect(container.textContent).toContain("No cap table yet");
  const start = [...container.querySelectorAll("a")].find(
    (link) => link.textContent === "Add stakeholders",
  );
  expect(start?.getAttribute("href")).toBe("/app/cap-table/stakeholders");
});

it("keeps the first tab reachable when the tabs overflow", async () => {
  const container = await renderPage("/app/cap-table/overview");
  // Centered tabs overflow on both sides and cut "Overview" off at 1100 px; start-aligned they
  // scroll from the first tab.
  const list = container.querySelector("[role=tablist]");
  expect(list?.className).toContain("justify-start");
  expect(list?.className).toContain("no-scrollbar");
});
