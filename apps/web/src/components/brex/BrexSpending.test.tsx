// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const spending = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: { spending } } }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BrexSpending } from "./BrexSpending";
import { spendingFixture } from "./fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const search = () =>
  container.querySelector<HTMLInputElement>('input[name="brex-spending-search"]');
const type = async (input: HTMLInputElement, value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

async function mount(url = "/app/brex/spending") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <BrexSpending />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  spending.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

it("keeps the search field mounted and focused while typing refetches", async () => {
  spending.mockResolvedValueOnce(spendingFixture).mockReturnValue(new Promise(() => {}));
  await mount();
  const input = search()!;
  input.focus();
  await type(input, "F");
  await type(search()!, "Fi");
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  expect(search()).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("Fi");
  expect(spending).toHaveBeenCalledTimes(2);
});

it("keeps the toolbar and Clear filters when a refetch fails", async () => {
  spending
    .mockResolvedValueOnce(spendingFixture)
    .mockRejectedValue(new Error("Spending covers the last 90 days only"));
  await mount("/app/brex/spending?from=2026-11-05&to=2026-11-01");
  await act(async () => {});
  expect(search()).not.toBeNull();
  expect(container.textContent).toContain("Clear filters");
  await type(search()!, "x");
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  expect(search()).not.toBeNull();
  expect(container.textContent).toContain("Clear filters");
  expect(container.textContent).toContain("Try again");
});

it("shows duplicate subscriptions before the table", async () => {
  spending.mockResolvedValue({
    ...spendingFixture,
    duplicates: [
      { month: "2026-11", merchant: "Acme", cents: 100, count: 2, cardNames: ["Ops card"] },
    ],
  });
  await mount();
  const heading = [...container.querySelectorAll("h2,h3")].find((h) =>
    h.textContent?.includes("Possible duplicate subscriptions"),
  )!;
  const table = container.querySelector("table")!;
  expect(heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("hides Card and Person columns on phones", async () => {
  spending.mockResolvedValue(spendingFixture);
  await mount();
  for (const name of ["Card", "Person"]) {
    const th = [...container.querySelectorAll("th")].find((h) => h.textContent === name)!;
    expect(th.className).toContain("hidden");
    expect(th.className).toContain("@lg:table-cell");
  }
});

it("keeps fractional card transactions exact and whole-dollar transactions compact", async () => {
  spending.mockResolvedValue(spendingFixture);
  await mount();

  expect(container.textContent).toContain("$18.50");
  expect(container.textContent).toContain("$15");
  expect(container.textContent).not.toContain("$15.00");
});
