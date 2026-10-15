// @vitest-environment jsdom

import type { MessageBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
    Plural: ({ value, one, other }: { value: number; one: string; other: string }) =>
      (value === 1 ? one : other).replace("#", String(value)),
  };
});

import { FinanceCardGroup, FinanceCards, financeCardQuote } from "./FinanceCards";

type Block = Extract<MessageBlock, { kind: "finance" }>;

async function render(block: Block) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceCards block={block} />
      </MemoryRouter>,
    ),
  );
  return container;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const hrefs = (container: HTMLElement) =>
  [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));

it("shows the top spend rows with bars, the total and links to their pages", async () => {
  const view = await render({
    kind: "finance",
    card: {
      card: "breakdown",
      by: "category",
      range: "Last 90 days",
      totalCents: 150_000,
      rows: [
        { key: "software", label: "Software", cents: 100_000 },
        { key: "travel", label: "Travel", cents: 50_000 },
      ],
    },
  });
  expect(view.textContent).toContain("Last 90 days");
  expect(view.textContent).toContain("$1,500");
  expect(view.textContent).toContain("Software");
  expect(view.querySelectorAll("span[style]")).toHaveLength(2);
  expect(hrefs(view)).toEqual([
    "/app/finance/spend?period=month",
    "/app/finance/category/software",
    "/app/finance/category/travel",
  ]);
});

it("shows the four numbers of the overview", async () => {
  const view = await render({
    kind: "finance",
    card: {
      card: "overview",
      cashCents: 1_000_000,
      burnCents: 200_000,
      runwayMonths: 5,
      monthSpendCents: 120_000,
    },
  });
  expect([...view.querySelectorAll("dd")].map((dd) => dd.textContent)).toEqual([
    "$10,000",
    "$2,000",
    "5 mo",
    "$1,200",
  ]);
  expect(hrefs(view)).toEqual(["/app/finance"]);
});

it("shows the count and first transactions, each linking to its page", async () => {
  const view = await render({
    kind: "finance",
    card: {
      card: "transactions",
      count: 12,
      totalCents: -34_500,
      rows: [{ id: "t1", day: "2026-10-05", label: "Vendor A", cents: -10_000 }],
    },
  });
  expect(view.textContent).toContain("12 transactions");
  expect(view.textContent).toContain("Vendor A");
  expect(hrefs(view)).toContain("/app/finance/transaction/t1");
});

it("shows subscriptions and the upcoming total", async () => {
  const view = await render({
    kind: "finance",
    card: {
      card: "recurring",
      monthlyCents: 5_000,
      upcomingCents: 7_500,
      rows: [{ key: "streamly", label: "Streamly", cents: 2_000 }],
    },
  });
  expect(view.textContent).toContain("Streamly");
  expect(view.textContent).toContain("Next 30 days");
  expect(view.textContent).toContain("$75");
  expect(hrefs(view)).toContain("/app/finance/recurring/streamly");
});

const breakdown: Block = {
  kind: "finance",
  card: {
    card: "breakdown",
    by: "vendor",
    range: "Last 90 days",
    totalCents: 10_864_000,
    rows: [
      { key: "justworks", label: "Justworks", cents: 4_987_600 },
      { key: "cooley", label: "Coo\nley", cents: 2_188_400 },
    ],
  },
};
const overview: Block = {
  kind: "finance",
  card: {
    card: "overview",
    cashCents: 100_000,
    burnCents: 50_000,
    runwayMonths: null,
    monthSpendCents: 25_000,
  },
};
const transactions: Block = {
  kind: "finance",
  card: {
    card: "transactions",
    count: 1,
    totalCents: -5_000,
    rows: [{ id: "t1", label: "Acme", day: "2026-01-02", cents: -5_000 }],
  },
};
const recurring: Block = {
  kind: "finance",
  card: {
    card: "recurring",
    monthlyCents: 9_900,
    upcomingCents: 4_000,
    rows: [{ key: "figma", label: "Figma", cents: 9_900 }],
  },
};

it("summarizes every card variant as one line of plain text", () => {
  expect(financeCardQuote(breakdown.card)).toBe(
    "Vendors · Last 90 days: $108,640 — Justworks $49,876; Coo ley $21,884",
  );
  expect(financeCardQuote(overview.card)).toContain("Finance overview: Cash $1,000");
  expect(financeCardQuote(overview.card)).toContain("Runway –");
  expect(financeCardQuote(transactions.card)).toMatch(/^1 transactions: .*— Acme \(.*\)/);
  expect(financeCardQuote(recurring.card)).toBe(
    "Subscriptions / mo: $99 — Figma $99; next 30 days $40",
  );
});

async function renderGroup(blocks: Block[], onAsk = vi.fn()) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceCardGroup
          items={blocks.map((block, i) => ({ id: `m${i}`, block }))}
          onAsk={onAsk}
        />
      </MemoryRouter>,
    ),
  );
  return { container, onAsk };
}

it("starts a pair expanded, tiles it, and asks with the card summary", async () => {
  const { container, onAsk } = await renderGroup([breakdown, overview]);
  expect(container.querySelectorAll('[data-testid="finance-card"]')).toHaveLength(2);
  expect(container.querySelector(".grid")?.className).toContain("minmax(18rem,1fr)");
  const ask = container.querySelectorAll<HTMLButtonElement>('button[aria-label="Ask about this"]');
  await act(async () => ask[0]?.click());
  expect(onAsk).toHaveBeenCalledWith("m0", financeCardQuote(breakdown.card));
});

it("collapses three or more cards until the header is toggled", async () => {
  const { container } = await renderGroup([breakdown, overview, recurring]);
  const toggle = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
  expect(toggle?.textContent).toContain("3 finance lookups");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelectorAll('[data-testid="finance-card"]')).toHaveLength(0);
  await act(async () => toggle?.click());
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelectorAll('[data-testid="finance-card"]')).toHaveLength(3);
});

it("shows a lone card with no header", async () => {
  const { container } = await renderGroup([breakdown]);
  expect(container.querySelector("button[aria-expanded]")).toBeNull();
  expect(container.querySelector('[data-testid="finance-card"]')?.className).toContain("w-80");
});
