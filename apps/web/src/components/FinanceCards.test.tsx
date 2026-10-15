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
  };
});

import { FinanceCards } from "./FinanceCards";

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
