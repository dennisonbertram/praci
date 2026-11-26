// @vitest-environment jsdom

import type { BrexCardsControls } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getControls: vi.fn(), setControls: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: api } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BrexControlsForm } from "./BrexControlsForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const controls: BrexCardsControls = {
  maxNewCardLimitCents: 100_000,
  maxCardLimitCents: 500_050,
  maxSpendLimitBaseCents: 1_000_000,
  maxCardsPerDay: 5,
  allowedDurations: ["MONTHLY", "ONE_TIME"],
  oneTimeMaxDays: 90,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<BrexControlsForm />));
}
const field = (label: string) =>
  container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const checkbox = (label: string) =>
  container.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${label}"]`)!;
const save = () =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Save",
  )!;
async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  api.getControls.mockReset().mockResolvedValue(controls);
  api.setControls.mockReset().mockImplementation(async (value: BrexCardsControls) => value);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("shows the caps in dollars under the exact labels", async () => {
  await mount();
  expect(container.textContent).toContain("Controls");
  expect(field("Max limit for a new card").value).toBe("1000");
  expect(field("Max limit a card can be raised to").value).toBe("5000.50");
  expect(field("Max spend limit base amount").value).toBe("10000");
  expect(field("Cards per day").value).toBe("5");
  expect(field("One-time cards lock within (days)").value).toBe("90");
  expect(container.textContent).toContain("Allowed durations");
  expect(checkbox("Monthly").getAttribute("aria-checked")).toBe("true");
  expect(checkbox("Yearly").getAttribute("aria-checked")).toBe("false");
});

it("saves edited values as cents and shows that it saved", async () => {
  await mount();
  await typeInto(field("Max limit for a new card"), "250.75");
  await typeInto(field("Cards per day"), "3");
  await typeInto(field("One-time cards lock within (days)"), "");
  await act(async () => checkbox("Yearly").click());
  await act(async () => save().click());
  expect(api.setControls).toHaveBeenCalledOnce();
  expect(api.setControls).toHaveBeenCalledWith({
    maxNewCardLimitCents: 25_075,
    maxCardLimitCents: 500_050,
    maxSpendLimitBaseCents: 1_000_000,
    maxCardsPerDay: 3,
    allowedDurations: ["MONTHLY", "ONE_TIME", "YEARLY"],
    oneTimeMaxDays: null,
  });
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Saved");
});

it.each([
  ["Max limit for a new card", "abc"],
  ["Max limit for a new card", "0"],
  ["Max limit a card can be raised to", "-1"],
  ["Max spend limit base amount", "10.123"],
  ["Cards per day", "0"],
  ["Cards per day", "1.5"],
  ["One-time cards lock within (days)", "0"],
  ["One-time cards lock within (days)", "x"],
])("rejects %s = %j and saves nothing", async (label, value) => {
  await mount();
  await typeInto(field(label), value);
  await act(async () => save().click());
  expect(api.setControls).not.toHaveBeenCalled();
  expect(field(label).getAttribute("aria-invalid")).toBe("true");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("needs at least one allowed duration", async () => {
  await mount();
  await act(async () => checkbox("Monthly").click());
  await act(async () => checkbox("One time").click());
  await act(async () => save().click());
  expect(api.setControls).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("shows the server's refusal and does not say Saved", async () => {
  api.setControls.mockRejectedValueOnce(new Error("Only the space owner can do this."));
  await mount();
  await act(async () => save().click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Only the space owner can do this.",
  );
  expect(container.querySelector('[role="status"]')).toBeNull();
});

it("shows a loading state, then a load error with Retry that reloads", async () => {
  let finish: (value: BrexCardsControls) => void = () => undefined;
  api.getControls.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await mount();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(container.querySelector("input")).toBeNull();
  await act(async () => finish(controls));
  expect(field("Cards per day")).not.toBeNull();
  act(() => root.unmount());
  container.remove();

  api.getControls.mockRejectedValueOnce(new Error("Could not reach Brex"));
  await mount();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not reach Brex");
  const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  expect(field("Cards per day").value).toBe("5");
});
