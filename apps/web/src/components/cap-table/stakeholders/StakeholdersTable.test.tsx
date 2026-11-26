// @vitest-environment jsdom

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

const list = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { stakeholders: { list } } } }));

import { canTerminate, relationshipPeriods } from "./StakeholderProfile";
import { StakeholdersTable } from "./StakeholdersTable";
import { fixturePage, fixtureStakeholder } from "./stakeholder-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  list.mockReset();
  list.mockResolvedValue(fixturePage());
});
afterEach(() => container.remove());

async function render(onSelectedChange = vi.fn(), onOpen = vi.fn()) {
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <StakeholdersTable
          filters={{}}
          onOpen={onOpen}
          onEdit={vi.fn()}
          onEditProperties={vi.fn()}
          onTerminate={vi.fn()}
          selected={[]}
          onSelectedChange={onSelectedChange}
        />
      </MemoryRouter>,
    );
  });
  return root;
}

it("lists stakeholders, sorted by name by default", async () => {
  await render();
  expect(container.textContent).toContain("Orchard Seed Fund");
  expect(container.textContent).toContain("Ex-Employee");
  expect(list).toHaveBeenCalledWith(
    expect.objectContaining({ sort: { field: "name", dir: "asc" }, page: 1, pageSize: 25 }),
  );
});

it("sorts by relationship when its header is clicked", async () => {
  await render();
  const header = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Relationship",
  );
  await act(async () => header?.click());
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ sort: { field: "relationship", dir: "asc" } }),
  );
});

it("selects every row on the page", async () => {
  const onSelectedChange = vi.fn();
  await render(onSelectedChange);
  const all = container.querySelector('[aria-label="Select all"]') as HTMLElement;
  await act(async () => all.click());
  expect(onSelectedChange).toHaveBeenCalledWith(fixturePage().items.map((row) => row.id));
});

it("shows the empty state", async () => {
  list.mockResolvedValue(fixturePage(0));
  await render();
  expect(container.textContent).toContain("No stakeholders");
});

it("terminates only people with a working relationship", () => {
  expect(canTerminate(fixtureStakeholder())).toBe(true);
  expect(canTerminate(fixtureStakeholder({ relationship: "investor" }))).toBe(false);
  expect(canTerminate(fixtureStakeholder({ relationship: "ex_employee" }))).toBe(false);
  expect(canTerminate(fixtureStakeholder({ relationship: null }))).toBe(false);
  expect(canTerminate(fixtureStakeholder({ terminatedOn: "2026-01-01" }))).toBe(false);
});

it("turns relationship entries into periods, newest first", () => {
  expect(
    relationshipPeriods(fixtureStakeholder()).map(({ value, from, to }) => [value, from, to]),
  ).toEqual([
    ["employee", "2025-01-01", null],
    ["consultant", "2024-03-01", "2024-12-31"],
  ]);
});

it("opens the profile from a click anywhere on the row, but not from its checkbox", async () => {
  const onOpen = vi.fn();
  const onSelectedChange = vi.fn();
  await render(onSelectedChange, onOpen);
  const row = container.querySelector("tbody tr")!;
  await act(async () => {
    (row.querySelectorAll("td")[2] as HTMLElement).click();
  });
  expect(onOpen).toHaveBeenCalledTimes(1);
  await act(async () => {
    (row.querySelector("[role=checkbox], input[type=checkbox]") as HTMLElement).click();
  });
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onSelectedChange).toHaveBeenCalled();
});
