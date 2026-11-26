// @vitest-environment jsdom

import type { EquityOverview } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useSearchParams } from "react-router-dom";
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
  overview: vi.fn(),
  importSnapshot: vi.fn(),
  views: { capTableByStakeholder: vi.fn() },
  savedViews: { list: vi.fn(), create: vi.fn() },
}));
const download = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock("../views/download", () => download);
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { byStakeholderFixture } from "../views/fixtures";
import { CapTableOverview } from "./CapTableOverview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: EquityOverview = {
  hasLedger: true,
  canImport: false,
  importedAt: "2026-10-01",
  asOf: "2026-10-15",
  totals: {
    outstandingShares: "10100000",
    fullyDilutedShares: "12000000",
    commonShares: "7000000",
    preferredShares: "4100000",
    availablePlanShares: "900000",
    amountRaisedCents: "500000000",
  },
  classes: [
    {
      shareClassId: "common",
      name: "Common",
      classType: "common",
      authorizedShares: "10000000",
      outstandingShares: "7000000",
      outstandingPercent: "69.3069",
      fullyDilutedShares: "7000000",
      fullyDilutedPercent: "58.3333",
      amountRaisedCents: "0",
    },
    {
      shareClassId: "seed",
      name: "Seed Preferred",
      classType: "preferred",
      authorizedShares: "4100000",
      outstandingShares: "4100000",
      outstandingPercent: "40.5941",
      fullyDilutedShares: "4100000",
      fullyDilutedPercent: "34.1667",
      amountRaisedCents: "500000000",
    },
  ],
  plans: [
    {
      planId: "plan",
      name: "2026 Stock Plan",
      outstandingShares: "300000",
      availableShares: "900000",
      fullyDilutedPercent: "10.0000",
    },
  ],
  convertibles: [
    {
      blockId: "safe",
      name: "Sample Capital SAFE",
      principalCents: "25000000",
      interestCents: "1500000",
      outstandingDebtCents: "26500000",
      amountRaisedCents: "25000000",
    },
  ],
  counts: {
    stakeholders: 4,
    shareClasses: 2,
    plans: 1,
    certificates: 3,
    convertibles: 1,
    optionGrants: 4,
    fundingRounds: 1,
  },
};

const empty: EquityOverview = {
  ...base,
  hasLedger: false,
  importedAt: null,
  classes: [],
  plans: [],
  convertibles: [],
  totals: {
    outstandingShares: "0",
    fullyDilutedShares: "0",
    commonShares: "0",
    preferredShares: "0",
    availablePlanShares: "0",
    amountRaisedCents: "0",
  },
};

let root: ReturnType<typeof createRoot> | null = null;
beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.savedViews.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 500 });
});
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

const Query = () => {
  const [params] = useSearchParams();
  return <output data-testid="query">{params.toString()}</output>;
};

async function render(entries: string[] = ["/"], probe = false) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={entries}>
        {probe ? <Query /> : null}
        <CapTableOverview />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

it("shows the totals and the class table from the overview", async () => {
  rpcMock.overview.mockResolvedValue(base);
  const container = await render();
  const content = container.textContent ?? "";
  expect(content).toContain("12,000,000");
  expect(content).toContain("$5,000,000");
  expect(content).toContain("Seed Preferred");
  expect(content).toContain("10,000,000");
  expect(content).toContain("$265,000");
  expect(content).toContain("2026 Stock Plan");
});

it("copies the snapshot and refetches when the ledger is empty", async () => {
  rpcMock.overview.mockResolvedValue({ ...empty, canImport: true });
  rpcMock.importSnapshot.mockResolvedValue({
    stakeholders: 0,
    shareClasses: 0,
    plans: 0,
    certificates: 0,
    convertibles: 0,
    optionGrants: 0,
  });
  const container = await render();
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === "Copy from current cap table",
  );
  expect(button).toBeDefined();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(rpcMock.importSnapshot).toHaveBeenCalledTimes(1);
  expect(rpcMock.overview).toHaveBeenCalledTimes(2);
});

