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
  counts: vi.fn(),
  list: vi.fn(),
  resolve: vi.fn(),
  previewTermination: vi.fn(),
}));
vi.mock("../../../lib/rpc", () => ({
  rpc: {
    equity: {
      stakeholderChanges: {
        counts: rpcMock.counts,
        list: rpcMock.list,
        resolve: rpcMock.resolve,
      },
      optionActions: { previewTermination: rpcMock.previewTermination },
      stakeholders: { list: vi.fn().mockResolvedValue({ items: [] }) },
    },
  },
}));

import { StakeholderChanges } from "./StakeholderChanges";

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
const change = (id: string, name: string) => ({
  id,
  kind: "termination",
  stakeholderId: `sh-${id}`,
  stakeholderName: name,
  externalName: name,
  employeeId: id,
  terminationDate: "2026-11-11",
  proposed: {},
});
const button = (label: string) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent === label)!;

it("reviews selected terminations first and still refreshes when one fails", async () => {
  rpcMock.counts.mockResolvedValue({ match: 0, termination: 2, profile: 0 });
  rpcMock.list.mockResolvedValue({ items: [change("a", "Ada"), change("b", "Bo")] });
  rpcMock.previewTermination.mockResolvedValue({ grants: [] });
  rpcMock.resolve.mockRejectedValueOnce(new Error("first failed")).mockResolvedValue({});
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<StakeholderChanges onBack={() => undefined} />);
    await settle();
  });
  await act(async () => {
    document.body.querySelector<HTMLElement>('[role="tab"]:nth-child(2)')?.click();
    await settle();
  });
  await act(async () => {
    document.body.querySelector<HTMLElement>('[aria-label="Select all"]')!.click();
  });
  const listCalls = rpcMock.list.mock.calls.length;
  await act(async () => {
    button("Terminate selected").click();
    await settle();
  });
  // Nothing is accepted until the review is confirmed.
  expect(rpcMock.resolve).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Ada stop vesting on");
  await act(async () => {
    button("Terminate").click();
    await settle();
  });
  expect(rpcMock.resolve).toHaveBeenCalledTimes(2);
  expect(rpcMock.list.mock.calls.length).toBeGreaterThan(listCalls);
  expect(document.body.textContent).toContain("first failed");
});
