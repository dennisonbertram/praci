// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { optionGrants: rpcMock } } }));

import { OptionRepriceDialog } from "./OptionRepriceDialog";
import { demoOptionGrant } from "./option-grant-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((node) => node.textContent === label);

const grants = [
  demoOptionGrant(),
  demoOptionGrant({ id: "grant-2", label: "ES-41", stakeholderName: "Grace Example" }),
];

async function render(grantsToReprice = grants, onDone = vi.fn()) {
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <OptionRepriceDialog grants={grantsToReprice} onClose={vi.fn()} onDone={onDone} />,
    );
  });
  return onDone;
}

const type = async (id: string, value: string) => {
  const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  const owner = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(owner.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
};

const review = async () => {
  await type("reprice-price", "0.25");
  await act(async () => button("Review")?.click());
};

it("reviews the old and new price for every selected grant", async () => {
  await render();
  expect(button("Review")?.hasAttribute("disabled")).toBe(true);
  await review();
  const content = document.body.textContent ?? "";
  expect(content).toContain("ES-40");
  expect(content).toContain("ES-41");
  expect(content).toContain("$0.10 → $0.25");
  expect(content.match(/\$0\.10 → \$0\.25/g)).toHaveLength(2);
});

it("updates every grant as an amendment with the note", async () => {
  rpcMock.update.mockResolvedValue({});
  const onDone = await render();
  await type("reprice-price", "0.25");
  await type("reprice-note", "Board approved");
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.update).toHaveBeenCalledTimes(2);
  expect(rpcMock.update).toHaveBeenNthCalledWith(1, {
    id: "grant-1",
    exercisePrice: "0.25",
    reason: "amendment",
    note: "Board approved",
  });
  expect(rpcMock.update).toHaveBeenNthCalledWith(2, {
    id: "grant-2",
    exercisePrice: "0.25",
    reason: "amendment",
    note: "Board approved",
  });
  expect(onDone).toHaveBeenCalledTimes(1);
});

it("lists the grants the server refused", async () => {
  rpcMock.update
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error("Option grant is canceled"));
  const onDone = await render();
  await review();
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.update).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("ES-41: Option grant is canceled");
  expect(onDone).not.toHaveBeenCalled();
});

it("omits the note when none is entered", async () => {
  rpcMock.update.mockResolvedValue({});
  const onDone = await render();
  await review();
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.update).toHaveBeenNthCalledWith(1, {
    id: "grant-1",
    exercisePrice: "0.25",
    reason: "amendment",
  });
  expect(onDone).toHaveBeenCalledTimes(1);
});
