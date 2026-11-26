// @vitest-environment jsdom

import type { EquityVestingTemplate } from "@rakazo/contracts";
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

const rpcMock = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { vestingTemplates: rpcMock } } }));

import { VestingTemplateForm } from "./VestingTemplateForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const template = (overrides: Partial<EquityVestingTemplate> = {}): EquityVestingTemplate => ({
  id: "vt-1",
  name: "Standard 4 year",
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-01-06T00:00:00.000Z",
  ...overrides,
});

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

function type(input: HTMLInputElement | null, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input?.dispatchEvent(new Event("input", { bubbles: true }));
}

async function render(templateValue: EquityVestingTemplate | null, onSaved = vi.fn()) {
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <VestingTemplateForm template={templateValue} onClose={() => undefined} onSaved={onSaved} />,
    );
    await flush();
  });
  return onSaved;
}

it("creates an even template from the default schedule", async () => {
  rpcMock.create.mockResolvedValue(template());
  const onSaved = await render(null);
  const name = document.querySelector<HTMLInputElement>("#vesting-template-name");
  await act(async () => type(name, "Standard 4 year"));
  await act(async () => {
    button("Create template")?.click();
    await flush();
  });
  expect(rpcMock.create).toHaveBeenCalledWith({
    name: "Standard 4 year",
    totalMonths: 48,
    cliffMonths: 12,
    frequencyMonths: 1,
    tranches: null,
  });
  expect(onSaved).toHaveBeenCalled();
});

it("blocks a custom schedule that does not total 100 percent", async () => {
  const custom = template({
    tranches: [
      { monthOffset: 12, percent: "25" },
      { monthOffset: 24, percent: "25" },
      { monthOffset: 36, percent: "50" },
    ],
  });
  await render(custom);
  const first = document.querySelector<HTMLInputElement>('[aria-label="Tranche 1 percent"]');
  expect(first).not.toBeNull();
  await act(async () => type(first, "30"));
  expect(document.body.textContent).toContain("Percentages must total 100%");
  await act(async () => {
    button("Save")?.click();
    await flush();
  });
  expect(rpcMock.update).not.toHaveBeenCalled();
  expect(button("Save")?.disabled).toBe(true);
});

it("saves a custom schedule that totals 100 percent", async () => {
  rpcMock.update.mockResolvedValue(template());
  const onSaved = await render(
    template({
      tranches: [
        { monthOffset: 12, percent: "25" },
        { monthOffset: 24, percent: "75" },
      ],
    }),
  );
  await act(async () => {
    button("Save")?.click();
    await flush();
  });
  expect(rpcMock.update).toHaveBeenCalledWith({
    id: "vt-1",
    name: "Standard 4 year",
    totalMonths: 24,
    cliffMonths: 0,
    frequencyMonths: 1,
    tranches: [
      { monthOffset: 12, percent: "25" },
      { monthOffset: 24, percent: "75" },
    ],
  });
  expect(onSaved).toHaveBeenCalled();
});
