// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetHideAmountsMemory, setHideAmounts } from "../../../lib/hide-amounts-preference";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({
  fundingRounds: { create: vi.fn(), update: vi.fn(), list: vi.fn() },
  views: { cashRaised: vi.fn(), scenarios: { list: vi.fn(async () => ({ items: [] })) } },
  convertibles: { list: vi.fn(async () => ({ items: [] })) },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { cashRaisedFixture, roundsFixture } from "./fixtures";
import { RoundForm } from "./RoundForm";
import { postMoneyCents, RoundsTab } from "./RoundsTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  resetHideAmountsMemory();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  resetHideAmountsMemory();
  host.remove();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((element) => element.textContent === name)!;
async function type(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("creates a round in cents after review, with adjusted totals", async () => {
  rpcMock.fundingRounds.create.mockResolvedValue(roundsFixture[1]);
  const onSaved = vi.fn();
  act(() => root.render(<RoundForm today="2026-10-15" onSaved={onSaved} onCancel={vi.fn()} />));
  await type("round-name", "Series A");
  await type("round-preMoney", "1,250,000.50");
  await act(async () => button("Adjust totals").click());
  await type("round-cashRaised", "300000");
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  expect(host.textContent).toContain("$1,250,001");
  await act(async () => {
    button("Create round").click();
    await settle();
  });
  expect(rpcMock.fundingRounds.create).toHaveBeenCalledWith({
    name: "Series A",
    startDate: "2026-10-15",
    closingDate: null,
    originalIssuePrice: null,
    preMoneyValuationCents: "125000050",
    overrides: { cashRaisedCents: "30000000" },
  });
  expect(onSaved).toHaveBeenCalled();
});

it("refuses an amount with more than two decimals before review", async () => {
  act(() => root.render(<RoundForm onSaved={vi.fn()} onCancel={vi.fn()} />));
  await type("round-name", "Bridge");
  await type("round-preMoney", "1.234");
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(button("Review")).toBeDefined();
});

it("edits a round by id", async () => {
  rpcMock.fundingRounds.update.mockResolvedValue(roundsFixture[1]);
  act(() =>
    root.render(<RoundForm round={roundsFixture[1]} onSaved={vi.fn()} onCancel={vi.fn()} />),
  );
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  await act(async () => {
    button("Save round").click();
    await settle();
  });
  expect(rpcMock.fundingRounds.update).toHaveBeenCalledWith(
    expect.objectContaining({ id: "round-seed", preMoneyValuationCents: "800000000" }),
  );
});

it("conceals stored round prices and review amounts without changing the saved payload", async () => {
  const round = {
    ...roundsFixture[1]!,
    originalIssuePrice: "8.1234567",
    overrides: { cashRaisedCents: "30000000", postMoneyValuationCents: "900000000" },
  };
  rpcMock.fundingRounds.update.mockResolvedValue(round);
  setHideAmounts(true);
  act(() => root.render(<RoundForm round={round} onSaved={vi.fn()} onCancel={vi.fn()} />));

  for (const id of [
    "round-originalIssuePrice",
    "round-preMoney",
    "round-cashRaised",
    "round-postMoney",
  ]) {
    const field = host.querySelector<HTMLInputElement>(`#${id}`)!;
    expect(field.type).toBe("password");
    expect(field.value).toBe("••••••");
  }
  expect(host.querySelector<HTMLInputElement>("#round-originalIssuePrice")?.value).not.toContain(
    "0.80",
  );

  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  const reviewRows = new Map(
    [...host.querySelectorAll("dt")].map((dt) => [
      dt.textContent,
      dt.nextElementSibling?.textContent,
    ]),
  );
  expect(reviewRows.get("Original issue price")).toBe("$•••");
  expect(reviewRows.get("Pre-money")).toBe("$•••");
  expect(reviewRows.get("Cash raised")).toBe("$•••");
  expect(reviewRows.get("Post-money")).toBe("$•••");

  await act(async () => button("Back").click());
  act(() => setHideAmounts(false));
  const issuePrice = host.querySelector<HTMLInputElement>("#round-originalIssuePrice")!;
  expect(issuePrice.type).toBe("text");
  expect(issuePrice.value).toBe("8.1234567");
  await act(async () => {
    host.querySelector("form")!.requestSubmit();
    await settle();
  });
  const visibleIssuePrice = [...host.querySelectorAll("dt")].find(
    (dt) => dt.textContent === "Original issue price",
  )?.nextElementSibling?.textContent;
  expect(visibleIssuePrice).toBe("$8.1234567");

  await act(async () => {
    button("Save round").click();
    await settle();
  });
  expect(rpcMock.fundingRounds.update).toHaveBeenCalledWith({
    id: round.id,
    name: round.name,
    startDate: round.startDate,
    closingDate: round.closingDate,
    originalIssuePrice: "8.1234567",
    preMoneyValuationCents: "800000000",
    overrides: { cashRaisedCents: "30000000", postMoneyValuationCents: "900000000" },
  });
});

it("lists rounds newest first with post-money and the chart", async () => {
  rpcMock.fundingRounds.list.mockResolvedValue({
    items: roundsFixture,
    total: 2,
    page: 1,
    pageSize: 200,
  });
  // $2,500,000 in rounds; $2,750,000 raised in all, so $250,000 is in no round.
  rpcMock.views.cashRaised.mockResolvedValue({ ...cashRaisedFixture, totalCents: "275000000" });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RoundsTab />
      </MemoryRouter>,
    );
    await settle();
  });
  const rows = [...host.querySelectorAll("tbody tr")].map((row) => row.textContent ?? "");
  expect(rows[0]).toContain("Seed");
  expect(rows[0]).toContain("$10,000,000");
  expect(host.querySelector("figure")?.textContent).toContain("$2,750,000");
  expect(host.querySelector("figure")?.textContent).toContain("No round");
  expect(postMoneyCents(roundsFixture[0]!)).toBeNull();
});

it("shows one bar per year of issue when grouping is off", async () => {
  rpcMock.fundingRounds.list.mockResolvedValue({
    items: roundsFixture,
    total: 2,
    page: 1,
    pageSize: 200,
  });
  rpcMock.views.cashRaised.mockResolvedValue(cashRaisedFixture);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <RoundsTab />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.querySelector("figure")?.textContent).toContain("Pre-seed SAFEs");
  const toggle = host.querySelector<HTMLElement>('[role="switch"]')!;
  await act(async () => {
    toggle.click();
    await settle();
  });
  const chart = host.querySelector("figure")!.textContent ?? "";
  expect(chart).toContain("2024");
  expect(chart).toContain("2025");
  expect(chart).toContain("2026");
  expect(chart).not.toContain("Pre-seed SAFEs");
  expect(host.querySelectorAll("figure polyline").length).toBe(1);
});

it("opens Model a round from the URL", async () => {
  rpcMock.fundingRounds.list.mockResolvedValue({
    items: roundsFixture,
    total: 2,
    page: 1,
    pageSize: 200,
  });
  rpcMock.views.cashRaised.mockResolvedValue({
    totalCents: "0",
    byClass: [],
    byHolder: [],
    securities: [],
    asOf: "2026-10-15",
  });
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/app/cap-table/rounds?view=model"]}>
        <RoundsTab />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(host.querySelector("#model-pre-money")).not.toBeNull();
});
