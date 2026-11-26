// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import type { RowEdits } from "../../lib/pipeline-rows";
import { toPipelineRow } from "../../lib/pipeline-rows";
import { prospect } from "./pipeline-fixtures";
import { RowSheet } from "./RowSheet";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  // The sheet is a portal on document.body, so unmounting is what removes it.
  await act(async () => root.unmount());
  el.remove();
  resetHideAmountsMemory();
});

const noop = () => {};
const edits = (overrides: Partial<RowEdits> = {}): RowEdits => ({
  status: noop,
  interest: noop,
  nextStep: noop,
  nextCall: noop,
  amount: noop,
  referrer: noop,
  createReferrer: noop,
  log: noop,
  undoAuto: noop,
  ...overrides,
});
const render = (
  row: ReturnType<typeof toPipelineRow>,
  e: RowEdits,
  props: Partial<Parameters<typeof RowSheet>[0]> = {},
) =>
  act(async () =>
    root.render(
      <RowSheet row={row} contacts={[]} edits={e} onClose={noop} onEditContact={noop} {...props} />,
    ),
  );
const buttonNamed = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === name);
const click = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const blurInto = (input: HTMLInputElement, related: Element | null) =>
  act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: related }));
  });

it("saves the date and the time once when the sheet's next call is left", async () => {
  const row = toPipelineRow(prospect("s1", "Oak Example Angels", { nextCallAt: null }));
  const nextCall = vi.fn();
  await render(row, edits({ nextCall }));
  const date = document.querySelector("#sheet-date") as HTMLInputElement;
  const time = document.querySelector("#sheet-time") as HTMLInputElement;
  await type(date, "2026-11-12");
  expect(nextCall).not.toHaveBeenCalled();
  await type(time, "09:00");
  // Moving from the date to the time stays inside the pair; leaving the time saves both once.
  await blurInto(date, time);
  expect(nextCall).not.toHaveBeenCalled();
  await blurInto(time, null);
  expect(nextCall).toHaveBeenCalledTimes(1);
  expect(nextCall).toHaveBeenCalledWith(row, { day: "2026-11-12", time: "09:00" });
});

it("does not show a hidden Possible amount and never saves it", async () => {
  setHideAmounts(true);
  const row = toPipelineRow(prospect("s2", "Peak Example", {}, { checkSizeCents: 25_000_000 }));
  const amount = vi.fn();
  await render(row, edits({ amount }));
  const input = document.querySelector("#sheet-amount") as HTMLInputElement;
  expect(input.disabled).toBe(true);
  expect(input.value).not.toMatch(/\d/);
  await blurInto(input, null);
  expect(amount).not.toHaveBeenCalled();
});

it("saves a changed date once when the sheet is closed with Escape", async () => {
  const row = toPipelineRow(prospect("s3", "Maple Example", { nextCallAt: null }));
  const nextCall = vi.fn();
  await render(row, edits({ nextCall }));
  const date = document.querySelector("#sheet-date") as HTMLInputElement;
  await type(date, "2026-12-03");
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((done) => setTimeout(done, 20));
  });
  expect(nextCall).toHaveBeenCalledTimes(1);
  expect(nextCall).toHaveBeenCalledWith(row, { day: "2026-12-03", time: null });
});

it("saves nothing when the next call is left as it already was", async () => {
  const row = toPipelineRow(prospect("s4", "Elm Example", { nextCallAt: null }));
  const nextCall = vi.fn();
  await render(row, edits({ nextCall }));
  const date = document.querySelector("#sheet-date") as HTMLInputElement;
  await act(async () => date.focus());
  await blurInto(date, null);
  expect(nextCall).not.toHaveBeenCalled();
});

it("shows a reloaded next step and writes nothing when it is left", async () => {
  const contact = prospect("s5", "Birch Example", {}, { nextStep: "Send deck" });
  const nextStep = vi.fn();
  const e = edits({ nextStep });
  await render(toPipelineRow(contact), e);
  const input = document.querySelector("#sheet-step") as HTMLInputElement;
  expect(input.value).toBe("Send deck");
  await render(toPipelineRow({ ...contact, nextStep: "Book partner meeting" }), e);
  expect(input.value).toBe("Book partner meeting");
  await act(async () => input.focus());
  await blurInto(input, null);
  expect(nextStep).not.toHaveBeenCalled();
});

it("keeps a typed next step over a reload and saves it once", async () => {
  const contact = prospect("s6", "Cedar Example", {}, { nextStep: "Send deck" });
  const nextStep = vi.fn();
  const e = edits({ nextStep });
  await render(toPipelineRow(contact), e);
  const input = document.querySelector("#sheet-step") as HTMLInputElement;
  await type(input, "Intro to Sam");
  const reloaded = toPipelineRow({ ...contact, nextStep: "Book partner meeting" });
  await render(reloaded, e);
  expect(input.value).toBe("Intro to Sam");
  await blurInto(input, null);
  expect(nextStep).toHaveBeenCalledTimes(1);
  expect(nextStep).toHaveBeenCalledWith(reloaded, "Intro to Sam");
});

