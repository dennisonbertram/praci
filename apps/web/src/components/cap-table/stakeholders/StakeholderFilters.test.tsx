// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StakeholderFilters } from "./StakeholderFilters";
import type { StakeholderFilterValue } from "./stakeholder-filter-params";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => container.remove());

const inUse = {
  relationshipsInUse: ["investor", "ex_employee", "employee"],
  costCentersInUse: ["Engineering"],
  countriesInUse: ["USA"],
};

async function render(value: StakeholderFilterValue = {}) {
  const onChange = vi.fn();
  const root = createRoot(container);
  await act(async () => {
    root.render(<StakeholderFilters value={value} onChange={onChange} {...inUse} />);
  });
  return onChange;
}

function buttons() {
  return [...document.querySelectorAll("button")];
}

function byText(label: string) {
  return buttons().find((button) => button.textContent === label);
}

async function click(label: string) {
  const button = byText(label);
  expect(button, label).toBeDefined();
  await act(async () => button?.click());
}

async function openPanel(value?: StakeholderFilterValue) {
  const onChange = await render(value);
  const trigger = buttons().find((button) => button.textContent?.startsWith("Filters"));
  await act(async () => {
    trigger?.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return onChange;
}

function box(label: string) {
  const row = [...document.querySelectorAll("label")].find(
    (element) => element.textContent === label,
  );
  return row?.querySelector("[role=checkbox]") as HTMLElement | undefined;
}

it("shows the relationships in use plus none entered", async () => {
  await openPanel();
  const panel = document.body.textContent ?? "";
  expect(panel).toContain("Ex-Employee");
  expect(panel).toContain("Investor");
  expect(panel).toContain("None entered");
  expect(panel).not.toContain("Founder");
});

it("selects every relationship", async () => {
  const onChange = await openPanel();
  await click("Select all");
  expect(onChange).toHaveBeenCalledWith({
    relationship: ["investor", "ex_employee", "employee", "none"],
  });
});

it("disables deselect all while the group has nothing selected", async () => {
  await openPanel();
  expect(byText("Deselect all")?.disabled).toBe(true);
});

it("deselects every relationship", async () => {
  const onChange = await openPanel({ relationship: ["investor", "employee"] });
  expect(byText("Deselect all")?.disabled).toBe(false);
  await click("Deselect all");
  expect(onChange).toHaveBeenCalledWith({ relationship: undefined });
});

it("toggles a single relationship", async () => {
  const onChange = await openPanel({ relationship: ["investor"] });
  await act(async () => box("Ex-Employee")?.click());
  expect(onChange).toHaveBeenLastCalledWith({
    relationship: ["investor", "ex_employee"],
  });
  await act(async () => box("Investor")?.click());
  expect(onChange).toHaveBeenLastCalledWith({ relationship: undefined });
});

it("toggles an option from its label", async () => {
  const onChange = await openPanel();
  const row = [...document.querySelectorAll("label")].find(
    (element) => element.textContent === "Employee",
  );
  await act(async () => row?.click());
  expect(onChange).toHaveBeenCalledWith({ relationship: ["employee"] });
});

it("disables select all once every option is selected", async () => {
  await openPanel({ relationship: ["investor", "ex_employee", "employee", "none"] });
  expect(byText("Select all")?.disabled).toBe(true);
});

it("shows the active group count on the button", async () => {
  await render({ relationship: ["investor"], holdings: ["none"], createdFrom: "2025-01-01" });
  const trigger = buttons().find((button) => button.textContent?.startsWith("Filters"));
  expect(trigger?.textContent).toBe("Filters · 3");
});

it("filters by holdings, address and country", async () => {
  const onChange = await openPanel();
  await click("Holdings");
  await act(async () => box("No holdings")?.click());
  expect(onChange).toHaveBeenLastCalledWith({ holdings: ["none"] });
  await click("Address");
  await act(async () => box("Incomplete")?.click());
  expect(onChange).toHaveBeenLastCalledWith({ addressCompleteness: ["incomplete"] });
  await click("Cost center");
  await act(async () => box("Engineering")?.click());
  expect(onChange).toHaveBeenLastCalledWith({ costCenter: ["Engineering"] });
  await click("Country");
  await act(async () => box("None entered")?.click());
  expect(onChange).toHaveBeenLastCalledWith({ country: ["none"] });
});

it("edits the created date range", async () => {
  const onChange = await openPanel({ createdFrom: "2025-01-01" });
  await click("Date created");
  const from = document.querySelector<HTMLInputElement>("#stakeholder-filter-from");
  const to = document.querySelector<HTMLInputElement>("#stakeholder-filter-to");
  expect(from?.value).toBe("2025-01-01");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    if (to && setValue) setValue.call(to, "2025-06-30");
    to?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(onChange).toHaveBeenLastCalledWith({
    createdFrom: "2025-01-01",
    createdTo: "2025-06-30",
  });
});

it("clears every filter", async () => {
  const onChange = await openPanel({ relationship: ["investor"], country: ["USA"] });
  await click("Clear all");
  expect(onChange).toHaveBeenCalledWith({});
});

it("offers no clear all while nothing is filtered", async () => {
  await openPanel();
  expect(byText("Clear all")).toBeUndefined();
});
