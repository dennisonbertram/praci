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
const rpcMock = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({
  rpc: { equity: { draftSets: { list: rpcMock.list, update: rpcMock.update } } },
}));
vi.mock("./DraftSetEditor", () => ({ DraftSetEditor: () => null }));

import { DraftSets } from "./DraftSets";

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
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent === label)!;

it("asks before discarding and keeps the table when the discard fails", async () => {
  rpcMock.list.mockResolvedValue({
    items: [
      {
        id: "d1",
        name: "Seed grants",
        status: "draft",
        revision: 2,
        items: [],
        updatedAt: "2026-11-01T00:00:00Z",
      },
    ],
    total: 1,
  });
  rpcMock.update.mockRejectedValue(new Error("stale revision"));
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<DraftSets kind="certificate" onIssued={() => undefined} />);
    await settle();
  });
  await act(async () => button("Discard").click());
  expect(rpcMock.update).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Discard Seed grants?");
  const confirm = [...document.body.querySelectorAll("button")].filter(
    (b) => b.textContent === "Discard",
  )[1]!;
  await act(async () => {
    confirm.click();
    await settle();
  });
  expect(rpcMock.update).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain("stale revision");
  expect(document.body.textContent).toContain("Seed grants");
});