it("shows a reloaded possible amount and writes nothing when it is left", async () => {
  const contact = prospect("s7", "Alder Example", {}, { checkSizeCents: 25_000_000 });
  const amount = vi.fn();
  const e = edits({ amount });
  await render(toPipelineRow(contact), e);
  const input = document.querySelector("#sheet-amount") as HTMLInputElement;
  expect(input.value).toBe("250000");
  await render(toPipelineRow({ ...contact, checkSizeCents: 50_000_000 }), e);
  expect(input.value).toBe("500000");
  await blurInto(input, null);
  expect(amount).not.toHaveBeenCalled();
});

it("seeds the real amount when hidden amounts turn off with the sheet open", async () => {
  setHideAmounts(true);
  const contact = prospect("s8", "Rowan Example", {}, { checkSizeCents: 25_000_000 });
  const amount = vi.fn();
  const e = edits({ amount });
  await render(toPipelineRow(contact), e);
  const input = document.querySelector("#sheet-amount") as HTMLInputElement;
  expect(input.disabled).toBe(true);
  await act(async () => setHideAmounts(false));
  expect(input.value).toBe("250000");
  await blurInto(input, null);
  expect(amount).not.toHaveBeenCalled();
});

it("shows the record's details, and hides the list when there are none", async () => {
  const row = toPipelineRow(
    prospect("d1", "Harbor Example", {
      details: [
        {
          label: "Why them",
          value: "Climate angels with a long thesis on grid storage and a patient check",
          source: "list",
        },
        { label: "Intro path", value: "Sam Example knows a partner", source: "list" },
      ],
    }),
  );
  await render(row, edits());
  const list = document.querySelector("[data-testid='sheet-details']");
  expect(list?.textContent).toContain("Why them");
  expect(list?.textContent).toContain(
    "Climate angels with a long thesis on grid storage and a patient check",
  );
  expect(list?.textContent).toContain("Intro path");
  // A row without details renders no list at all.
  await render(toPipelineRow(prospect("d2", "Plain Example")), edits());
  expect(document.querySelector("[data-testid='sheet-details']")).toBeNull();
});

it("Prep outreach asks the page agent about the prospect and closes the sheet", async () => {
  const onAskAbout = vi.fn();
  const onClose = vi.fn();
  const row = toPipelineRow(
    prospect("d3", "Harbor Example", { people: [{ id: "d3", name: "Alex Sample" }] }),
  );
  await render(row, edits(), { onAskAbout, onClose });
  await click(buttonNamed("Prep outreach")!);
  expect(onAskAbout).toHaveBeenCalledWith("Prep outreach for Alex Sample at Harbor Example");
  expect(onClose).toHaveBeenCalled();
});

it("Prep outreach names only the record when the row has no person", async () => {
  const onAskAbout = vi.fn();
  const row = toPipelineRow(prospect("d4", "Firm Only Example", { people: [] }));
  await render(row, edits(), { onAskAbout });
  await click(buttonNamed("Prep outreach")!);
  expect(onAskAbout).toHaveBeenCalledWith("Prep outreach for Firm Only Example");
});

it("hides Prep outreach when no page agent can take it", async () => {
  const row = toPipelineRow(prospect("d5", "No Agent Example"));
  await render(row, edits());
  expect(buttonNamed("Prep outreach")).toBeUndefined();
});

it("hides the Interest field for a row nobody has contacted yet", async () => {
  const cold = toPipelineRow(prospect("i1", "Cold Example", { status: "not_reached" }));
  await render(cold, edits());
  expect(document.querySelector("[role=dialog]")?.textContent).not.toContain("Interest");
  const warm = toPipelineRow(prospect("i2", "Warm Example", { status: "reached_out" }));
  await render(warm, edits());
  expect(document.querySelector("[role=dialog]")?.textContent).toContain("Interest");
  expect(document.querySelector("[role=dialog]")?.textContent).toContain("Unknown");
});

it("shows the automatic change under Status and calls undoAuto on Undo", async () => {
  const undoAuto = vi.fn();
  const row = toPipelineRow(
    prospect("a1", "Delta Example", {
      status: "reached_out",
      lastAuto: {
        eventId: "evt-1",
        at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        source: "mail",
        status: "reached_out",
        nextCallAt: null,
        summary: "Re: Seed round",
      },
    }),
  );
  await render(row, edits({ undoAuto }));
  expect(document.querySelector("[role=dialog]")?.textContent).toContain(
    "Updated from email: Re: Seed round",
  );
  await click(buttonNamed("Undo")!);
  expect(undoAuto).toHaveBeenCalledWith(row);
  // A row without an automatic change shows no such line.
  await render(toPipelineRow(prospect("a2", "Plain Example", { status: "met" })), edits());
  expect(document.querySelector("[role=dialog]")?.textContent).not.toContain("Updated from");
});
