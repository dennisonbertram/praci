// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoRequest, page } from "./fixtures";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const accessHolders = vi.hoisted(() => ({ list: vi.fn(), resolveRequest: vi.fn() }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { accessHolders } } }));

import { AccessRequests } from "./AccessRequests";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  accessHolders.list.mockReset().mockResolvedValue(page([demoRequest]));
  accessHolders.resolveRequest.mockReset().mockResolvedValue(demoRequest);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("approves a request and removes it from the list", async () => {
  await act(async () => root.render(<AccessRequests />));
  expect(accessHolders.list).toHaveBeenCalledWith(expect.objectContaining({ requested: true }));
  expect(host.textContent).toContain("Full detail");
  const approve = [...host.querySelectorAll("button")].find((b) => b.textContent === "Approve")!;
  await act(async () => approve.click());
  expect(accessHolders.resolveRequest).toHaveBeenCalledWith({
    stakeholderId: "s2",
    requestedLevel: "full_detail",
    approve: true,
  });
  expect(host.textContent).toContain("No open requests");
});

it("shows the current request after an approval fails because it changed", async () => {
  await act(async () => root.render(<AccessRequests />));
  accessHolders.resolveRequest.mockRejectedValue(new Error("The request changed; review it again"));
  accessHolders.list.mockResolvedValue(page([{ ...demoRequest, requestedLevel: "basic" }]));
  const approve = [...host.querySelectorAll("button")].find((b) => b.textContent === "Approve")!;
  await act(async () => approve.click());
  expect(accessHolders.list).toHaveBeenCalledTimes(2);
  expect(host.textContent).not.toContain("No open requests");
  expect(host.textContent).toContain("Basic");
});
