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
const rpcMock = vi.hoisted(() => ({
  optionGrants: { update: vi.fn() },
  optionActions: {
    terminate: vi.fn(),
    previewTermination: vi.fn(),
    reverseTermination: vi.fn(),
    setPostTerminationPeriod: vi.fn(),
  },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import type { OptionGrantChange } from "./OptionGrantChangeDialog";
import { OptionGrantChangeDialog } from "./OptionGrantChangeDialog";
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
  [...document.querySelectorAll("button")].find((node) => node.textContent === label) as
    | HTMLButtonElement
    | undefined;
function type(id: string, value: string) {
  const node = document.getElementById(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(node, value);
  node.dispatchEvent(new Event("input", { bubbles: true }));
}
const schedule = {
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
};

async function render(action: OptionGrantChange) {
  const onDone = vi.fn();
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <OptionGrantChangeDialog
        action={action}
        grant={demoOptionGrant({ vestingSchedule: schedule })}
        onClose={vi.fn()}
        onDone={onDone}
      />,
    );
    await flush();
  });
  return onDone;
}

async function confirm() {
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
}

it("terminates the holder after review", async () => {
  rpcMock.optionActions.terminate.mockResolvedValue({});
  rpcMock.optionActions.previewTermination.mockResolvedValue({
    stakeholderId: "sh-1",
    terminatedOn: "2025-07-01",
    grants: [
      {
        optionGrantId: "grant-1",
        label: "ES-40",
        forfeitedQuantity: "30000",
        exerciseDeadline: "2025-10-01",
      },
    ],
  });
  const onDone = await render("terminateStakeholder");
  await act(async () => type("change-date", "2025-07-01"));
  await act(async () => {
    button("Review")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("30,000 forfeited, exercise by Oct 1, 2025");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.terminate).toHaveBeenCalledWith({
    stakeholderId: "sh-1",
    terminatedOn: "2025-07-01",
  });
  expect(onDone).toHaveBeenCalled();
});

it("accelerates no more than the unvested shares and keeps the schedule", async () => {
  rpcMock.optionGrants.update.mockResolvedValue({});
  await render("accelerateVesting");
  await act(async () => type("change-shares", "36001"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => type("change-shares", "6000"));
  await confirm();
  expect(rpcMock.optionGrants.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "grant-1",
      vesting: expect.objectContaining({ totalMonths: 48, acceleratedShares: "6000" }),
    }),
  );
});

it("changes the exercise price as an amendment", async () => {
  rpcMock.optionGrants.update.mockResolvedValue({});
  await render("modifyGrant");
  await act(async () => type("change-price", "0.25"));
  await confirm();
  expect(rpcMock.optionGrants.update).toHaveBeenCalledWith(
    expect.objectContaining({ exercisePrice: "0.25", reason: "amendment" }),
  );
});
