// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  company: {
    privacy: vi.fn(),
    sourceControl: vi.fn(),
    erase: vi.fn(),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import { CompanyPrivacy } from "./CompanyPrivacy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.company.privacy.mockResolvedValue({
    sources: [
      {
        sourceKind: "gmail",
        connectionId: "gmail-connection",
        mcpServerId: null,
        label: "Gmail",
        evidenceCount: 0,
        blocked: true,
      },
    ],
  });
  rpcMock.company.sourceControl.mockResolvedValue({ ok: true });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("shows a stopped import source and allows imports again", async () => {
  await act(async () => {
    root.render(<CompanyPrivacy onClose={() => {}} onChanged={() => {}} />);
  });
  await act(async () => {});

  expect(document.body.textContent).toContain("Imports stopped");
  const button = [...document.body.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === "Allow imports",
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(rpcMock.company.sourceControl).toHaveBeenCalledWith({
    sourceKind: "gmail",
    connectionId: "gmail-connection",
    mcpServerId: null,
    connected: true,
  });
});
