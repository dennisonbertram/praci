// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setHideAmounts } from "../../../lib/hide-amounts-preference";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({ views: { report: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));
const download = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock("./download", () => download);

import { reportFixture } from "./fixtures";
import { ReportViewer } from "./ReportViewer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  i18n.load("en", {});
  i18n.activate("en");
  setHideAmounts(false);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.views.report.mockResolvedValue(reportFixture);
});
afterEach(() => {
  act(() => root.unmount());
  setHideAmounts(false);
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("shows the cap table report with its options and downloads its CSV", async () => {
  await act(async () => {
    root.render(<ReportViewer kind="cap_table" />);
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenCalledWith({
    kind: "cap_table",
    groupBy: "share_class",
    fullyDiluted: true,
    includeConvertibles: true,
  });
  expect(host.textContent).toContain("8,000,000");
  expect(host.textContent).toContain("66.67%");
  expect(host.textContent).toContain("$63,975.00");
  expect(host.textContent).toContain("$2,000,000.00");
  expect(host.textContent).not.toContain("66.6667");
  const select = host.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
      select,
      "stakeholder",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenLastCalledWith(
    expect.objectContaining({ groupBy: "stakeholder" }),
  );
  const csv = [...host.querySelectorAll("button")].find((b) => b.textContent === "Download CSV")!;
  await act(async () => {
    csv.click();
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenLastCalledWith(expect.objectContaining({ record: true }));
  expect(download.downloadText).toHaveBeenCalledWith("cap-table-2026-10-15.csv", reportFixture.csv);
});

it("records one history entry when Download CSV is clicked twice", async () => {
  await act(async () => {
    root.render(<ReportViewer kind="cap_table" />);
    await settle();
  });
  const csv = [...host.querySelectorAll("button")].find((b) => b.textContent === "Download CSV")!;
  rpcMock.views.report.mockClear();
  await act(async () => {
    csv.click();
    csv.click();
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenCalledTimes(1);
});

it("masks report money and restores it without changing shares, percentages, or CSV", async () => {
  const report = {
    ...reportFixture,
    columns: [
      ...reportFixture.columns,
      { key: "price", label: "Price per share", numeric: true, format: "price" as const },
    ],
    rows: reportFixture.rows.map((row) => ({ ...row, price: "1.25" })),
  };
  rpcMock.views.report.mockResolvedValue(report);
  await act(async () => {
    root.render(<ReportViewer kind="cap_table" />);
    await settle();
  });
  expect(host.textContent).toContain("$63,975.00");
  expect(host.textContent).toContain("$1.25");
  expect(host.textContent).toContain("8,000,000");

  await act(async () => setHideAmounts(true));
  expect(host.textContent).toContain("$•••");
  expect(host.textContent).not.toContain("$63,975.00");
  expect(host.textContent).not.toContain("$2,000,000.00");
  expect(host.textContent).not.toContain("$1.25");
  expect(host.textContent).toContain("8,000,000");
  expect(host.textContent).toContain("66.67%");
  expect(host.textContent).toContain("Common");
  expect(rpcMock.views.report).toHaveBeenCalledTimes(1);

  const csv = [...host.querySelectorAll("button")].find((b) => b.textContent === "Download CSV")!;
  await act(async () => {
    csv.click();
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenLastCalledWith(expect.objectContaining({ record: true }));
  expect(download.downloadText).toHaveBeenCalledWith("cap-table-2026-10-15.csv", report.csv);

  await act(async () => setHideAmounts(false));
  expect(host.textContent).toContain("$63,975.00");
  expect(host.textContent).toContain("$1.25");
});

it("asks other reports without cap table options", async () => {
  await act(async () => {
    root.render(<ReportViewer kind="option_holders" />);
    await settle();
  });
  expect(rpcMock.views.report).toHaveBeenCalledWith({ kind: "option_holders" });
  expect(host.querySelector("select")).toBeNull();
});

it("shows dates as on the other tabs and keeps the text as it is", async () => {
  rpcMock.views.report.mockResolvedValue({
    ...reportFixture,
    columns: [
      { key: "security", label: "Security", format: "text" },
      { key: "issued", label: "Issue date", format: "text" },
    ],
    rows: [{ security: "CS-1", issued: "2019-03-01" }],
  });
  await act(async () => {
    root.render(<ReportViewer kind="securities_ledger" />);
    await settle();
  });
  expect(host.textContent).toContain("Mar 1, 2019");
  expect(host.textContent).not.toContain("2019-03-01");
  expect(host.textContent).toContain("CS-1");
});
