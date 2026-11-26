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
const rpcMock = vi.hoisted(() => ({
  views: { modelRound: vi.fn(), scenarios: { list: vi.fn(), create: vi.fn(), update: vi.fn() } },
  convertibles: { list: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));
const download = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock("./download", () => download);

import { roundModelFixture } from "./fixtures";
import { RoundModelPanel } from "./RoundModelPanel";

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
  rpcMock.views.scenarios.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
  rpcMock.views.modelRound.mockResolvedValue(roundModelFixture);
  rpcMock.convertibles.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 500 });
});
afterEach(() => {
  act(() => root.unmount());
  setHideAmounts(false);
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;
async function type(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("models terms in cents, shows the pro forma, and saves the scenario", async () => {
  await act(async () => {
    root.render(<RoundModelPanel />);
    await settle();
  });
  await type("#model-pre-money", "20,000,000");
  await type("#model-pool", "10");
  await type('[aria-label="Investor 1"]', "Lead Fund");
  await type('[aria-label="Amount 1"]', "5000000");
  await act(async () => {
    button("Model").click();
    await settle();
  });
  const terms = {
    preMoneyValuationCents: "2000000000",
    targetPoolPercent: "10",
    convertibleIds: null,
    investments: [{ name: "Lead Fund", amountCents: "500000000" }],
  };
  expect(rpcMock.views.modelRound).toHaveBeenCalledWith(terms);
  expect(host.textContent).toContain("$1.6000");
  expect(host.textContent).toContain("Option pool");
  expect(host.textContent).toContain("3,125,000");
  await act(async () => setHideAmounts(true));
  expect(host.textContent).toContain("$•••");
  expect(host.textContent).not.toContain("$1.6000");
  expect(host.textContent).toContain("3,125,000");
  await act(async () => setHideAmounts(false));
  expect(host.textContent).toContain("$1.6000");
  await act(async () => button("Download CSV").click());
  const [file, csv] = download.downloadText.mock.calls[0] as [string, string];
  expect(file).toBe("pro-forma-2026-10-15.csv");
  expect(csv).toContain("Option pool,1000000,8.0000,1000000,6.4000");

  rpcMock.views.scenarios.create.mockResolvedValue({ id: "scn-1", name: "Series A", ...terms });
  await type('[aria-label="Scenario name"]', "Series A");
  await act(async () => {
    button("Save scenario").click();
    await settle();
  });
  expect(rpcMock.views.scenarios.create).toHaveBeenCalledWith({ name: "Series A", ...terms });
});

it("asks for a pre-money valuation before modeling", async () => {
  await act(async () => {
    root.render(<RoundModelPanel />);
    await settle();
  });
  expect(button("Save scenario")).toBeUndefined();
  await act(async () => button("Model").click());
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(rpcMock.views.modelRound).not.toHaveBeenCalled();
});

it("converts only the ticked convertibles", async () => {
  rpcMock.convertibles.list.mockResolvedValue({
    items: [
      { id: "safe-1", label: "SAFE-1", stakeholderName: "Dee Angel", principalCents: "25000000" },
      { id: "safe-2", label: "SAFE-2", stakeholderName: "Eve Angel", principalCents: "10000000" },
    ],
    total: 2,
    page: 1,
    pageSize: 500,
  });
  await act(async () => {
    root.render(<RoundModelPanel />);
    await settle();
  });
  await act(async () => button("Converting 2 of 2 convertibles").click());
  const second = host.querySelector('[aria-label="SAFE-2"]') as HTMLElement;
  await act(async () => second.click());
  expect(button("Converting 1 of 2 convertibles")).toBeDefined();
  await type("#model-pre-money", "1000000");
  await act(async () => {
    button("Model").click();
    await settle();
  });
  expect(rpcMock.views.modelRound).toHaveBeenCalledWith(
    expect.objectContaining({ convertibleIds: ["safe-1"] }),
  );
});
