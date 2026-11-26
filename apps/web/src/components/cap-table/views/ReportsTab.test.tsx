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
const rpcMock = vi.hoisted(() => ({
  views: {
    report: vi.fn(),
    reportHistory: vi.fn(),
    estimatedValue: { get: vi.fn() },
    runHealthChecks: vi.fn(),
  },
  healthFindings: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { healthFindingsFixture, reportFixture } from "./fixtures";
import { ReportsTab } from "./ReportsTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.views.report.mockResolvedValue(reportFixture);
  rpcMock.healthFindings.list.mockResolvedValue({
    items: healthFindingsFixture,
    total: 2,
    page: 1,
    pageSize: 200,
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("shows one catalog entry at a time: the report, then health checks alone", async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ReportsTab />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.textContent).toContain("8,000,000");
  expect(rpcMock.healthFindings.list).not.toHaveBeenCalled();
  const tab = [...host.querySelectorAll('[role="tab"]')].find(
    (el) => el.textContent === "Health checks",
  ) as HTMLElement;
  await act(async () => {
    tab.click();
    await settle();
  });
  expect(rpcMock.healthFindings.list).toHaveBeenCalled();
  expect(host.textContent).toContain("Series Seed");
  expect(host.textContent).not.toContain("8,000,000");
});

it("lists downloaded reports and reopens one with its options", async () => {
  rpcMock.views.reportHistory.mockResolvedValue([
    {
      id: "run-1",
      kind: "cap_table",
      asOf: "2026-01-31",
      groupBy: "stakeholder",
      fullyDiluted: false,
      includeConvertibles: true,
      createdAt: "2026-02-01T10:00:00.000Z",
    },
  ]);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ReportsTab />
      </MemoryRouter>,
    );
    await settle();
  });
  const tab = [...host.querySelectorAll('[role="tab"]')].find(
    (el) => el.textContent === "History",
  ) as HTMLElement;
  await act(async () => {
    tab.click();
    await settle();
  });
  expect(host.textContent).toContain("By stakeholder · Outstanding · Convertibles");
  const open = [...host.querySelectorAll("button")].find((b) => b.textContent === "Open")!;
  await act(async () => {
    open.click();
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenLastCalledWith({
    kind: "cap_table",
    asOf: "2026-01-31",
    groupBy: "stakeholder",
    fullyDiluted: false,
    includeConvertibles: true,
  });
});
