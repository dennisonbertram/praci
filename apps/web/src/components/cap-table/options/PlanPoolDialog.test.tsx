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
const rpcMock = vi.hoisted(() => ({ planPools: { increase: vi.fn(), pourOver: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { PlanPoolDialog } from "./PlanPoolDialog";
import { demoPlanPool } from "./plan-pool-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((node) => node.textContent === label);

function type(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("increases the pool after reviewing the new reserve", async () => {
  rpcMock.planPools.increase.mockResolvedValue(demoPlanPool());
  const onDone = vi.fn();
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <PlanPoolDialog
        mode="increase"
        pools={[demoPlanPool()]}
        planId="plan-1"
        onClose={() => undefined}
        onDone={onDone}
      />,
    );
    await flush();
  });
  expect((button("Review") as HTMLButtonElement).disabled).toBe(true);
  await act(async () => type("pool-shares", "250000"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("1,000,000 → 1,250,000");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.planPools.increase).toHaveBeenCalledWith(
    expect.objectContaining({ planId: "plan-1", shares: "250000" }),
  );
  expect(onDone).toHaveBeenCalled();
});
