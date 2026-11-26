// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({ shareClasses: { list: vi.fn() }, overview: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { shareClassesFixture } from "./fixtures";
import { ShareClassesTab } from "./ShareClassesTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.shareClasses.list.mockResolvedValue({
    items: shareClassesFixture,
    total: 2,
    page: 1,
    pageSize: 100,
  });
  rpcMock.overview.mockResolvedValue({
    classes: [
      { shareClassId: "sc-seed", outstandingShares: "2500000" },
      { shareClassId: "sc-common", outstandingShares: "7000000" },
    ],
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("lists classes with their terms and marks a class issued over its authorized shares", async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ShareClassesTab />
      </MemoryRouter>,
    );
    await settle();
  });
  const rows = [...host.querySelectorAll("tbody tr")].map((row) => row.textContent ?? "");
  expect(rows[0]).toContain("Series Seed");
  expect(rows[0]).toContain("Over authorized");
  expect(rows[1]).toContain("Common");
  expect(rows[1]).not.toContain("Over authorized");
  const options = [...host.querySelectorAll("option")].map((option) => option.value);
  expect(options).toEqual(["", "2025-05-01", "2024-02-01"]);
  expect(host.querySelector('a[href="/app/cap-table/securities?class=sc-seed"]')?.textContent).toBe(
    "Convert shares",
  );
});

it("re-reads the terms as of a chosen document date", async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ShareClassesTab />
      </MemoryRouter>,
    );
    await settle();
  });
  const select = host.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
      select,
      "2024-02-01",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });
  expect(rpcMock.shareClasses.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ asOfDocumentDate: "2024-02-01" }),
  );
});

it("shows the core terms and reveals the rest with All terms", async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ShareClassesTab />
      </MemoryRouter>,
    );
    await settle();
  });
  const headers = () => [...host.querySelectorAll("th")].map((th) => th.textContent);
  expect(headers()).toContain("Seniority");
  expect(headers()).not.toContain("Par value");
  await act(async () => (host.querySelector('[role="switch"]') as HTMLElement).click());
  expect(headers()).toContain("Par value");
  expect(headers()).toContain("Conversion ratio");
});
