// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({ shareClasses: { create: vi.fn(), update: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { shareClassesFixture } from "./fixtures";
import { ShareClassForm } from "./ShareClassForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;
async function type(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(
      new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
async function submit() {
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
}

it("creates a preferred class after a review step, showing preferred terms only for preferred", async () => {
  const onSaved = vi.fn();
  rpcMock.shareClasses.create.mockResolvedValue(shareClassesFixture[0]);
  act(() =>
    root.render(<ShareClassForm today="2026-10-15" onSaved={onSaved} onCancel={vi.fn()} />),
  );
  expect(host.querySelector("#share-class-originalIssuePrice")).toBeNull();
  await type("share-class-name", "Series A");
  await type("share-class-prefix", "pa");
  await type("share-class-type", "preferred");
  await type("share-class-authorizedShares", "3,000,000");
  await type("share-class-originalIssuePrice", "1.25");
  await submit();
  expect(host.textContent).toContain("Series A");
  expect(host.textContent).toContain("3000000");
  expect(rpcMock.shareClasses.create).not.toHaveBeenCalled();
  await act(async () => {
    button("Create share class").click();
    await settle();
  });
  expect(rpcMock.shareClasses.create).toHaveBeenCalledWith({
    name: "Series A",
    prefix: "PA",
    classType: "preferred",
    terms: expect.objectContaining({
      documentDate: "2026-10-15",
      authorizedShares: "3000000",
      originalIssuePrice: "1.25",
      participating: false,
    }),
  });
  expect(onSaved).toHaveBeenCalledWith(shareClassesFixture[0]);
});

it("writes a new version when the document date changes, and shows a refusal", async () => {
  rpcMock.shareClasses.update.mockRejectedValue(new Error("Authorized shares are below issued"));
  const common = shareClassesFixture[1]!;
  act(() =>
    root.render(<ShareClassForm shareClass={common} onSaved={vi.fn()} onCancel={vi.fn()} />),
  );
  await type("share-class-date", "2026-09-01");
  await type("share-class-authorizedShares", "5000000");
  await submit();
  expect(host.textContent).toContain("new version");
  await act(async () => {
    button("Save terms").click();
    await settle();
  });
  expect(rpcMock.shareClasses.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "sc-common",
      terms: expect.objectContaining({ documentDate: "2026-09-01", authorizedShares: "5000000" }),
    }),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
});

it("asks for dividend accrual and day count only when a preferred class pays dividends", async () => {
  rpcMock.shareClasses.update.mockResolvedValue(shareClassesFixture[0]);
  const seed = shareClassesFixture[0]!;
  act(() => root.render(<ShareClassForm shareClass={seed} onSaved={vi.fn()} onCancel={vi.fn()} />));
  expect(host.querySelector("#share-class-accrual")).toBeNull();
  const dividends = [...host.querySelectorAll("label")].find((l) => l.textContent === "Dividends")!;
  await act(async () => (dividends.querySelector('[role="switch"]') as HTMLElement).click());
  await type("share-class-accrual", "quarterly");
  await type("share-class-day-count", "actual_360");
  await submit();
  expect(host.textContent).toContain("Quarterly");
  expect(host.textContent).toContain("Actual/360");
  await act(async () => {
    button("Save terms").click();
    await settle();
  });
  expect(rpcMock.shareClasses.update).toHaveBeenCalledWith(
    expect.objectContaining({
      terms: expect.objectContaining({
        dividend: true,
        dividendAccrual: "quarterly",
        dayCountConvention: "actual_360",
      }),
    }),
  );
});
