// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const preview = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      shareClasses: {
        list: () => Promise.resolve({ items: [{ id: "sc-a", name: "Series A Preferred" }] }),
      },
      fundingRounds: { list: () => Promise.resolve({ items: [{ id: "r-1", name: "Seed" }] }) },
      convertibleTransactions: { previewPricedRound: preview },
    },
  },
}));

import type { EquityConvertible } from "@rakazo/contracts";
import { ConvertibleActionDialog } from "./ConvertibleActionDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
  document.body.innerHTML = "";
});

const setValue = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(
    new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
};

it("sends a new round's name with the priced-round conversion", async () => {
  preview.mockReturnValue(new Promise(() => {}));
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => {
    root?.render(
      <ConvertibleActionDialog
        action="priced-round"
        convertibles={[{ id: "cv-1", label: "SAFE-1" } as EquityConvertible]}
        onOpenChange={() => undefined}
        onDone={() => undefined}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const q = <T extends Element>(selector: string) => document.body.querySelector<T>(selector)!;
  await act(async () => {
    setValue(q<HTMLSelectElement>("#round-class"), "sc-a");
    setValue(q<HTMLInputElement>("#round-pre"), "50000000");
    setValue(q<HTMLInputElement>("#round-new"), "0");
    setValue(q<HTMLSelectElement>("#round-pick"), "new");
  });
  expect(q<HTMLSelectElement>("#round-pick").textContent).toContain("Seed");
  await act(async () => setValue(q<HTMLInputElement>("[aria-label='Round name']"), "Series A"));
  const previewButton = [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent === "Preview",
  )!;
  await act(async () => previewButton.click());
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ newRoundName: "Series A" }));
  expect(preview.mock.calls[0]![0]).not.toHaveProperty("roundId");
});