const click = async (element: Element | undefined) => {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const byText = (container: HTMLElement, selector: string, text: string) =>
  [...container.querySelectorAll(selector)].find((element) => element.textContent === text);
const headers = (container: HTMLElement) =>
  [...(container.querySelector("table")?.querySelectorAll("th") ?? [])].map((th) => th.textContent);

it("switches between fully diluted and outstanding columns", async () => {
  rpcMock.overview.mockResolvedValue(base);
  const container = await render();
  expect(headers(container)).toContain("Fully diluted %");
  expect(headers(container)).not.toContain("Ownership");
  await click(container.querySelector('[role="switch"]') ?? undefined);
  expect(headers(container)).toContain("Ownership");
  expect(headers(container)).not.toContain("Fully diluted %");
});

it("keeps the toolbar in the URL so a saved view can restore it", async () => {
  rpcMock.overview.mockResolvedValue(base);
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  const container = await render(["/"], true);
  const query = () => container.querySelector('[data-testid="query"]')?.textContent;
  await click(container.querySelector('[role="switch"]') ?? undefined);
  expect(query()).toBe("fd=0");
  await click(byText(container, "button", "By stakeholder"));
  expect(query()).toBe("fd=0&view=stakeholder");
});

it("restores a saved view's params from the URL", async () => {
  rpcMock.overview.mockResolvedValue(base);
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  const container = await render(["/?view=stakeholder&fd=0"]);
  expect(rpcMock.views.capTableByStakeholder).toHaveBeenCalledWith({});
  expect(container.textContent).toContain("Ada Founder");
  expect(container.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
});

it("re-reads the overview as of the chosen date", async () => {
  rpcMock.overview.mockResolvedValue(base);
  const container = await render();
  const input = container.querySelector<HTMLInputElement>('input[type="date"]')!;
  expect(input.value).toBe("2026-10-15");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "2025-12-31");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(rpcMock.overview).toHaveBeenLastCalledWith({ asOf: "2025-12-31" });
});

it("shows the cap table by stakeholder and downloads it as CSV", async () => {
  rpcMock.overview.mockResolvedValue(base);
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  const container = await render();
  await click(byText(container, "button", "By stakeholder"));
  expect(rpcMock.views.capTableByStakeholder).toHaveBeenCalledWith({});
  expect(container.textContent).toContain("Ada Founder");
  await click(byText(container, "button", "Download CSV"));
  const [name, csv] = download.downloadText.mock.calls[0] as [string, string];
  expect(name).toBe("cap-table-2026-10-15.csv");
  expect(csv.split("\r\n")[0]).toBe(
    "Stakeholder,Common,Series Seed,Options,Fully diluted,Ownership,Convertibles (cents)",
  );
  expect(csv).toContain("Ada Founder,5000000,,0,5000000,41.6667,0");
});

it("prints", async () => {
  rpcMock.overview.mockResolvedValue(base);
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const container = await render();
  await click(byText(container, "button", "Print"));
  expect(print).toHaveBeenCalledTimes(1);
});

it("splits fully diluted into issued shares, options granted and the pool, adding to the total", async () => {
  // 7,000,000 common + 4,100,000 preferred + 300,000 granted + 900,000 pool.
  rpcMock.overview.mockResolvedValue({
    ...base,
    totals: { ...base.totals, fullyDilutedShares: "12300000" },
  });
  const container = await render();
  const rows = [...(container.querySelector("table")?.querySelectorAll("tbody tr") ?? [])].map(
    (row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent),
  );
  const common = rows.find((row) => row[0] === "Common")!;
  expect(common[2]).toBe("7,000,000");
  expect(common[3]).toBe("56.91%");
  expect(rows.find((row) => row[0] === "Available for grant")?.[2]).toBe("900,000");
  const total = rows
    .map((row) => Number((row[2] ?? "0").replaceAll(",", "")))
    .reduce((sum, value) => sum + value, 0);
  expect(total).toBe(12_300_000);
});

it("shows no 100% total for a ledger with no shares yet", async () => {
  rpcMock.overview.mockResolvedValue({
    ...base,
    totals: {
      ...base.totals,
      outstandingShares: "0",
      fullyDilutedShares: "0",
      commonShares: "0",
      preferredShares: "0",
      availablePlanShares: "0",
      amountRaisedCents: "0",
    },
    classes: [],
    plans: [],
  });
  const container = await render();
  const totals = container.querySelector('[aria-label="Totals"]')?.textContent ?? "";
  expect(totals).toContain("Total");
  expect(totals).not.toContain("100");
});

it("scrolls the class rows and their total together on a narrow screen", async () => {
  rpcMock.overview.mockResolvedValue(base);
  const container = await render();
  const totals = container.querySelector('[aria-label="Totals"]')!;
  const scroller = totals.closest(".overflow-x-auto");
  expect(scroller?.textContent).toContain("Seed Preferred");
});
