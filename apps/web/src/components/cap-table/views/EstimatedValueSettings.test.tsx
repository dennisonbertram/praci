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
const rpcMock = vi.hoisted(() => ({
  views: { estimatedValue: { get: vi.fn(), set: vi.fn() }, capTableByStakeholder: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { EstimatedValueSettings } from "./EstimatedValueSettings";
import { byStakeholderFixture } from "./fixtures";

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

it("loads the settings and saves a price with its date", async () => {
  const stored = {
    visibility: "hidden",
    pricePerShare: null,
    effectiveDate: null,
    updatedAt: null,
  };
  rpcMock.views.estimatedValue.get.mockResolvedValue(stored);
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  rpcMock.views.estimatedValue.set.mockRejectedValue(
    new Error("A price per share needs an effective date"),
  );
  await act(async () => {
    root.render(<EstimatedValueSettings />);
    await settle();
  });
  const input = host.querySelector<HTMLInputElement>("#estimated-value-price")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2.5");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  expect(rpcMock.views.estimatedValue.set).toHaveBeenCalledWith({
    visibility: "hidden",
    pricePerShare: "2.5",
    effectiveDate: null,
  });
  expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
});

it("previews what a holder sees at the saved price", async () => {
  rpcMock.views.estimatedValue.get.mockResolvedValue({
    visibility: "holders",
    pricePerShare: "1.25",
    effectiveDate: "2026-06-30",
    updatedAt: "2026-07-01T00:00:00.000Z",
  });
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  await act(async () => {
    root.render(<EstimatedValueSettings />);
    await settle();
  });
  const select = host.querySelector(
    'select[aria-label="Preview holder experience"]',
  ) as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
      select,
      "sh-ada",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // 5,000,000 shares at $1.25.
  expect(host.textContent).toContain("$6,250,000");
});

it("shows only the error, with no Save form, when the settings fail to load", async () => {
  rpcMock.views.estimatedValue.get.mockRejectedValue(new Error("offline"));
  rpcMock.views.capTableByStakeholder.mockResolvedValue(byStakeholderFixture);
  await act(async () => {
    root.render(<EstimatedValueSettings />);
    await settle();
  });
  expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
  expect(host.querySelector("form")).toBeNull();
  rpcMock.views.estimatedValue.get.mockResolvedValue({
    visibility: "hidden",
    pricePerShare: null,
    effectiveDate: null,
    updatedAt: null,
  });
  await act(async () => {
    host.querySelector("button")!.click();
    await settle();
  });
  expect(host.querySelector("form")).not.toBeNull();
});
