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
  healthFindings: { list: vi.fn(), update: vi.fn() },
  views: { runHealthChecks: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));
const download = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock("./download", () => download);

import { healthFindingsFixture } from "./fixtures";
import { HealthChecks } from "./HealthChecks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
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
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;
const chip = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find(
    (element) => element.textContent === name,
  )!;
const render = async (today?: string) => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HealthChecks today={today} />
      </MemoryRouter>,
    );
    await settle();
  });
};

it("shows required findings with a link to the record, reruns and dismisses", async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HealthChecks />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(button("Required (1)")).toBeDefined();
  expect(button("Recommended (1)")).toBeDefined();
  const link = host.querySelector("a")!;
  expect(link.textContent).toBe("Series Seed");
  expect(link.getAttribute("href")).toBe("/app/cap-table/share-classes");
  expect(host.textContent).not.toContain("Cy Engineer");
  expect(host.textContent).toContain("Share classes");
  await act(async () => {
    button("Rerun checks").click();
    await settle();
  });
  expect(rpcMock.views.runHealthChecks).toHaveBeenCalledTimes(1);
  expect(rpcMock.healthFindings.list).toHaveBeenCalledTimes(2);
  await act(async () => {
    button("Dismiss").click();
    await settle();
  });
  expect(rpcMock.healthFindings.update).toHaveBeenCalledWith({ id: "hf-1", status: "dismissed" });
});

it("opens on Recommended when nothing is required", async () => {
  rpcMock.healthFindings.list.mockResolvedValue({
    items: [healthFindingsFixture[1]],
    total: 1,
    page: 1,
    pageSize: 200,
  });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HealthChecks />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.textContent).toContain("Cy Engineer");
});

it("filters cards and counts with the tag chips", async () => {
  await render("2026-10-15");
  expect(chip("Share classes").getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).toContain("Series Seed");
  await act(async () => {
    chip("Share classes").click();
    await settle();
  });
  expect(chip("Share classes").getAttribute("aria-pressed")).toBe("false");
  expect(host.textContent).not.toContain("Series Seed");
  expect(button("Required (0)")).toBeDefined();
  await act(async () => {
    chip("Share classes").click();
    await settle();
  });
  expect(host.textContent).toContain("Series Seed");
  expect(button("Required (1)")).toBeDefined();
});

it("exports the shown findings as CSV", async () => {
  await render("2026-10-15");
  await act(async () => {
    button("Export results").click();
    await settle();
  });
  expect(download.downloadText).toHaveBeenCalledWith(
    "health-checks-2026-10-15.csv",
    [
      "Check,Tag,Severity,Status,Record,Detail",
      'Share class issued over its authorized shares,Share classes,required,open,Series Seed,"2,500,000 issued or reserved of 2,000,000 authorized"',
      "",
    ].join("\r\n"),
  );
});

it("reruns a single check", async () => {
  await render("2026-10-15");
  await act(async () => {
    button("Rerun check").click();
    await settle();
  });
  expect(rpcMock.views.runHealthChecks).toHaveBeenCalledWith({ check: "class-over-issued" });
  expect(rpcMock.healthFindings.list).toHaveBeenCalledTimes(2);
});

it("shows a detail all rows share once", async () => {
  rpcMock.healthFindings.list.mockResolvedValue({
    items: [
      {
        ...healthFindingsFixture[0],
        check: "duplicated-stakeholder",
        tag: "stakeholder",
        rows: [
          {
            recordKind: "stakeholder",
            recordId: "a",
            name: "Ada Example",
            detail: "2 stakeholders share ada@example.test",
          },
          {
            recordKind: "stakeholder",
            recordId: "b",
            name: "Ada E.",
            detail: "2 stakeholders share ada@example.test",
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    pageSize: 200,
  });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HealthChecks />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.textContent?.split("2 stakeholders share ada@example.test").length).toBe(2);
});

it("titles a check it does not know in words, never as its code", async () => {
  rpcMock.healthFindings.list.mockResolvedValue({
    items: [
      { ...healthFindingsFixture[0], check: "share_class_version_mismatch" },
      { ...healthFindingsFixture[0], id: "hf-x", check: "some_new-check" },
    ],
    total: 2,
    page: 1,
    pageSize: 200,
  });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HealthChecks />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.textContent).toContain("Share class versions don't match filing dates");
  expect(host.textContent).toContain("Some new check");
  expect(host.textContent).not.toContain("share_class_version_mismatch");
});
