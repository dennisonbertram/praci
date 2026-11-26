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

import { OptionGrantRecord } from "./OptionGrantRecord";
import { demoOptionGrant } from "./option-grant-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

it("lists every vesting event of a 1 year cliff, monthly schedule", async () => {
  const grant = demoOptionGrant({
    vestingSchedule: {
      id: "v",
      templateId: null,
      startDate: "2024-01-01",
      totalMonths: 48,
      cliffMonths: 12,
      frequencyMonths: 1,
      tranches: null,
      acceleratedShares: null,
      acceleratedOn: null,
      stoppedOn: null,
      description: "1/48 monthly, 1 year cliff",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  });
  root = createRoot(document.createElement("div"));
  await act(async () => root?.render(<OptionGrantRecord grant={grant} onClose={vi.fn()} />));
  const rows = [...document.querySelectorAll("tbody tr")];
  expect(rows).toHaveLength(37);
  expect(rows[0]?.textContent).toContain("Jan 1, 2025");
  expect(rows[0]?.textContent).toContain("12,000");
  expect(rows.at(-1)?.textContent).toContain("48,000");
});
