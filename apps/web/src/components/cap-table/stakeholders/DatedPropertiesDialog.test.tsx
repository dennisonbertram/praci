// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
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

const update = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { stakeholders: { update } } } }));

import { DatedPropertiesDialog } from "./DatedPropertiesDialog";
import { fixtureStakeholder } from "./stakeholder-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A stakeholder with a history in every dated kind. */
const withHistory = fixtureStakeholder({
  properties: [
    { id: "p-6", kind: "department", effectiveDate: "2025-01-01", value: "Engineering" },
    { id: "p-5", kind: "cost_center", effectiveDate: "2025-01-01", value: "R&D" },
    { id: "p-4", kind: "job_title", effectiveDate: "2025-01-01", value: "Senior Engineer" },
    { id: "p-3", kind: "job_title", effectiveDate: "2024-06-01", value: "Engineer" },
    { id: "p-2", kind: "relationship", effectiveDate: "2025-01-01", value: "employee" },
    { id: "p-1", kind: "relationship", effectiveDate: "2024-03-01", value: "consultant" },
  ],
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  update.mockReset();
  update.mockResolvedValue(withHistory);
});
afterEach(async () => {
  // The dialog portals into document.body; unmount so it does not outlive the test.
  await act(async () => root.unmount());
  container.remove();
});

async function render(stakeholder = withHistory) {
  const onSaved = vi.fn();
  root = createRoot(container);
  await act(async () => {
    root.render(
      <DatedPropertiesDialog
        open
        onOpenChange={vi.fn()}
        stakeholder={stakeholder}
        onSaved={onSaved}
      />,
    );
  });
  return { root, onSaved };
}

const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent === label);

const click = (element: Element | undefined | null) =>
  act(async () => (element as HTMLElement | undefined)?.click());

const typeInto = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

/** The section whose legend names the kind, e.g. "Relationship". */
const section = (label: string) =>
  [...document.body.querySelectorAll("fieldset")].find(
    (fieldset) => fieldset.querySelector("legend")?.textContent === label,
  );

const dateInputs = (label: string) => [
  ...(section(label)?.querySelectorAll<HTMLInputElement>('input[type="date"]') ?? []),
];

const addOf = (label: string) =>
  [...(section(label)?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Add");

it("lists each kind's rows newest first", async () => {
  await render();
  expect(dateInputs("Relationship").map((input) => input.value)).toEqual([
    "2025-01-01",
    "2024-03-01",
  ]);
  expect(dateInputs("Job title").map((input) => input.value)).toEqual(["2025-01-01", "2024-06-01"]);
  expect(dateInputs("Department").map((input) => input.value)).toEqual(["2025-01-01"]);
});

it("shows no rows for a stakeholder without properties", async () => {
  await render(
    fixtureStakeholder({
      relationship: null,
      jobTitle: null,
      costCenter: null,
      department: null,
      properties: [],
    }),
  );
  for (const label of ["Relationship", "Job title", "Cost center", "Department"]) {
    expect(dateInputs(label)).toEqual([]);
    expect(addOf(label)).toBeDefined();
  }
});

it("shows the relationship values in a select", async () => {
  await render();
  const select = section("Relationship")?.querySelector("select") as HTMLSelectElement;
  expect(select.value).toBe("employee");
  expect([...select.options].some((option) => option.value === "ex_employee")).toBe(true);
});

it("adds a row dated today and removes rows", async () => {
  await render();
  await click(addOf("Job title"));
  expect(dateInputs("Job title").map((input) => input.value)).toEqual([
    "2025-01-01",
    "2024-06-01",
    new Date().toISOString().slice(0, 10),
  ]);
  await click(section("Job title")?.querySelector('[aria-label="Remove"]'));
  expect(dateInputs("Job title").map((input) => input.value)).toEqual([
    "2024-06-01",
    new Date().toISOString().slice(0, 10),
  ]);
});

it("saves every row of every kind and reports the saved detail", async () => {
  const { onSaved } = await render();
  await click(button("Save"));
  expect(update).toHaveBeenCalledWith({
    id: "sh-1",
    properties: [
      { kind: "relationship", effectiveDate: "2025-01-01", value: "employee" },
      { kind: "relationship", effectiveDate: "2024-03-01", value: "consultant" },
      { kind: "job_title", effectiveDate: "2025-01-01", value: "Senior Engineer" },
      { kind: "job_title", effectiveDate: "2024-06-01", value: "Engineer" },
      { kind: "cost_center", effectiveDate: "2025-01-01", value: "R&D" },
      { kind: "department", effectiveDate: "2025-01-01", value: "Engineering" },
    ],
  });
  expect(onSaved).toHaveBeenCalledWith(withHistory);
});

it("refuses to save when a kind that had rows loses them all", async () => {
  const { onSaved } = await render();
  while (dateInputs("Relationship").length > 0) {
    await click(section("Relationship")?.querySelector('[aria-label="Remove"]'));
  }
  await click(button("Save"));
  expect(document.body.textContent).toContain("Keep at least one entry for Relationship");
  expect(update).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
});

it("reports rows that miss a date or a value", async () => {
  await render();
  await typeInto(dateInputs("Cost center")[0]!, "");
  await click(button("Save"));
  expect(document.body.textContent).toContain("Enter a date for Cost center");
  expect(update).not.toHaveBeenCalled();
});
