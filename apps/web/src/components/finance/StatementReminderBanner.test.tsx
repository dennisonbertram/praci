// @vitest-environment jsdom

import type { StatementReminder } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t: text }) }));

import { StatementReminderBanner } from "./StatementReminderBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const banner = async (dueFor: string) => {
  const el = document.createElement("div");
  const reminder: StatementReminder = {
    accountId: "a1",
    accountName: "Example Bank ••1234",
    coveredThrough: "2026-09-07",
    dueFor,
  };
  await act(async () =>
    createRoot(el).render(<StatementReminderBanner reminders={[reminder]} onUpload={() => {}} />),
  );
  return el.textContent;
};

it("names a month-end statement by its month", async () => {
  expect(await banner("2026-10-31")).toContain("Upload the October statement for Example Bank");
});

it("names a mid-month cycle by its end day, not a month that is not over", async () => {
  const shown = await banner("2026-10-07");
  expect(shown).toContain("Upload the statement through Oct 7 for Example Bank");
  expect(shown).not.toContain("October");
});
