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
const rpcMock = vi.hoisted(() => ({ optionActions: { cancel: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { OptionBulkCancelDialog } from "./OptionBulkCancelDialog";
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

it("cancels every selected grant after one review and lists failures", async () => {
  rpcMock.optionActions.cancel
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error("Only an outstanding grant can be canceled"));
  const onDone = vi.fn();
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <OptionBulkCancelDialog
        grants={[demoOptionGrant(), demoOptionGrant({ id: "grant-2", label: "ES-41" })]}
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );
  });
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("ES-40, ES-41");
  expect(document.body.textContent).toContain("96,000");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.cancel).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain("ES-41");
  expect(onDone).not.toHaveBeenCalled();
});
