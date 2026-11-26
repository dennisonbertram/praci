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

const rpcMock = vi.hoisted(() => ({
  previewTermination: vi.fn(),
  terminate: vi.fn(),
}));
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      optionActions: { previewTermination: rpcMock.previewTermination },
      stakeholderActions: { terminate: rpcMock.terminate },
    },
  },
}));

import { TerminateDialog } from "./TerminateDialog";

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

it("reviews what happens to the holder's option grants before terminating", async () => {
  rpcMock.previewTermination.mockResolvedValue({
    stakeholderId: "sh-1",
    terminatedOn: "2026-11-11",
    grants: [
      {
        optionGrantId: "g1",
        label: "ES-26",
        forfeitedQuantity: "4480",
        exerciseDeadline: "2027-02-11",
      },
    ],
  });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <TerminateDialog
        open
        onOpenChange={() => undefined}
        onDone={() => undefined}
        stakeholders={[{ id: "sh-1", name: "Greta Example" }]}
      />,
    );
  });
  const review = [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent === "Review",
  );
  await act(async () => {
    review?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(rpcMock.previewTermination).toHaveBeenCalledWith(
    expect.objectContaining({ stakeholderId: "sh-1" }),
  );
  expect(document.body.textContent).toContain("ES-26: 4,480 forfeited, exercise by");
  expect(rpcMock.terminate).not.toHaveBeenCalled();
});
