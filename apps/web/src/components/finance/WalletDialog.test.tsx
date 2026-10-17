// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: { walletAdd: vi.fn() } } }));

import { WalletDialog } from "./WalletDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const field = (label: string) => {
  const found = [...document.body.querySelectorAll("label")].find((l) => l.textContent === label);
  return document.getElementById(found?.htmlFor ?? "") as HTMLInputElement | HTMLSelectElement;
};

it("keeps visible labels on every field and explains the chosen wallet type", async () => {
  await act(async () => root.render(<WalletDialog open onClose={() => {}} onSaved={() => {}} />));
  const address = field("Address or ENS") as HTMLInputElement;
  expect(address?.tagName).toBe("INPUT");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      address,
      "alice.eth",
    );
    address.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The label stays once text is typed (a placeholder would be gone).
  expect(field("Address or ENS")).toBe(address);
  expect(field("Label (optional)")?.tagName).toBe("INPUT");
  const type = field("Type") as HTMLSelectElement;
  const hint = () => document.getElementById(type.getAttribute("aria-describedby") ?? "");
  expect(hint()?.textContent).toBe("A wallet you hold the keys to.");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(type, "safe");
    type.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(hint()?.textContent).toBe("A Safe multisig. Its owners and threshold are shown.");
});
