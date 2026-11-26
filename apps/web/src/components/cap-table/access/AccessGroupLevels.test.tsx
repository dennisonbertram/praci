// @vitest-environment jsdom

import type { EquityAccessGroup } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));

const accessGroups = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { accessGroups } } }));

import { AccessGroupLevels } from "./AccessGroupLevels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const groups: EquityAccessGroup[] = [
  { key: "founders", level: "full_detail", memberCount: 1, updatedAt: null },
  { key: "investors", level: "advanced", memberCount: 2, updatedAt: null },
  { key: "employees", level: "basic", memberCount: 3, updatedAt: null },
  { key: "former_employees", level: "basic", memberCount: 0, updatedAt: null },
  { key: "other", level: "basic", memberCount: 0, updatedAt: null },
];

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  accessGroups.list.mockReset().mockResolvedValue(groups);
  accessGroups.set
    .mockReset()
    .mockImplementation(async (input: { key: string; level: string }) => ({
      ...groups.find((group) => group.key === input.key),
      level: input.level,
    }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const pick = async (label: string, value: string) => {
  const select = host.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const saveButton = () =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === "Save access levels")!;

it("shows each group with its count and marks the recommended level", async () => {
  await act(async () => root.render(<AccessGroupLevels />));
  expect(host.textContent).toContain("Stakeholders with a founder relationship");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(5);
  expect(host.textContent?.match(/Recommended/g)).toHaveLength(5);
  expect(saveButton().disabled).toBe(true);
});

it("saves only the groups that changed", async () => {
  await act(async () => root.render(<AccessGroupLevels />));
  await pick("Access level for Employees", "restricted");
  expect(host.textContent?.match(/Recommended/g)).toHaveLength(4);
  await act(async () => saveButton().click());
  expect(accessGroups.set).toHaveBeenCalledTimes(1);
  expect(accessGroups.set).toHaveBeenCalledWith({ key: "employees", level: "restricted" });
  expect(saveButton().disabled).toBe(true);
});
