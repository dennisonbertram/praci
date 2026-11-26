// @vitest-environment jsdom

import type { EquityOptionGrant } from "@rakazo/contracts";
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
  optionActions: {
    cancel: vi.fn(),
    exercise: vi.fn(),
    reverseCancellation: vi.fn(),
    cancelPendingExercises: vi.fn(),
  },
  optionGrants: { get: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { OptionGrantActionDialog } from "./OptionGrantActionDialog";
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

async function render(
  action: "exercise" | "partiallyCancel" | "reverseCancellation",
  grant: EquityOptionGrant = demoOptionGrant(),
) {
  const onDone = vi.fn();
  const onClose = vi.fn();
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(
      <OptionGrantActionDialog action={action} grant={grant} onClose={onClose} onDone={onDone} />,
    );
    await flush();
  });
  return { onDone, onClose };
}

it("exercises the vested shares after the review step", async () => {
  rpcMock.optionActions.exercise.mockResolvedValue({});
  rpcMock.optionGrants.get.mockResolvedValue(demoOptionGrant({ exercisedQuantity: "12000" }));
  const { onDone } = await render("exercise");
  expect(button("Confirm")).toBeUndefined();
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("12,000");
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledWith(
    expect.objectContaining({
      optionGrantId: "grant-1",
      quantity: "12000",
      requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }),
  );
  expect(onDone).toHaveBeenCalled();
});

it("defaults to vested shares minus shares already exercised", async () => {
  await render(
    "exercise",
    demoOptionGrant({
      exercisedQuantity: "4000",
      outstandingQuantity: "44000",
      vestedQuantity: "12000",
    }),
  );
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("8,000");
});

it("defaults to outstanding shares for early exercise", async () => {
  await render(
    "exercise",
    demoOptionGrant({
      earlyExercise: true,
      exercisedQuantity: "4000",
      outstandingQuantity: "44000",
      vestedQuantity: "12000",
    }),
  );
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("44,000");
});

it("shows the server refusal on the review step", async () => {
  rpcMock.optionActions.cancel.mockRejectedValue(new Error("The plan does not have enough"));
  const { onDone } = await render("partiallyCancel");
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.cancel).toHaveBeenCalledWith(
    expect.objectContaining({ id: "grant-1", quantity: "48000" }),
  );
  expect(onDone).not.toHaveBeenCalled();
  expect(button("Confirm")).toBeDefined();
});

it("opens a reversal straight on the review step", async () => {
  rpcMock.optionActions.reverseCancellation.mockResolvedValue(demoOptionGrant());
  await render("reverseCancellation");
  expect(button("Confirm")).toBeDefined();
});

it("retries only the refresh after exercise succeeds", async () => {
  rpcMock.optionActions.exercise.mockResolvedValue({});
  rpcMock.optionGrants.get
    .mockRejectedValueOnce(new Error("refresh failed"))
    .mockResolvedValueOnce(demoOptionGrant({ exercisedQuantity: "12000" }));
  const { onDone } = await render("exercise");
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledTimes(1);
  expect(button("Refresh")).toBeDefined();
  expect(button("Close")).toBeDefined();
  await act(async () => {
    button("Refresh")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it("awaits a Promise-returning parent refresh and offers refresh-only recovery", async () => {
  rpcMock.optionActions.exercise.mockResolvedValue({});
  rpcMock.optionGrants.get.mockResolvedValue(demoOptionGrant({ exercisedQuantity: "12000" }));
  const { onDone } = await render("exercise");
  onDone.mockRejectedValueOnce(new Error("parent refresh failed"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(button("Refresh")).toBeDefined();
  await act(async () => {
    button("Refresh")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledTimes(2);
});

it("does not repeat a successful partial cancellation when parent refresh rejects", async () => {
  rpcMock.optionActions.cancel.mockResolvedValue(demoOptionGrant());
  rpcMock.optionGrants.get.mockResolvedValue(demoOptionGrant({ canceledQuantity: "1000" }));
  const { onDone } = await render("partiallyCancel");
  onDone.mockRejectedValueOnce(new Error("parent refresh failed"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.cancel).toHaveBeenCalledTimes(1);
  expect(button("Refresh")).toBeDefined();
  expect(button("Close")).toBeDefined();
  await act(async () => {
    button("Refresh")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.cancel).toHaveBeenCalledTimes(1);
  expect(rpcMock.optionGrants.get).toHaveBeenCalledTimes(2);
  expect(onDone).toHaveBeenCalledTimes(2);
});

it("retries an uncertain exercise response with the same key and payload", async () => {
  rpcMock.optionActions.exercise
    .mockRejectedValueOnce(new Error("response lost"))
    .mockResolvedValueOnce({});
  rpcMock.optionGrants.get.mockResolvedValue(demoOptionGrant({ exercisedQuantity: "12000" }));
  await render("exercise");
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    await flush();
  });
  await act(async () => {
    button("Retry")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledTimes(2);
  expect(rpcMock.optionActions.exercise.mock.calls[1]?.[0]).toEqual(
    rpcMock.optionActions.exercise.mock.calls[0]?.[0],
  );
});

it("guards synchronous double submits and allows Close while idle", async () => {
  let release: (() => void) | undefined;
  rpcMock.optionActions.exercise.mockReturnValue(
    new Promise((resolve) => {
      release = () => resolve({});
    }),
  );
  rpcMock.optionGrants.get.mockResolvedValue(demoOptionGrant({ exercisedQuantity: "12000" }));
  const { onClose } = await render("exercise");
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Confirm")?.click();
    button("Confirm")?.click();
  });
  expect(rpcMock.optionActions.exercise).toHaveBeenCalledTimes(1);
  await act(async () => {
    release?.();
    await flush();
  });
  expect(button("Close")).toBeDefined();
  await act(async () => button("Close")?.click());
  expect(onClose).toHaveBeenCalledTimes(1);
});
