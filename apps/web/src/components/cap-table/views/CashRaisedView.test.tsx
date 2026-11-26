// @vitest-environment jsdom

import type * as UiWeb from "@rakazo/ui-web";
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
const toast = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (actual) => ({
  ...(await actual<typeof UiWeb>()),
  enqueueNotificationToast: toast,
}));
const rpcMock = vi.hoisted(() => ({ views: { cashRaised: vi.fn(), attachToRound: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { CashRaisedView } from "./CashRaisedView";
import { cashRaisedFixture, roundsFixture } from "./fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.views.cashRaised.mockResolvedValue(cashRaisedFixture);
  rpcMock.views.attachToRound.mockResolvedValue({ certificates: 1, convertibles: 1 });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("shows cash by class and per security, and puts selected securities in a round", async () => {
  const onChanged = vi.fn();
  await act(async () => {
    root.render(<CashRaisedView rounds={roundsFixture} onChanged={onChanged} />);
    await settle();
  });
  expect(host.querySelector("figure")?.textContent).toContain("$2,250,500");
  const rows = [...host.querySelectorAll("tbody tr")].map((row) => row.textContent ?? "");
  expect(rows[1]).toContain("Seed");
  expect(host.querySelector("select")).toBeNull();
  const boxes = [...host.querySelectorAll('[role="checkbox"]')] as HTMLElement[];
  await act(async () => boxes[0]!.click());
  await act(async () => boxes[2]!.click());
  expect(host.textContent).toContain("2 selected");
  const select = host.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
      select,
      "round-pre",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const apply = [...host.querySelectorAll("button")].find((b) => b.textContent === "Apply")!;
  await act(async () => {
    apply.click();
    await settle();
  });
  expect(rpcMock.views.attachToRound).toHaveBeenCalledWith({
    roundId: "round-pre",
    certificateIds: ["cert-1"],
    convertibleIds: ["safe-1"],
  });
  expect(onChanged).toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Added 2 to Pre-seed SAFEs" }),
  );
  expect(rpcMock.views.cashRaised).toHaveBeenCalledTimes(2);
});

it("searches and sorts the securities", async () => {
  await act(async () => {
    root.render(<CashRaisedView rounds={roundsFixture} onChanged={vi.fn()} />);
    await settle();
  });
  const names = () =>
    [...host.querySelectorAll("tbody tr")].map((row) => row.querySelectorAll("td")[2]?.textContent);
  expect(names()).toEqual(["Dee Angel", "Example Ventures", "Ada Founder"]);
  const cash = [...host.querySelectorAll("th")].find((th) =>
    th.textContent?.includes("Cash paid"),
  )!;
  await act(async () =>
    (cash.querySelector("button") ?? cash).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    ),
  );
  expect(names()).toEqual(["Example Ventures", "Dee Angel", "Ada Founder"]);
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "seed");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(names()).toEqual(["Example Ventures"]);
});
