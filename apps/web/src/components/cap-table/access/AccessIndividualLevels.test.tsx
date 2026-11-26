// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoGrants, demoGroups, demoRequest, demoStakeholders, page } from "./fixtures";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));

const equity = vi.hoisted(() => ({
  stakeholders: { list: vi.fn() },
  accessGrants: { list: vi.fn(), set: vi.fn() },
  accessGroups: { list: vi.fn() },
  accessHolders: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity } }));

import { AccessIndividualLevels } from "./AccessIndividualLevels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  equity.stakeholders.list.mockReset().mockResolvedValue(page(demoStakeholders));
  equity.accessGrants.list.mockReset().mockResolvedValue(page(demoGrants));
  equity.accessGroups.list.mockReset().mockResolvedValue(demoGroups);
  equity.accessHolders.list.mockReset().mockResolvedValue(page([demoRequest]));
  equity.accessGrants.set.mockReset().mockResolvedValue(demoGrants[0]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith(label))!;
const pick = async (value: string) => {
  const select = document.querySelector('[role="dialog"] select') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

it("shows the group level, or the override with a badge", async () => {
  await act(async () => root.render(<AccessIndividualLevels />));
  const rows = [...host.querySelectorAll("tbody tr")].map((row) => row.textContent);
  expect(rows[0]).toContain("Full detail");
  expect(rows[1]).toContain("Advanced");
  expect(rows[1]).toContain("PA");
  expect(rows[1]).toContain("18.50%");
  expect(rows[2]).toContain("Restricted");
  expect(rows[2]).toContain("Override");
  expect(rows[3]).toContain("Basic");
});

it("keeps individual access columns in a labelled, keyboard-scrollable region", async () => {
  await act(async () => root.render(<AccessIndividualLevels />));
  const region = host.querySelector('[role="region"][aria-label="Individual access levels"]');
  expect(region?.className).toContain("overflow-x-auto");
  expect(region?.querySelector("table")?.className).toContain("min-w-[760px]");
  expect(region?.querySelectorAll("th")).toHaveLength(7);
});

it("truncates long stakeholder names while keeping the full value accessible", async () => {
  const name = "The International Long Name Foundation for Example Holdings";
  equity.stakeholders.list.mockResolvedValue(
    page([...demoStakeholders, { ...demoStakeholders[0], id: "long-name", name }]),
  );
  await act(async () => root.render(<AccessIndividualLevels />));
  const nameCell = host.querySelector("tr:last-child td[aria-label]");
  expect(nameCell?.textContent).toBe(name);
  expect(nameCell?.getAttribute("aria-label")).toBe(name);
  expect(nameCell?.getAttribute("title")).toBe(name);
  expect(nameCell?.querySelector("span")?.className).toContain("truncate");
});

it("sends null for Use group level", async () => {
  await act(async () => root.render(<AccessIndividualLevels />));
  const edits = [...host.querySelectorAll("tbody button")].filter((b) => b.textContent === "Edit");
  await act(async () => (edits[2] as HTMLButtonElement).click());
  await pick("group");
  await act(async () => button("Save").click());
  expect(equity.accessGrants.set).toHaveBeenCalledWith({ stakeholderId: "s3", level: null });
});

it("edits every selected stakeholder at once", async () => {
  await act(async () => root.render(<AccessIndividualLevels />));
  const boxes = host.querySelectorAll('tbody [role="checkbox"]');
  await act(async () => (boxes[0] as HTMLElement).click());
  await act(async () => (boxes[1] as HTMLElement).click());
  await act(async () => button("Edit access level").click());
  await pick("basic");
  await act(async () => button("Save").click());
  expect(equity.accessGrants.set.mock.calls).toEqual([
    [{ stakeholderId: "s1", level: "basic" }],
    [{ stakeholderId: "s2", level: "basic" }],
  ]);
});
